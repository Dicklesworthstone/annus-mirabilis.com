/**
 * Re-record only the source-bound receipts of the authored synthetic camera exercise.
 * Run after prepare:lab with Node 22.13.1:
 *   node --experimental-strip-types scripts/record-camera-bias.mjs
 *
 * This read-only recorder preserves the authored controls, values and stream positions. The
 * physical recording must stay fixed while camera observations change, and all three refreshed
 * bounded links must replay before replacement receipts are printed. No YAML is rewritten.
 * Keep this outside generate-observation.mjs's evaluator closure so recording cannot change it.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatorSources } from "./generate-observation.mjs";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { BM08_DEFAULTS } from "../src/experiments/bm08/definition.ts";
import { createBm08TapeBinding } from "../src/experiments/bm08/tape.ts";
import {
  bm08CheckpointDigest,
  bm08ScientificState,
} from "../src/experiments/bm08/tapeCheckpoint.ts";
import { scientificDigest } from "../src/experiments/digest/scientificDigest.ts";
import {
  decodeTapePermalink,
  encodeTapePermalink,
} from "../src/experiments/permalink/codec.ts";
import { permalinkTapeFromControlTape } from "../src/experiments/permalink/fromControlTape.ts";
import { settingsFromTape } from "../src/experiments/permalink/sessionTape.ts";
import { checkpointPrefixes } from "../src/experiments/permalink/walkthroughCheckpoints.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
} from "../src/experiments/permalink/workerSessionTape.ts";
import { encodeResult } from "../src/experiments/results/codec.ts";
import { validateControlTape } from "../src/experiments/tapes/schema.ts";
import { createBm08Host } from "../src/workers/host/bm08Host.ts";
import { createBm08Recording, measureBm08 } from "../src/workers/operations/bm08.ts";

function expectedValues(snapshot, checkpoint, constantSetId) {
  return (checkpoint.expectedDisplayValues ?? []).map((expected) => {
    const actual = snapshot.outputs.find((output) => output.quantityId === expected.outputId);
    assert.ok(actual, expected.outputId);
    assert.equal(actual.status, "value", expected.outputId);
    assert.equal(actual.value, expected.value, expected.label);
    assert.equal(actual.unit, expected.unit, expected.label);
    assert.equal(constantSetId, expected.constantSetId, expected.label);
    return {
      label: expected.label,
      outputId: actual.quantityId,
      value: actual.value,
      unit: actual.unit,
      constantSetId,
    };
  });
}

function assertScientificState(parameters, checkpoint) {
  const actual = bm08ScientificState(parameters);
  for (const key of [
    "checkpointVersion",
    "streamSemanticsVersion",
    "stepIndex",
    "simulatedTime",
    "seed",
  ])
    assert.equal(actual[key], checkpoint[key], key);
  assert.deepEqual(actual.streamPositions, checkpoint.streamPositions);
}

function vector(publication, quantityId) {
  const output = publication.outputs.find((entry) => entry.quantityId === quantityId);
  assert.ok(output?.status === "value" && output.value instanceof Float64Array, quantityId);
  return output.value;
}

/** A diagnostic hash of actual observed arrays, separate from the complete scientific receipt. */
async function observationDigest(publication) {
  const { digest } = await scientificDigest({
    format: "bm08-authored-observations-v1",
    positions: vector(publication, "positions"),
    increments: vector(publication, "increments"),
    times: vector(publication, "times"),
    stationaryClicks: vector(publication, "stationaryClicks"),
  });
  return digest;
}

/** Takes the validated authored record; returns receipts only after real capture and replay. */
export async function recordCameraBias(record) {
  assert.equal(process.versions.bun, undefined, "The authored recorder requires Node, not Bun.");
  assert.equal(process.versions.node, "22.13.1", "Use the declared Node 22.13.1 / V8 recorder.");
  assert.equal(record.tapeId, "camera-bias");
  assert.equal(record.experimentId, "bm-08");
  assert.equal(record.mode, "bm-08:default");
  assert.equal(record.constantSetId, "modern-si-2019");
  assert.match(record.description, /synthetic/);
  assert.deepEqual(Object.keys(record.initialConditions).sort(), Object.keys(BM08_DEFAULTS).sort());
  assert.deepEqual(record.checkpoints.map((checkpoint) => checkpoint.actionIndex), [0, 1, 2]);
  assert.deepEqual(
    record.events.map((event) => ({
      kind: event.kind,
      actionIndex: event.actionIndex,
      commandClass: event.commandClass,
      parameterId: event.parameterId,
      value: event.value,
      previousValue: event.previousValue,
    })),
    [
      {
        kind: "control",
        actionIndex: 1,
        commandClass: "measurement-change",
        parameterId: "exposure",
        value: 0.5,
        previousValue: 0,
      },
      {
        kind: "control",
        actionIndex: 2,
        commandClass: "measurement-change",
        parameterId: "sigma",
        value: 2e-7,
        previousValue: 0,
      },
    ],
  );

  const sources = await evaluatorSources();
  const hash = createHash("sha256");
  for (const [path, source] of sources)
    hash.update(path + "\0" + Buffer.byteLength(source) + "\0").update(source);
  const sourceDigest = "source:sha256:" + hash.digest("hex");
  const artifactDigest = sourceDigest.replace(/^source:/, "host:");
  const recording = await createBm08Recording(BM08_DEFAULTS, { yieldControl: async () => {} });
  assert.equal(recording.kind, "accepted");
  const evaluated = await measureBm08(recording.data, BM08_DEFAULTS, false);
  assert.equal(evaluated.kind, "accepted");
  const example = {
    sourceDigest,
    parameters: BM08_DEFAULTS,
    results: evaluated.data.outputs.map(encodeResult),
    stepIndex: evaluated.data.stepIndex,
    simulationTime: evaluated.data.simulationTime,
  };
  const counts = { created: 0, disposed: 0 };
  const binding = createBm08TapeBinding(example, () => {
    counts.created++;
    let listener = null;
    let onError = null;
    const host = createBm08Host((message) => listener?.(structuredClone(message)), sourceDigest);
    return {
      send(message) {
        void host.receive(structuredClone(message)).catch((error) => onError?.(error));
      },
      listen(onMessage, error) {
        listener = onMessage;
        onError = error;
        queueMicrotask(() => host.hello());
        return () => {
          listener = null;
          onError = null;
        };
      },
      dispose() {
        counts.disposed++;
        listener = null;
        onError = null;
        host.dispose();
      },
    };
  });
  assert.equal(binding.environment.constantSetId, record.constantSetId);
  const live = binding.createSession("record-authored-camera-bias");
  const replay = binding.createSession("verify-recorded-camera-bias");
  const receipts = [];
  let firstRun;
  let firstRecording;
  let firstIdealPositions;
  let previousPositions;
  let previousIncrements;
  let previousBlurredPositions;
  let previousObservationDigest;
  try {
    for (const prefix of checkpointPrefixes(record)) {
      const checkpoint = prefix.record.checkpoints[0];
      const parameters = {
        ...BM08_DEFAULTS,
        ...settingsFromTape(prefix.settings, BM08_DEFAULTS),
      };
      assert.equal(parameters.seed, record.seed);
      assertScientificState(parameters, checkpoint);
      let publication;
      const applied = await applyWorkerSettings(live, parameters, {
        timeoutMs: 10000,
        verifyPublication: async (value) => {
          publication = value;
          return null;
        },
      });
      assert.deepEqual(applied, { kind: "restored" });
      assert.ok(publication, "The production owner must supply a verified publication.");
      const calculated = await bm08CheckpointDigest(publication, sourceDigest, prefix.actionIndex);
      assert.equal(calculated.kind, "digest", JSON.stringify(calculated));
      const snapshot = live.getSnapshot().accepted;
      assert.ok(snapshot);
      assert.deepEqual(snapshot.parameters, parameters);
      const values = expectedValues(snapshot, checkpoint, binding.environment.constantSetId);
      const completeRecording = publication.recordingCheckpoint;
      assert.ok(completeRecording);
      const observedDigest = await observationDigest(publication);
      const positions = vector(publication, "positions");
      const increments = vector(publication, "increments");
      const idealPositions = vector(publication, "idealPositions");
      const blurredPositions = vector(publication, "blurredPositions");
      if (prefix.actionIndex === 0) {
        firstRun = snapshot.runId;
        firstRecording = structuredClone(completeRecording);
        firstIdealPositions = idealPositions.slice();
        assert.deepEqual(positions, idealPositions);
        assert.deepEqual(blurredPositions, idealPositions);
      } else {
        assert.equal(snapshot.runId, firstRun, "Camera changes must retain the physical run.");
        assert.deepEqual(completeRecording, firstRecording, "The full path and integrals must stay fixed.");
        assert.deepEqual(idealPositions, firstIdealPositions);
        assert.notEqual(observedDigest, previousObservationDigest);
        assert.notDeepEqual(positions, previousPositions, "The camera must change the observed positions.");
        assert.notDeepEqual(increments, previousIncrements, "The camera must change the observed increments.");
        if (prefix.actionIndex === 1) {
          assert.notDeepEqual(blurredPositions, previousBlurredPositions);
          assert.deepEqual(positions, blurredPositions);
        } else {
          assert.deepEqual(blurredPositions, previousBlurredPositions, "Noise must not change exposure averages.");
        }
      }
      previousObservationDigest = observedDigest;
      previousPositions = positions.slice();
      previousIncrements = increments.slice();
      previousBlurredPositions = blurredPositions.slice();
      receipts.push({
        actionIndex: prefix.actionIndex,
        digest: calculated.digest,
        recordingDigest: completeRecording.digest,
        observationDigest: observedDigest,
        stepIndex: checkpoint.stepIndex,
        simulatedTime: checkpoint.simulatedTime,
        streamPositions: checkpoint.streamPositions.length,
        expectedDisplayValues: values,
      });
    }

    const refreshed = {
      ...record,
      modelIdentity: { ...record.modelIdentity, artifactDigest },
      checkpoints: record.checkpoints.map((checkpoint, index) => ({
        ...checkpoint,
        digest: receipts[index].digest,
      })),
    };
    for (const [index, prefix] of checkpointPrefixes(refreshed).entries()) {
      const converted = permalinkTapeFromControlTape(prefix.record);
      assert.equal(converted.kind, "converted", JSON.stringify(converted));
      const encoded = encodeTapePermalink(converted.tape);
      const linkLength = ("/lab/bm-08/?tape=" + encoded).length;
      assert.ok(linkLength <= 2048, "The recorded checkpoint must fit the bounded link.");
      const decoded = decodeTapePermalink(encoded);
      assert.equal(decoded.kind, "success", JSON.stringify(decoded));
      const restored = await restoreWorkerTape(binding, replay, decoded.tape, { timeoutMs: 10000 });
      assert.deepEqual(
        restored,
        { kind: "restored" },
        "Checkpoint " + prefix.actionIndex + ": " + JSON.stringify(restored),
      );
      const snapshot = replay.getSnapshot().accepted;
      const publication = replay.acceptedPublication?.();
      assert.ok(snapshot && publication);
      assert.deepEqual(snapshot.parameters, {
        ...BM08_DEFAULTS,
        ...settingsFromTape(prefix.settings, BM08_DEFAULTS),
      });
      expectedValues(snapshot, prefix.record.checkpoints[0], binding.environment.constantSetId);
      assertScientificState(snapshot.parameters, prefix.record.checkpoints[0]);
      assert.deepEqual(publication.recordingCheckpoint, firstRecording);
      assert.equal(await observationDigest(publication), receipts[index].observationDigest);
      receipts[index].boundedLinkLength = linkLength;
    }
  } finally {
    live.disconnect();
    replay.disconnect();
  }
  assert.equal(counts.created, counts.disposed, "Every recorder worker must be released.");
  return {
    event: "bm08-authored-tape-recorded",
    tapeId: record.tapeId,
    runtime: {
      node: process.versions.node,
      v8: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
    },
    previousArtifactDigest: record.modelIdentity.artifactDigest,
    sourceDigest,
    artifactDigest,
    sourceFiles: sources.length,
    expectedDisplayValuesUnchanged: true,
    scientificStreamPositionsUnchanged: true,
    physicalRecordingUnchanged: true,
    cameraObservationsChanged: true,
    boundedLinksReplayed: receipts.length,
    checkpoints: receipts,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const record = validateControlTape(
    parseYaml(
      await readFile(
        new URL("../content/experiments/tapes/camera-bias.yaml", import.meta.url),
        "utf8",
      ),
    ),
  );
  console.log(JSON.stringify(await recordCameraBias(record)));
}
