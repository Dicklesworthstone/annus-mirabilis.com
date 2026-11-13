import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BM01_DEFAULTS } from "../../experiments/bm01/definition.ts";
import { bm08ComparisonIdentity } from "../../experiments/bm08/comparison.ts";
import { createBm08ComparisonSession } from "../../experiments/bm08/comparisonSession.ts";
import { BM08_DEFAULTS } from "../../experiments/bm08/definition.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { createBm08Host } from "../../workers/host/bm08Host.ts";
import { createBm08Recording, measureBm08 } from "../../workers/operations/bm08.ts";
import { comparisonReplayAdapter, comparisonReplayAdapterForKind } from "./comparisonAdapters.ts";
import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
import { createNotebookStore } from "./notebookStore.ts";
import { predictionForAccepted, predictionIntent } from "./predictionIntent.ts";
import {
  captureComparisonReplay,
  parseComparisonReplay,
  verifyReplayEvidence,
} from "./replayEntry.ts";
import { createComparisonReplayRunner } from "./replayRunner.ts";
import { makeReplayEntry, saveComparisonReplay } from "./saveReplay.ts";
import { emptyNotebook, NOTEBOOK_KEY, notebookFrameHref } from "./schema.ts";
import { createNotebookStorage } from "./storage.ts";

// Only the Worker transport is replaced. Recording, observations, estimators, codecs,
// scheduler, notebook storage and replay all run their production implementations.
const parameters = {
  ...BM08_DEFAULTS,
  M: 12,
  seed: "18446744073709551615",
  noiseSeed: "18446744073709551614",
  clickSeed: "18446744073709551613",
};
const sourceDigest = `source:sha256:${"d".repeat(64)}`; // Fixture identity, not a production provenance claim.
const recording = await createBm08Recording(parameters, { yieldControl: async () => {} });
assert.equal(recording.kind, "accepted");
const evaluated = await measureBm08(recording.data, parameters, false);
assert.equal(evaluated.kind, "accepted");
const example = {
  parameters,
  sourceDigest,
  results: evaluated.data.outputs.map(encodeResult),
  stepIndex: evaluated.data.stepIndex,
  simulationTime: evaluated.data.simulationTime,
};
const identity = bm08ComparisonIdentity(example);
const passage = { contentRevision: "a".repeat(64), translationRevision: null };
const words = {
  before: "Private <script>secret()</script>",
  after: "Camera ≠ particle",
  notes: "My own explanation",
};

function transport(intercept = (message, deliver) => deliver(message)) {
  const metrics = {
    created: 0,
    disposed: 0,
    replies: [],
    requests: [],
    failures: [],
    listeners: [],
  };
  function factory() {
    metrics.created++;
    let listener = () => {},
      failed = () => {};
    const host = createBm08Host((message) => {
      metrics.replies.push(structuredClone(message));
      intercept(structuredClone(message), (reply) => listener(structuredClone(reply)));
    }, sourceDigest);
    return {
      send(message) {
        metrics.requests.push(structuredClone(message));
        void host.receive(structuredClone(message)).catch((error) => {
          metrics.failures.push(error);
          failed();
        });
      },
      listen(next, error) {
        listener = next;
        failed = error;
        metrics.listeners.push(next);
        queueMicrotask(() => host.hello());
        return () => {
          listener = () => {};
          failed = () => {};
        };
      },
      dispose() {
        metrics.disposed++;
        host.dispose();
      },
    };
  }
  return { factory, metrics };
}
async function until(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) assert.fail("Camera comparison did not settle");
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}
async function controlled(change) {
  const io = transport();
  const controller = createBm08ComparisonSession(
    `saved-camera-${crypto.randomUUID()}`,
    example,
    io.factory,
  );
  assert.equal(io.metrics.created, 0);
  controller.connect();
  controller.start();
  await until(() => !controller.getSnapshot().pending);
  const baseline = controller.getSnapshot();
  const requested = { ...baseline.variant.parameters, ...change };
  const intent = predictionIntent("larger", baseline, requested);
  assert.equal(controller.apply(requested), true);
  assert.equal(predictionForAccepted(intent, controller.getSnapshot()), null);
  await until(() => !controller.getSnapshot().pending);
  const state = controller.getSnapshot();
  assert.equal(state.error, "");
  assert.equal(state.result.kind, "accepted");
  assert.equal(predictionForAccepted(intent, state), "larger");
  controller.disconnect();
  assert.deepEqual(io.metrics.failures, []);
  return state;
}
const cameraState = await controlled({ sigma: 0.4e-6 });
const input = { state: cameraState, passage, ...words, prediction: "larger" };
const cameraEntry = await makeReplayEntry(input, "camera-saved", "2026-11-09T12:00:00.000Z");

function storage(mode = "ok") {
  const records = new Map();
  const backend = {
    get length() {
      if (mode === "blocked") throw Error("blocked");
      return records.size;
    },
    key: (i) => [...records.keys()][i] ?? null,
    getItem: (key) => records.get(key) ?? null,
    setItem(key, value) {
      if (mode === "quota") throw new DOMException("Full", "QuotaExceededError");
      records.set(key, value);
    },
    removeItem: (key) => records.delete(key),
    clear: () => records.clear(),
  };
  const context = createStorageContext({ getStorage: () => backend });
  return { records, store: () => createNotebookStore(createNotebookStorage(context)) };
}
function runner(replay, io, patch = {}) {
  return createComparisonReplayRunner(replay, {
    instrumentId: "bm-08",
    example,
    identity,
    workerFactory: io.factory,
    ...patch,
  });
}
async function finish(run, allowChanged = false) {
  await run.start(allowChanged);
  await until(() => !["checking", "baseline", "variant"].includes(run.getSnapshot().phase));
  return run.getSnapshot();
}
const scalar = (message, id) =>
  message.result.data.outputs.find((output) => output.quantityId === id).value;

test("camera save → persistent notebook reload → explicit owner rerun preserves all three seeds and its single measurement change", async () => {
  const saved = storage(),
    store = saved.store();
  assert.equal((await saveComparisonReplay(store, input)).ok, true);
  assert.deepEqual([...saved.records.keys()], [NOTEBOOK_KEY]);
  const loaded = saved.store();
  loaded.open();
  const entry = loaded.getSnapshot().document.entries[0];
  assert.equal(entry.title, "My controlled camera comparison");
  assert.equal(entry.frame.anchor, "arg-bm-inference");
  assert.equal(entry.replay.kind, "bm08-comparison");
  assert.equal(entry.replay.tape.events[0].commandClass, "measurement-change");
  assert.equal(entry.replay.tape.events[0].paramId, "sigma");
  assert.equal(entry.replay.tape.replayGrid, undefined);
  assert.equal(
    entry.replay.tape.predictions[0].promptId,
    "bm-08-predict-comparison-naive-diffusion",
  );
  assert.equal(entry.replay.explanationBefore, words.before);
  assert.equal(await verifyReplayEvidence(entry.replay), true);
  const io = transport(),
    run = runner(entry.replay, io);
  assert.equal(io.metrics.created, 0);
  assert.equal(run.getSnapshot().phase, "idle");
  const result = await finish(run);
  assert.equal(result.phase, "complete", result.message);
  assert.equal(result.reproduction, "matching-scalars");
  assert.equal(result.baseline.runId, result.variant.runId);
  assert.notEqual(result.baseline.instanceId, entry.replay.baseline.instanceId);
  for (const key of ["seed", "noiseSeed", "clickSeed"])
    assert.equal(result.variant.parameters[key], parameters[key]);
  const last = io.metrics.replies.filter((message) => message.messageKind === "result").at(-1);
  assert.equal(scalar(last, "reusedRecording"), 1);
  assert.equal(scalar(last, "requestDraws"), 0);
  assert.ok(scalar(last, "measurementDraws") > 0);
  assert.equal(io.metrics.created, 1);
  assert.equal(io.metrics.disposed, 1);
  assert.deepEqual(io.metrics.failures, []);
  assert.deepEqual(loaded.getSnapshot().document.entries[0], entry);
  run.dispose();
});

test("an estimator replay reuses the same observed camera frames and calibration clicks", async () => {
  const state = await controlled({ noiseMethod: "known" });
  const entry = await makeReplayEntry({ ...input, state });
  assert.equal(entry.replay.tape.events[0].commandClass, "estimator-change");
  const io = transport(),
    run = runner(entry.replay, io);
  const result = await finish(run);
  assert.equal(result.phase, "complete", result.message);
  assert.equal(result.reproduction, "matching-scalars");
  const [a, b] = io.metrics.replies.filter((message) => message.messageKind === "result");
  assert.equal(scalar(b, "reusedObservation"), 1);
  assert.equal(scalar(b, "measurementDraws"), 0);
  for (const id of ["positions", "increments", "stationaryClicks"])
    assert.deepEqual(
      b.result.data.outputs.find((o) => o.quantityId === id),
      a.result.data.outputs.find((o) => o.quantityId === id),
    );
  run.dispose();
});

test("a notebook replay hidden before its asynchronous owner exists waits without starting a worker", async () => {
  const io = transport(),
    run = runner(cameraEntry.replay, io);
  run.setSchedulingPaused(true);
  try {
    await run.start();
    assert.equal(run.getSnapshot().phase, "baseline");
    assert.equal(run.getSnapshot().baseline, null);
    assert.equal(io.metrics.created, 0);
    run.setSchedulingPaused(false);
    await until(() => run.getSnapshot().phase === "complete");
    assert.equal(run.getSnapshot().reproduction, "matching-scalars");
    assert.equal(io.metrics.created, 1);
    assert.equal(io.metrics.disposed, 1);
    assert.equal(run.getSnapshot().baseline.runId, run.getSnapshot().variant.runId);
  } finally {
    run.dispose();
  }
});

test("hiding between the notebook baseline and variant queues the same camera run until it is visible", async () => {
  const io = transport(),
    run = runner(cameraEntry.replay, io);
  const off = run.subscribe(() => {
    const state = run.getSnapshot();
    if (state.phase === "baseline" && state.baseline) run.setSchedulingPaused(true);
  });
  try {
    await run.start();
    await until(() => run.getSnapshot().phase === "variant");
    const baseline = run.getSnapshot().baseline;
    assert.ok(baseline);
    assert.equal(run.getSnapshot().variant, null);
    assert.equal(run.getSnapshot().result, null);
    assert.equal(io.metrics.requests.filter((m) => m.messageKind === "request").length, 1);
    run.setSchedulingPaused(false);
    await until(() => run.getSnapshot().phase === "complete");
    assert.equal(run.getSnapshot().baseline, baseline);
    assert.equal(run.getSnapshot().variant.runId, baseline.runId);
    assert.equal(run.getSnapshot().reproduction, "matching-scalars");
    const variant = io.metrics.replies.filter((m) => m.messageKind === "result").at(-1);
    assert.equal(scalar(variant, "reusedRecording"), 1);
    assert.equal(scalar(variant, "requestDraws"), 0);
    assert.equal(io.metrics.created, 1);
    assert.equal(io.metrics.disposed, 1);
  } finally {
    off();
    run.dispose();
  }
});

for (const betweenPhases of [false, true]) {
  test(`cancelling a hidden notebook replay ${betweenPhases ? "between phases" : "before start"} cannot resume or publish a partial comparison`, async () => {
    const io = transport(),
      run = runner(cameraEntry.replay, io);
    const off = run.subscribe(() => {
      const state = run.getSnapshot();
      if (betweenPhases && state.phase === "baseline" && state.baseline)
        run.setSchedulingPaused(true);
    });
    if (!betweenPhases) run.setSchedulingPaused(true);
    try {
      await run.start();
      if (betweenPhases) await until(() => run.getSnapshot().phase === "variant");
      run.stop();
      const stopped = run.getSnapshot();
      assert.equal(stopped.phase, "stopped");
      assert.equal(stopped.baseline, null);
      assert.equal(stopped.variant, null);
      assert.equal(stopped.result, null);
      const requests = io.metrics.requests.length;
      run.setSchedulingPaused(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(run.getSnapshot(), stopped);
      assert.equal(io.metrics.requests.length, requests);
      assert.equal(io.metrics.created, betweenPhases ? 1 : 0);
      assert.equal(io.metrics.disposed, io.metrics.created);
    } finally {
      off();
      run.dispose();
    }
  });
}

test("camera JSON and readable exports retain instrument labels, private words and full precision without code or URL leakage", () => {
  const document = { ...emptyNotebook(), entries: [cameraEntry] };
  const exported = JSON.parse(exportNotebookJson(document));
  assert.deepEqual(exported.entries[0], cameraEntry);
  const html = exportNotebookHtml(document);
  for (const text of [
    "Sample naive estimate",
    "Sample noise-aware disjoint-pair estimate",
    "naive diffusion estimate will be larger",
    "Camera ≠ particle",
    "confidence-set bounds were not kept",
    parameters.noiseSeed,
    parameters.clickSeed,
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes("&lt;script&gt;secret()&lt;/script&gt;"));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("coordinate RMS"));
  assert.ok(!notebookFrameHref(cameraEntry.frame).includes("secret"));
  assert.ok(!JSON.stringify(cameraEntry.replay.tape).includes("secret"));
});

test("unknown adapters and a wrong owner are explicitly refused before any worker exists", async () => {
  for (const id of ["bm-99", "__proto__", "constructor", null])
    assert.throws(() => comparisonReplayAdapter(id), { code: "unsupported-replay-instrument" });
  assert.throws(() => comparisonReplayAdapterForKind("bm99-comparison"), {
    code: "unsupported-replay-kind",
  });
  assert.throws(() => parseComparisonReplay({ ...cameraEntry.replay, kind: "bm99-comparison" }), {
    code: "unsupported-replay-kind",
  });
  const io = transport();
  assert.throws(() => runner(cameraEntry.replay, io, { instrumentId: "bm-01" }), {
    code: "replay-owner-mismatch",
  });
  assert.equal(io.metrics.created, 0);
});

test("(comparisonAdapters.ts:153) tracer session accepts its own prepared example and refuses a camera owner", async () => {
  const adapter = comparisonReplayAdapter("bm-01"),
    io = transport();
  await assert.rejects(
    adapter.createSession("wrong", {
      instrumentId: "bm-08",
      example,
      identity,
      workerFactory: io.factory,
    }),
    { code: "replay-owner-mismatch" },
  );
  const tracer = JSON.parse(
    await readFile(new URL("../../generated/bm01-example.json", import.meta.url), "utf8"),
  );
  const session = await adapter.createSession("tracer-adapter", {
    instrumentId: "bm-01",
    example: tracer,
    identity,
    workerFactory: io.factory,
  });
  assert.equal(session.getSnapshot().accepted.experimentId, "bm-01");
  assert.equal(io.metrics.created, 0);
  session.disconnect();
});

test("(comparisonAdapters.ts:202) camera session accepts its own prepared example and refuses a tracer owner", async () => {
  const adapter = comparisonReplayAdapter("bm-08"),
    io = transport();
  await assert.rejects(
    adapter.createSession("wrong", {
      instrumentId: "bm-01",
      example,
      identity,
      workerFactory: io.factory,
    }),
    { code: "replay-owner-mismatch" },
  );
  const session = await adapter.createSession("camera-adapter", {
    instrumentId: "bm-08",
    example,
    identity,
    workerFactory: io.factory,
  });
  assert.equal(session.getSnapshot().accepted.experimentId, "bm-08");
  assert.equal(io.metrics.created, 0);
  session.disconnect();
});

test("camera recipe parsing refuses a second changed input, physical-path changes, seed laundering, extra grid, and hypothetical experiments", () => {
  const mutations = [
    (r) => {
      r.variant.parameters.exposure = 0.75;
    },
    (r) => {
      r.variant.parameters.D *= 2;
    },
    (r) => {
      r.variant.parameters.noiseSeed = "1906";
    },
    (r) => {
      r.tape.initialConditions.clickSeed = "1906";
    },
    (r) => {
      r.tape.replayGrid = { baseSpacing: 0.25, horizon: 4004 };
    },
    (r) => {
      r.tape.events[0].commandClass = "setup-change";
    },
    (r) => {
      r.tape.predictions[0].promptId = "bm-01-predict-comparison-rms";
    },
    (r) => {
      r.tape.initialConditions.coverageTrials = 1;
    },
    (r) => {
      r.variant.outputs.naiveD.value = Infinity;
    },
  ];
  for (const change of mutations) {
    const candidate = structuredClone(cameraEntry.replay);
    change(candidate);
    assert.throws(() => parseComparisonReplay(candidate));
  }
});

test("(comparisonAdapters.ts:109) camera parameters admit one recording and refuse additional hypothetical experiments", () => {
  assert.deepEqual(comparisonReplayAdapter("bm-08").parameters(parameters), parameters);
  assert.throws(
    () => comparisonReplayAdapter("bm-08").parameters({ ...parameters, coverageTrials: 1 }),
    { code: "invalid-replay-parameters" },
  );
});

test("(comparisonAdapters.ts:140) tracer parameters admit their canonical settings and refuse camera settings", () => {
  assert.deepEqual(comparisonReplayAdapter("bm-01").parameters(BM01_DEFAULTS), BM01_DEFAULTS);
  assert.throws(() => comparisonReplayAdapter("bm-01").parameters(parameters), {
    code: "invalid-replay-parameters",
  });
});

test("(replayEntry.ts:476) and (replayEntry.ts:487) capture refuses pending, stale evidence and an unproven recording", async () => {
  await assert.rejects(
    captureComparisonReplay({ ...cameraState, pending: true }, passage, words),
    /completed/,
  );
  await assert.rejects(
    captureComparisonReplay(
      { ...cameraState, variant: { ...cameraState.variant, snapshotVersion: 999 } },
      passage,
      words,
    ),
    { code: "stale-replay-comparison" },
  );
  const bad = {
    ...cameraState,
    variantSnapshot: {
      ...cameraState.variantSnapshot,
      outputs: cameraState.variantSnapshot.outputs.map((o) =>
        o.quantityId === "reusedRecording" ? { ...o, value: 0 } : o,
      ),
    },
  };
  await assert.rejects(captureComparisonReplay(bad, passage, words), {
    code: "invalid-replay-comparison-evidence",
  });
});

test("altered camera scalars fail their checkpoint before creating a worker", async () => {
  const changed = structuredClone(cameraEntry.replay);
  changed.variant.outputs.naiveD.value *= 2;
  const io = transport(),
    run = runner(changed, io);
  const result = await finish(run);
  assert.equal(result.phase, "failed");
  assert.match(result.message, /checkpoint/);
  assert.equal(io.metrics.created, 0);
});

test("an old reply cannot complete a pending camera variant or publish a partial comparison", async () => {
  let held = null;
  const io = transport((message, deliver) => {
    if (message.messageKind === "result" && message.token.parameters.sigma === 0.4e-6)
      held = { message, deliver };
    else deliver(message);
  });
  const run = runner(cameraEntry.replay, io);
  await run.start();
  await until(() => held !== null);
  assert.equal(run.getSnapshot().phase, "variant");
  assert.equal(run.getSnapshot().variant, null);
  assert.equal(run.getSnapshot().result, null);
  const stale = io.metrics.replies.find((message) => message.messageKind === "result");
  io.metrics.listeners[0](structuredClone(stale));
  assert.equal(run.getSnapshot().phase, "failed");
  assert.equal(run.getSnapshot().result, null);
  const failed = run.getSnapshot();
  assert.equal(failed.baseline, null);
  assert.equal(failed.variant, null);
  held.deliver(held.message);
  io.metrics.listeners[0](structuredClone(held.message));
  assert.equal(run.getSnapshot(), failed);
  assert.equal(io.metrics.disposed, 1);
});

test("stopping and restarting cannot mix an old camera result into the next replay generation", async () => {
  const held = [];
  const io = transport((message, deliver) => {
    if (message.messageKind === "result" && message.token.parameters.sigma === 0.4e-6)
      held.push({ message, deliver });
    else deliver(message);
  });
  const run = runner(cameraEntry.replay, io);
  await run.start();
  await until(() => held.length === 1);
  run.stop();
  assert.equal(run.getSnapshot().phase, "stopped");
  assert.equal(run.getSnapshot().baseline, null);
  await run.start();
  await until(() => held.length === 2);
  const current = run.getSnapshot();
  assert.equal(current.phase, "variant");
  held[0].deliver(held[0].message);
  io.metrics.listeners[0](structuredClone(held[0].message));
  assert.equal(run.getSnapshot(), current);
  held[1].deliver(held[1].message);
  // The scheduler verifies the recording checkpoint asynchronously before publishing it.
  await until(() => !["checking", "baseline", "variant"].includes(run.getSnapshot().phase));
  assert.equal(run.getSnapshot().phase, "complete");
  assert.equal(run.getSnapshot().reproduction, "matching-scalars");
  assert.notEqual(held[0].message.token.instanceId, run.getSnapshot().variant.instanceId);
  assert.equal(io.metrics.created, 2);
  assert.equal(io.metrics.disposed, 2);
  run.dispose();
});

test("a mismatched retained latent witness fails the new comparison without publishing a partial result", async () => {
  const io = transport((message, deliver) => {
    if (message.messageKind === "result" && message.token.parameters.sigma === 0.4e-6) {
      const witness = message.result.data.outputs.find((o) => o.quantityId === "latentWitness");
      witness.value[0] += 1;
    }
    deliver(message);
  });
  const run = runner(cameraEntry.replay, io);
  const result = await finish(run);
  assert.equal(result.phase, "failed");
  assert.match(result.message, /latent recording/);
  assert.equal(result.baseline, null);
  assert.equal(result.variant, null);
  assert.equal(result.result, null);
});

test("a changed camera model needs explicit consent and cannot overwrite or certify the saved evidence", async () => {
  const io = transport(),
    run = runner(cameraEntry.replay, io, {
      identity: { ...identity, modelVersion: "camera-v-next" },
    });
  assert.equal((await finish(run)).phase, "failed");
  assert.equal(io.metrics.created, 0);
  const result = await finish(run, true);
  assert.equal(result.phase, "complete", result.message);
  assert.equal(result.reproduction, "new-model");
  assert.equal(cameraEntry.replay.baseline.identity.modelVersion, identity.modelVersion);
  run.dispose();
});

for (const mode of ["blocked", "quota"])
  test(`camera evidence remains exportable when ${mode} storage cannot persist it`, async () => {
    const io = storage(mode),
      store = io.store();
    assert.equal((await saveComparisonReplay(store, input)).ok, true);
    assert.equal(store.getSnapshot().persistence, "session-only");
    assert.equal(io.records.has(NOTEBOOK_KEY), false);
    assert.equal(
      JSON.parse(exportNotebookJson(store.getSnapshot().document)).entries[0].replay.kind,
      "bm08-comparison",
    );
  });
