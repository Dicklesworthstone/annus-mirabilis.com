import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { BM01_CLASSES, BM01_DEFAULTS, BM01_OUTPUTS } from "../experiments/bm01/definition.ts";
import { createBm01Session } from "../experiments/bm01/session.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { createBm01Recording, measureBm01 } from "../workers/operations/bm01.ts";
import { BM01_PROTOCOL, decodeLabHello, decodeLabResponse } from "../workers/protocol/bm01.ts";
import { createHostScheduler } from "../workers/scheduler/hostScheduler.ts";

const digest = `source:sha256:${"a".repeat(64)}`;
const parameters = { ...BM01_DEFAULTS, M: 40, H: 2, interval: 1 };
const protocol = {
  version: BM01_PROTOCOL,
  decodeHello: decodeLabHello,
  decodeResponse: decodeLabResponse,
};
const out = (s, id) => s.outputs.find((o) => o.quantityId === id);
function factory(counts, extra = {}) {
  return () => {
    counts.created++;
    const worker = new Worker(new URL("./worker-fixtures/bm01NodeWorker.mjs", import.meta.url), {
      workerData: { digest, ...extra },
      execArgv: ["--experimental-strip-types"],
    });
    return {
      send: (m) => worker.postMessage(m),
      listen: (message, error) => {
        worker.on("message", message);
        worker.on("error", error);
        return () => {
          worker.off("message", message);
          worker.off("error", error);
        };
      },
      dispose: () => {
        counts.disposed++;
        void worker.terminate();
      },
    };
  };
}
function wait(store, predicate) {
  if (predicate(store.getSnapshot())) return Promise.resolve(store.getSnapshot());
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      off();
      reject(new Error(JSON.stringify(store.getSnapshot(), null, 2)));
    }, 10000);
    const off = store.subscribe(() => {
      if (predicate(store.getSnapshot())) {
        clearTimeout(timeout);
        off();
        resolve(store.getSnapshot());
      }
    });
  });
}
function owner(t, extra = {}) {
  const store = createInstanceStore({
    experimentId: "bm-01",
    instanceId: "tracer-test",
    initialParameters: parameters,
    parameterClasses: BM01_CLASSES,
    outputs: BM01_OUTPUTS,
    allowPartial: true,
  });
  const counts = { created: 0, disposed: 0 },
    events = [];
  const scheduler = createHostScheduler(store, factory(counts, extra), digest, protocol, (e) =>
    events.push(e),
  );
  t.after(() => scheduler.dispose());
  return { store, counts, scheduler, events };
}
test("BM-01 real worker returns the exact seeded host recording and statistics", async (t) => {
  const { store, counts, scheduler } = owner(t);
  assert.equal(counts.created, 0);
  scheduler.request(store.issue("setup-change"));
  const { accepted } = await wait(store, (v) => v.status === "accepted");
  const recording = await createBm01Recording(parameters, { yieldControl: async () => {} });
  assert.equal(recording.kind, "accepted");
  const measured = measureBm01(recording.data, parameters, false);
  assert.equal(measured.kind, "accepted");
  for (const id of ["tracerPositions", "histogramCounts", "plotSampleRms"])
    assert.deepEqual(
      out(accepted, id).value.copy(),
      measured.data.outputs.find((o) => o.quantityId === id).value,
    );
  assert.equal(out(accepted, "recordingDraws").value, 24000);
  assert.equal(counts.created, 1);
});
test("observation, axis, dimension and statistic changes reuse one latent recording", async (t) => {
  const { store, scheduler } = owner(t);
  scheduler.request(store.issue("setup-change"));
  let view = await wait(store, (v) => v.status === "accepted");
  const initial = view.accepted,
    run = initial.runId;
  for (const patch of [{ interval: 2 }, { axis: 2, d: 3 }, { interval: 1, axis: 0, d: 1 }]) {
    scheduler.request(store.issue("measurement-change", patch));
    view = await wait(store, (v) => v.status === "accepted");
    assert.equal(view.accepted.runId, run);
    assert.equal(out(view.accepted, "reusedRecording").value, 1);
    assert.equal(out(view.accepted, "recordingDraws").value, 24000);
  }
  assert.deepEqual(
    out(view.accepted, "tracerPositions").value.copy(),
    out(initial, "tracerPositions").value.copy(),
  );
  scheduler.request(store.issue("estimator-change", { statistic: "apparent" }));
  view = await wait(store, (v) => v.status === "accepted");
  assert.equal(view.accepted.runId, run);
  assert.equal(out(view.accepted, "reusedRecording").value, 1);
});
test("off-grid refusal preserves accepted result and offered observation repair works", async (t) => {
  const { store, scheduler } = owner(t);
  scheduler.request(store.issue("setup-change"));
  const before = (await wait(store, (v) => v.status === "accepted")).accepted;
  scheduler.request(store.issue("measurement-change", { interval: 0.015 }));
  const refused = await wait(store, (v) => v.status === "refused");
  assert.equal(refused.accepted, before);
  assert.equal(refused.refusal.code, "off-replay-grid");
  const repair = refused.refusal.rankedRepairs.find((r) => r.action.value > 0).action;
  scheduler.request(store.issue("measurement-change", { [repair.parameterId]: repair.value }));
  const next = await wait(store, (v) => v.status === "accepted");
  assert.equal(next.accepted.runId, before.runId);
  assert.equal(out(next.accepted, "reusedRecording").value, 1);
});
test("point distribution and one-tracer sampling limits never masquerade as finite bands", async (t) => {
  const { store, scheduler } = owner(t);
  scheduler.request(store.issue("setup-change"));
  await wait(store, (v) => v.status === "accepted");
  scheduler.request(store.issue("measurement-change", { interval: 0 }));
  let a = (await wait(store, (v) => v.status === "accepted")).accepted;
  assert.equal(out(a, "meanBand").status, "analytic-limit");
  assert.equal(out(a, "modelApparentSpeed").status, "not-applicable");
  assert.equal(
    out(a, "histogramModel")
      .value.copy()
      .reduce((a, b) => a + b),
    1,
  );
  scheduler.request(store.issue("setup-change", { M: 1 }));
  a = (await wait(store, (v) => v.status === "accepted")).accepted;
  assert.equal(out(a, "meanBand").status, "underdetermined");
});
test("oversized ensemble preserves accepted state and never silently lowers member count", async (t) => {
  const { store, scheduler } = owner(t);
  scheduler.request(store.issue("setup-change"));
  const a = (await wait(store, (v) => v.status === "accepted")).accepted;
  scheduler.request(store.issue("setup-change", { M: 3000, H: 600 }));
  const b = await wait(store, (v) => v.status === "unavailable");
  assert.equal(b.accepted, a);
  assert.equal(b.outcome.outcome, "budget-exhausted");
});
test("wrong provenance and wrong position layout fail before publication", async (t) => {
  for (const extra of [{ breakDigest: true }, { breakArray: true }]) {
    const { store, scheduler } = owner(t, extra);
    scheduler.request(store.issue("setup-change"));
    const b = await wait(store, (v) => v.status === "unavailable");
    assert.equal(b.accepted, null);
    scheduler.dispose();
  }
});
test("rapid requests cannot publish intermediate or stale tracer trials", async (t) => {
  const { store, scheduler, events } = owner(t);
  scheduler.request(store.issue("setup-change"));
  for (let i = 0; i < 30; i++)
    scheduler.request(store.issue("setup-change", { seed: String(1905 + i) }));
  const a = (await wait(store, (v) => v.status === "accepted")).accepted;
  assert.equal(a.parameters.seed, "1934");
  assert.equal(a.actionIndex, 31);
  assert.ok(events.some((e) => e.kind === "superseded"));
});
test("prepared session hydrates without running an experiment and rejects tampering", async (t) => {
  const r = await createBm01Recording(parameters, { yieldControl: async () => {} }),
    e = measureBm01(r.data, parameters, false);
  const example = {
    parameters,
    sourceDigest: digest,
    stepIndex: e.data.stepIndex,
    simulationTime: e.data.simulationTime,
    results: e.data.outputs.map(encodeResult),
  };
  const counts = { created: 0, disposed: 0 },
    session = createBm01Session("prepared", example, factory(counts));
  t.after(() => session.disconnect());
  assert.equal(counts.created, 0);
  assert.equal(session.getSnapshot(), session.getServerSnapshot());
  const changed = {
    ...example,
    results: example.results.map((s) =>
      s.replace("synthetic-tracer-endpoints-xyz", "wrong-layout"),
    ),
  };
  assert.throws(() => createBm01Session("broken", changed, factory(counts)));
  session.apply(parameters);
  await wait(session, (v) => v.status === "accepted");
  assert.equal(counts.created, 1);
  session.disconnect();
  assert.equal(counts.disposed, 1);
});
