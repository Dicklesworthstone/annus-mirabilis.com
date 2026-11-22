/**
 * Refresh only the source-bound receipts of the authored coin-to-bell walkthrough.
 * Run after prepare:lab with the declared Node 22.13.1 / V8 recorder:
 *   node --experimental-strip-types scripts/record-coin-to-bell.mjs
 *
 * This script writes no content. It records the real walk worker, including the pinned
 * FrankenSim Gaussian engine, and preserves every authored control, expected reading and
 * stream position. All six bounded links must replay before replacement receipts are printed.
 * Keep this outside generate-walks.mjs's evaluator closure so recording cannot change it.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { BM05_DEFAULTS } from "../src/experiments/bm05/definition.ts";
import {
  decodeTapePermalink,
  encodeTapePermalink,
  MAX_PERMALINK_URL_LENGTH,
} from "../src/experiments/permalink/codec.ts";
import { permalinkTapeFromControlTape } from "../src/experiments/permalink/fromControlTape.ts";
import { checkpointPrefixes } from "../src/experiments/permalink/walkthroughCheckpoints.ts";
import { restoreWorkerTape } from "../src/experiments/permalink/workerSessionTape.ts";
import { validateControlTape } from "../src/experiments/tapes/schema.ts";
import {
  bm05Laboratory,
  bm05ReplayFixture,
  recordBm05Checkpoints,
} from "../src/testing/bm05ReplayHarness.ts";

function expectedValues(publication, checkpoint, constantSetId) {
  assert.ok(checkpoint.expectedDisplayValues?.length > 0, "Every stop needs authored readings.");
  return checkpoint.expectedDisplayValues.map((expected) => {
    const actual = publication.outputs.find((output) => output.quantityId === expected.outputId);
    assert.ok(actual, expected.outputId);
    assert.equal(actual.status, "value", expected.outputId);
    assert.equal(actual.value, expected.value, expected.label);
    assert.equal(actual.unit, expected.unit, expected.label);
    assert.equal(expected.constantSetId, constantSetId, expected.label);
    return {
      label: expected.label,
      outputId: actual.quantityId,
      value: actual.value,
      unit: actual.unit,
      constantSetId,
    };
  });
}

/** Return new receipts only after actual capture and verified playback of every original prefix. */
export async function recordCoinToBell(record) {
  assert.equal(process.versions.bun, undefined, "The authored recorder requires Node, not Bun.");
  assert.equal(process.versions.node, "22.13.1", "Use the declared Node 22.13.1 / V8 recorder.");
  assert.equal(record.tapeId, "coin-to-bell");
  assert.equal(record.experimentId, "bm-05");
  assert.equal(record.mode, "bm-05:default");
  assert.equal(record.modelIdentity.modelId, "bm05-host-preview-v1");
  assert.equal(record.constantSetId, "not-applicable");
  assert.equal(record.seed, "1905");
  assert.equal(record.allocationId, "bm-05.walk.v1");
  assert.deepEqual(Object.keys(record.initialConditions).sort(), Object.keys(BM05_DEFAULTS).sort());
  assert.deepEqual(record.initialConditions, {
    stepRms: 5e-7,
    tau: 0.1,
    walkers: 2000,
    runSteps: 400,
    n: 0,
    bias: 0.6,
    kernel: "coin",
    seed: "1905",
  });
  assert.deepEqual(
    record.events.map(({ kind, actionIndex, commandClass, parameterId, value }) => ({
      kind,
      actionIndex,
      commandClass,
      parameterId,
      value,
    })),
    [
      ...[4, 16, 64, 400].map((value, index) => ({
        kind: "control",
        actionIndex: index + 1,
        commandClass: "measurement-change",
        parameterId: "n",
        value,
      })),
      ...["uniform", "gaussian"].map((value, index) => ({
        kind: "control",
        actionIndex: index + 5,
        commandClass: "setup-change",
        parameterId: "kernel",
        value,
      })),
    ],
  );
  assert.deepEqual(
    record.checkpoints.map(({ actionIndex }) => actionIndex),
    [1, 2, 3, 4, 5, 6],
  );
  const original = permalinkTapeFromControlTape(record);
  assert.equal(original.kind, "converted", JSON.stringify(original));
  const fixture = await bm05ReplayFixture();
  const artifactDigest = fixture.sourceDigest.replace(/^source:/, "host:");
  const stops = await recordBm05Checkpoints(
    fixture,
    original.tape.initialConditions,
    original.tape.events,
  );
  const prefixes = checkpointPrefixes(record);
  assert.equal(stops.length, prefixes.length);
  const replay = bm05Laboratory(fixture);
  const receipts = [];
  let coinRecording;
  let coinRun;
  try {
    for (const [index, stop] of stops.entries()) {
      const prefix = prefixes[index];
      const checkpoint = record.checkpoints[index];
      assert.ok(prefix && checkpoint);
      const converted = permalinkTapeFromControlTape(prefix.record);
      assert.equal(converted.kind, "converted", JSON.stringify(converted));
      assert.deepEqual(stop.tape.initialConditions, converted.tape.initialConditions);
      assert.deepEqual(stop.tape.events, converted.tape.events);
      assert.deepEqual(
        stop.tape.acceptedCheckpoint.scientificState,
        converted.tape.acceptedCheckpoint.scientificState,
        "The full grid, seed and all 2000 stream positions must stay unchanged.",
      );
      assert.equal(stop.publication.stepIndex, checkpoint.stepIndex);
      assert.equal(stop.publication.simulationTime, checkpoint.simulatedTime);
      assert.equal(stop.publication.parameters.n, [4, 16, 64, 400, 400, 400][index]);
      assert.equal(
        stop.publication.parameters.kernel,
        index < 4 ? "coin" : index === 4 ? "uniform" : "gaussian",
      );
      const recording = stop.publication.recordingCheckpoint;
      assert.ok(recording, "The worker must supply its complete-trajectory receipt.");
      assert.equal(recording.sourceDigest, fixture.sourceDigest);
      assert.equal(recording.coordinateCount, 2000 * 401);
      assert.equal(recording.draws, index === 5 ? 1_600_000 : 800_000);
      assert.match(recording.trajectoryDigest, /^host:sha256:[a-f0-9]{64}$/);
      if (index === 0) {
        coinRecording = recording;
        coinRun = stop.publication.runId;
      } else if (index < 4) {
        assert.deepEqual(
          recording,
          coinRecording,
          "Observing a later step must retain the same complete coin trial.",
        );
        assert.equal(stop.publication.runId, coinRun);
      }
      const values = expectedValues(stop.publication, checkpoint, record.constantSetId);
      const { teachingTapeRef: _reference, ...authored } = converted.tape;
      const tape = {
        ...authored,
        modelIdentity: { ...authored.modelIdentity, artifactDigest },
        acceptedCheckpoint: {
          ...authored.acceptedCheckpoint,
          digest: stop.tape.acceptedCheckpoint.digest,
        },
      };
      const href = `/lab/bm-05/?tape=${encodeTapePermalink(tape)}`;
      assert.ok(
        href.length <= MAX_PERMALINK_URL_LENGTH,
        "The checkpoint must fit its bounded link.",
      );
      const decoded = decodeTapePermalink(href);
      assert.equal(decoded.kind, "success", JSON.stringify(decoded));
      assert.deepEqual(decoded.tape, tape);
      const restored = await restoreWorkerTape(replay.binding, replay.session, decoded.tape);
      assert.deepEqual(
        restored,
        { kind: "restored" },
        `Checkpoint ${checkpoint.actionIndex}: ${JSON.stringify(restored)}`,
      );
      const accepted = replay.session.getSnapshot().accepted;
      assert.ok(accepted?.final, "The replay must accept a completed scientific publication.");
      expectedValues(accepted, checkpoint, record.constantSetId);
      receipts.push({
        actionIndex: checkpoint.actionIndex,
        digest: tape.acceptedCheckpoint.digest,
        recordingDigest: recording.digest,
        trajectoryDigest: recording.trajectoryDigest,
        coordinateCount: recording.coordinateCount,
        draws: recording.draws,
        drawOwner: recording.ownerId,
        normalVersion: recording.normalVersion,
        stepIndex: checkpoint.stepIndex,
        simulatedTime: checkpoint.simulatedTime,
        streamPositions: tape.acceptedCheckpoint.scientificState.streamPositions.length,
        boundedLinkLength: href.length,
        expectedDisplayValues: values,
      });
    }
  } finally {
    replay.session.disconnect();
  }
  return {
    event: "bm05-authored-tape-recorded",
    tapeId: record.tapeId,
    runtime: {
      node: process.versions.node,
      v8: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
    },
    previousArtifactDigest: record.modelIdentity.artifactDigest,
    sourceDigest: fixture.sourceDigest,
    artifactDigest,
    expectedDisplayValuesUnchanged: true,
    scientificStreamPositionsUnchanged: true,
    boundedLinksReplayed: receipts.length,
    checkpoints: receipts,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const record = validateControlTape(
    parseYaml(
      await readFile(
        new URL("../content/experiments/tapes/coin-to-bell.yaml", import.meta.url),
        "utf8",
      ),
    ),
  );
  console.log(JSON.stringify(await recordCoinToBell(record), null, 2));
}
