import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bm01ComparisonIdentity } from "../../experiments/bm01/comparison.ts";
import { createBm01ComparisonSession } from "../../experiments/bm01/comparisonSession.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { createBm01Host } from "../../workers/host/bm01Host.ts";
import { createBm01Recording, measureBm01 } from "../../workers/operations/bm01.ts";
import { captureComparisonReplay } from "./replayEntry.ts";
import { createComparisonReplayRunner } from "./replayRunner.ts";

const original = JSON.parse(
  await readFile(new URL("../../generated/bm01-comparison.json", import.meta.url), "utf8"),
);
const p = { ...original.baseline.parameters, M: 24, H: 4, h: 0.1, seed: "18446744073709551615" };
async function exampleFor(parameters) {
  const recording = await createBm01Recording(parameters, { yieldControl: async () => {} });
  assert.equal(recording.kind, "accepted");
  const measured = measureBm01(recording.data, parameters, false);
  assert.equal(measured.kind, "accepted");
  return {
    ...original.baseline,
    parameters,
    results: measured.data.outputs.map(encodeResult),
    stepIndex: measured.data.stepIndex,
    simulationTime: measured.data.simulationTime,
  };
}
const example = {
  ...original,
  baseline: await exampleFor(p),
  doubledRadius: await exampleFor({ ...p, a: p.a * 2 }),
};
const identity = bm01ComparisonIdentity(example);
const staticState = createBm01ComparisonSession("saved-evidence", example, () => {
  throw Error("No worker on construction");
}).getServerSnapshot();
const replay = await captureComparisonReplay(
  staticState,
  { contentRevision: null, translationRevision: null },
  { before: "my prediction", after: "my explanation" },
);
function transport() {
  const metrics = { created: 0, disposed: 0, replies: [], errors: [] };
  function factory() {
    metrics.created++;
    let listener = () => {},
      error = () => {};
    const host = createBm01Host((message) => {
      metrics.replies.push(message);
      listener(structuredClone(message));
    }, example.baseline.sourceDigest);
    return {
      send(message) {
        void host.receive(structuredClone(message)).catch((e) => {
          metrics.errors.push(e);
          error();
        });
      },
      listen(next, failed) {
        listener = next;
        error = failed;
        queueMicrotask(() => host.hello());
        return () => {
          listener = () => {};
          error = () => {};
        };
      },
      dispose() {
        metrics.disposed++;
        host.dispose();
      },
    };
  }
  return { metrics, factory };
}
async function finish(runner, allowChanged = false) {
  await runner.start(allowChanged);
  const deadline = Date.now() + 10000;
  while (["checking", "baseline", "variant"].includes(runner.getSnapshot().phase)) {
    if (Date.now() > deadline) throw Error("Replay timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
  return runner.getSnapshot();
}
test("the real scheduler, codec, store and owner reproduce a saved setup comparison", async () => {
  const { factory, metrics } = transport();
  const runner = createComparisonReplayRunner(replay, {
    example: example.baseline,
    identity,
    workerFactory: factory,
  });
  assert.equal(metrics.created, 0);
  assert.equal(runner.getSnapshot().phase, "idle");
  const result = await finish(runner);
  assert.equal(result.phase, "complete", result.message);
  assert.equal(result.reproduction, "matching-scalars");
  assert.notEqual(result.baseline.instanceId, replay.baseline.instanceId);
  assert.notEqual(result.baseline.runId, result.variant.runId);
  assert.equal(result.variant.parameters.seed, "18446744073709551615");
  assert.equal(metrics.created, 1);
  assert.equal(metrics.disposed, 1);
  assert.deepEqual(metrics.errors, []);
  runner.dispose();
});
test("a measurement replay warms one recording then reuses it without a new run", async () => {
  const { factory, metrics } = transport();
  const comparison = createBm01ComparisonSession("saved-measurement", example, factory);
  comparison.connect();
  comparison.start();
  async function settled() {
    const end = Date.now() + 10000;
    while (comparison.getSnapshot().pending) {
      if (Date.now() > end) throw Error("Timeout");
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  await settled();
  assert.equal(comparison.apply({ ...p, interval: 4 }), true);
  await settled();
  const saved = await captureComparisonReplay(
    comparison.getSnapshot(),
    { contentRevision: null, translationRevision: null },
    { before: "", after: "" },
  );
  comparison.disconnect();
  const runner = createComparisonReplayRunner(saved, {
    example: example.baseline,
    identity,
    workerFactory: factory,
  });
  const result = await finish(runner);
  assert.equal(result.phase, "complete", result.message);
  assert.equal(result.reproduction, "matching-scalars");
  assert.equal(result.baseline.runId, result.variant.runId);
  const last = metrics.replies.filter((r) => r.messageKind === "result").at(-1);
  assert.equal(last.result.data.outputs.find((o) => o.quantityId === "reusedRecording").value, 1);
  runner.dispose();
});
test("altered saved scalar checkpoint is rejected before creating a worker", async () => {
  const changed = JSON.parse(JSON.stringify(replay));
  changed.variant.outputs.sampleRms.value *= 2;
  const { factory, metrics } = transport();
  const runner = createComparisonReplayRunner(changed, {
    example: example.baseline,
    identity,
    workerFactory: factory,
  });
  const result = await finish(runner);
  assert.equal(result.phase, "failed");
  assert.match(result.message, /checkpoint/);
  assert.equal(metrics.created, 0);
});
test("changed model requires explicit consent and never marks old results reproduced", async () => {
  const { factory, metrics } = transport();
  const runner = createComparisonReplayRunner(replay, {
    example: example.baseline,
    identity: { ...identity, modelVersion: "a-new-model" },
    workerFactory: factory,
  });
  assert.equal((await finish(runner)).phase, "failed");
  assert.equal(metrics.created, 0);
  const result = await finish(runner, true);
  assert.equal(result.phase, "complete", result.message);
  assert.equal(result.reproduction, "new-model");
  assert.equal(replay.variant.identity.modelVersion, identity.modelVersion);
});
test("stop during asynchronous checkpoint verification prevents worker creation", async () => {
  const { factory, metrics } = transport();
  const runner = createComparisonReplayRunner(replay, {
    example: example.baseline,
    identity,
    workerFactory: factory,
  });
  const started = runner.start();
  runner.stop();
  await started;
  assert.equal(runner.getSnapshot().phase, "stopped");
  assert.equal(metrics.created, 0);
});
test("reusing a saved instance identity is refused", async () => {
  const { factory, metrics } = transport();
  const runner = createComparisonReplayRunner(replay, {
    example: example.baseline,
    identity,
    workerFactory: factory,
    newInstanceId: () => replay.baseline.instanceId,
  });
  assert.equal((await finish(runner)).phase, "failed");
  assert.equal(metrics.created, 0);
});
test("dispose during computation terminates the worker and no late result publishes", async () => {
  const { factory, metrics } = transport();
  const runner = createComparisonReplayRunner(replay, {
    example: example.baseline,
    identity,
    workerFactory: factory,
  });
  await runner.start();
  runner.dispose();
  const before = runner.getSnapshot();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(runner.getSnapshot(), before);
  assert.equal(metrics.disposed, metrics.created);
});
