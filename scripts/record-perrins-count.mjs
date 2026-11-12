/**
 * Re-record only the source-bound receipts of the authored synthetic Perrin exercise.
 * Run after prepare:lab with Node 22.13.1:
 *   node --experimental-strip-types scripts/record-perrins-count.mjs
 *
 * This is a read-only recorder: expected values, controls and scientific stream positions must
 * already agree, and both fresh links must replay before any replacement digests are printed.
 * Keep this outside generate-inference.mjs's evaluator closure so recording cannot change it.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatorSources } from "./generate-inference.mjs";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { BM07_DEFAULTS } from "../src/experiments/bm07/definition.ts";
import { createBm07TapeBinding } from "../src/experiments/bm07/tape.ts";
import {
  bm07CheckpointDigest,
  bm07ScientificState,
} from "../src/experiments/bm07/tapeCheckpoint.ts";
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
import { createBm07Host } from "../src/workers/host/bm07Host.ts";
import { createBm07Recording, measureBm07 } from "../src/workers/operations/bm07.ts";

function expectedValues(snapshot, checkpoint) {
  return (checkpoint.expectedDisplayValues ?? []).map((expected) => {
    const actual = snapshot.outputs.find((output) => output.quantityId === expected.outputId);
    assert.ok(actual, expected.outputId);
    assert.equal(actual.status, "value", expected.outputId);
    assert.equal(actual.value, expected.value, expected.label);
    assert.equal(actual.unit, expected.unit, expected.label);
    assert.equal(snapshot.parameters.constantSetId, expected.constantSetId, expected.label);
    return {
      label: expected.label,
      outputId: actual.quantityId,
      value: actual.value,
      unit: actual.unit,
      constantSetId: snapshot.parameters.constantSetId,
    };
  });
}

function assertScientificState(parameters, checkpoint) {
  const actual = bm07ScientificState(parameters);
  for (const key of [
    "checkpointVersion",
    "streamSemanticsVersion",
    "stepIndex",
    "simulatedTime",
    "seed",
  ])
    assert.equal(actual[key], checkpoint[key], key);
  assert.equal(actual.streamPositions.length, 4097);
  assert.equal(checkpoint.streamPositions.length, actual.streamPositions.length);
  for (const [index, position] of actual.streamPositions.entries())
    assert.deepEqual(position, checkpoint.streamPositions[index], "Stream position " + index);
}

/** Takes the validated authored record; returns receipts only after real capture and replay. */
export async function recordPerrinsCount(record) {
  assert.equal(process.versions.bun, undefined, "The authored recorder requires Node, not Bun.");
  assert.equal(process.versions.node, "22.13.1", "Use the declared Node 22.13.1 / V8 recorder.");
  assert.equal(record.tapeId, "perrins-count");
  assert.equal(record.experimentId, "bm-07");
  assert.equal(record.mode, "bm-07:default");
  assert.equal(record.initialConditions.observationSet, "synthetic");
  assert.deepEqual(Object.keys(record.initialConditions).sort(), Object.keys(BM07_DEFAULTS).sort());
  assert.deepEqual(record.checkpoints.map((checkpoint) => checkpoint.actionIndex), [0, 1]);
  assert.equal(record.events.length, 1);
  assert.deepEqual(
    {
      kind: record.events[0].kind,
      actionIndex: record.events[0].actionIndex,
      commandClass: record.events[0].commandClass,
      parameterId: record.events[0].parameterId,
      value: record.events[0].value,
      previousValue: record.events[0].previousValue,
    },
    {
      kind: "control",
      actionIndex: 1,
      commandClass: "estimator-change",
      parameterId: "radiusKnown",
      value: "true",
      previousValue: "false",
    },
  );

  const sources = await evaluatorSources();
  const hash = createHash("sha256");
  for (const [path, source] of sources)
    hash.update(path + "\0" + Buffer.byteLength(source) + "\0").update(source);
  const sourceDigest = "source:sha256:" + hash.digest("hex");
  const artifactDigest = sourceDigest.replace(/^source:/, "host:");
  const recording = await createBm07Recording(BM07_DEFAULTS, { yieldControl: async () => {} });
  assert.equal(recording.kind, "accepted");
  const evaluated = await measureBm07(recording.data, BM07_DEFAULTS, false);
  assert.equal(evaluated.kind, "accepted");
  const example = {
    sourceDigest,
    parameters: BM07_DEFAULTS,
    results: evaluated.data.outputs.map(encodeResult),
    stepIndex: evaluated.data.stepIndex,
    simulationTime: evaluated.data.simulationTime,
  };
  const counts = { created: 0, disposed: 0 };
  const binding = createBm07TapeBinding(example, () => {
    counts.created++;
    let listener = null;
    let onError = null;
    const host = createBm07Host((message) => listener?.(structuredClone(message)), sourceDigest);
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
  const live = binding.createSession("record-authored-perrins-count");
  const replay = binding.createSession("verify-recorded-perrins-count");
  const receipts = [];
  let firstRun;
  let firstObservationDigest;
  let firstRecordingDigest;
  try {
    for (const prefix of checkpointPrefixes(record)) {
      const checkpoint = prefix.record.checkpoints[0];
      const parameters = {
        ...BM07_DEFAULTS,
        ...settingsFromTape(prefix.settings, BM07_DEFAULTS),
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
      const calculated = await bm07CheckpointDigest(publication, sourceDigest, prefix.actionIndex);
      assert.equal(calculated.kind, "digest", JSON.stringify(calculated));
      const snapshot = live.getSnapshot().accepted;
      assert.ok(snapshot);
      const values = expectedValues(snapshot, checkpoint);
      const output = (id) => snapshot.outputs.find((value) => value.quantityId === id);
      const completeRecording = publication.recordingCheckpoint;
      assert.ok(completeRecording);
      if (prefix.actionIndex === 0) {
        firstRun = snapshot.runId;
        firstObservationDigest = output("observationDigest").value;
        firstRecordingDigest = completeRecording.digest;
      } else {
        assert.equal(snapshot.runId, firstRun, "Declaring a radius must retain the same run.");
        assert.equal(output("observationDigest").value, firstObservationDigest);
        assert.equal(completeRecording.digest, firstRecordingDigest);
        assert.equal(output("requestDraws").value, 0);
      }
      receipts.push({
        actionIndex: prefix.actionIndex,
        digest: calculated.digest,
        recordingDigest: completeRecording.digest,
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
      assert.ok(encoded.length <= 2048, "The recorded checkpoint must fit the bounded link.");
      const decoded = decodeTapePermalink(encoded);
      assert.equal(decoded.kind, "success", JSON.stringify(decoded));
      const restored = await restoreWorkerTape(binding, replay, decoded.tape, { timeoutMs: 10000 });
      assert.deepEqual(
        restored,
        { kind: "restored" },
        "Checkpoint " + prefix.actionIndex + ": " + JSON.stringify(restored),
      );
      const snapshot = replay.getSnapshot().accepted;
      assert.ok(snapshot);
      expectedValues(snapshot, prefix.record.checkpoints[0]);
      assertScientificState(snapshot.parameters, prefix.record.checkpoints[0]);
      receipts[index].boundedLinkLength = encoded.length;
    }
  } finally {
    live.disconnect();
    replay.disconnect();
  }
  assert.equal(counts.created, counts.disposed, "Every recorder worker must be released.");
  return {
    event: "bm07-authored-tape-recorded",
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
    boundedLinksReplayed: receipts.length,
    checkpoints: receipts,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const record = validateControlTape(
    parseYaml(
      await readFile(
        new URL("../content/experiments/tapes/perrins-count.yaml", import.meta.url),
        "utf8",
      ),
    ),
  );
  console.log(JSON.stringify(await recordPerrinsCount(record)));
}
