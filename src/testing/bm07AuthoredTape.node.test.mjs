import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluatorSources } from "../../scripts/generate-inference.mjs";
import { parseYaml } from "../content/provenance/yaml.ts";
import { BM07_DEFAULTS } from "../experiments/bm07/definition.ts";
import { createBm07TapeBinding } from "../experiments/bm07/tape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { permalinkTapeFromControlTape } from "../experiments/permalink/fromControlTape.ts";
import { checkpointPrefixes } from "../experiments/permalink/walkthroughCheckpoints.ts";
import { restoreWorkerTape } from "../experiments/permalink/workerSessionTape.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { validateControlTape } from "../experiments/tapes/schema.ts";
import { createBm07Host } from "../workers/host/bm07Host.ts";
import { createBm07Recording, measureBm07 } from "../workers/operations/bm07.ts";

// The authored path is pinned to the declared Node/V8 recorder. The runtime-local replay and
// corruption tests remain in bm07Tape.test.mjs for Bun as well; host math is not cross-engine exact.
const hash = createHash("sha256");
for (const [path, source] of await evaluatorSources())
  hash.update(`${path}\0${Buffer.byteLength(source)}\0`).update(source);
const sourceDigest = `source:sha256:${hash.digest("hex")}`;
const record = validateControlTape(
  parseYaml(
    await readFile(
      new URL("../../content/experiments/tapes/perrins-count.yaml", import.meta.url),
      "utf8",
    ),
  ),
);

test("Perrin's count identifies the actual synthetic model and complete current evaluator source", () => {
  assert.equal(record.modelIdentity.artifactDigest, sourceDigest.replace(/^source:/, "host:"));
  assert.equal(record.mode, "bm-07:default");
  assert.equal(record.constantSetId, "scenario-bm07-hidden-number");
  assert.equal(record.initialConditions.observationSet, "synthetic");
  assert.match(record.title, /synthetic/);
  assert.deepEqual(Object.keys(record.initialConditions).sort(), Object.keys(BM07_DEFAULTS).sort());
  assert.ok(record.checkpoints.every((checkpoint) => checkpoint.streamPositions.length === 4097));
});

test("every authored Perrin checkpoint replays through its bounded link and production publication verifier", async (t) => {
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
  const binding = createBm07TapeBinding(example, () => {
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
        listener = null;
        onError = null;
        host.dispose();
      },
    };
  });
  const live = binding.createSession("authored-perrins-count");
  t.after(() => live.disconnect());
  for (const prefix of checkpointPrefixes(record)) {
    const converted = permalinkTapeFromControlTape(prefix.record);
    assert.equal(converted.kind, "converted");
    const encoded = encodeTapePermalink(converted.tape);
    assert.ok(encoded.length <= 2048);
    const decoded = decodeTapePermalink(encoded);
    assert.equal(decoded.kind, "success");
    const restored = await restoreWorkerTape(binding, live, decoded.tape);
    assert.deepEqual(
      restored,
      { kind: "restored" },
      `Checkpoint ${prefix.actionIndex}: ${JSON.stringify(restored)}`,
    );
    const snapshot = live.getSnapshot().accepted;
    assert.equal(snapshot.parameters.radiusKnown, prefix.actionIndex === 1);
    for (const expected of prefix.record.checkpoints[0].expectedDisplayValues ?? []) {
      const actual = snapshot.outputs.find((output) => output.quantityId === expected.outputId);
      assert.equal(actual.status, "value");
      assert.equal(actual.value, expected.value, expected.label);
      assert.equal(actual.unit, expected.unit);
      assert.equal(expected.constantSetId, snapshot.parameters.constantSetId);
    }
  }
});
