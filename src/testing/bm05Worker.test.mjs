import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { BM05_CLASSES, BM05_DEFAULTS, BM05_OUTPUTS } from "../experiments/bm05/definition.ts";
import { createBm05Session } from "../experiments/bm05/session.ts";
import { decodeResult, encodeResult } from "../experiments/results/codec.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { createBm05Recording, measureBm05 } from "../workers/operations/bm05.ts";
import { BM05_PROTOCOL, decodeLabHello, decodeLabResponse } from "../workers/protocol/bm05.ts";
import { createHostScheduler } from "../workers/scheduler/hostScheduler.ts";

const digest = `source:sha256:${"a".repeat(64)}`;
const parameters = { ...BM05_DEFAULTS, walkers: 80, runSteps: 80 };
const protocol = {
  version: BM05_PROTOCOL,
  decodeHello: decodeLabHello,
  decodeResponse: decodeLabResponse,
};
const out = (s, id) => s.outputs.find((o) => o.quantityId === id);
const accepted = (r) => {
  assert.equal(r.kind, "accepted", JSON.stringify(r));
  return r.data;
};
function factory(counts, extra = {}) {
  return () => {
    counts.created++;
    const worker = new Worker(new URL("./worker-fixtures/bm05NodeWorker.mjs", import.meta.url), {
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
    experimentId: "bm-05",
    instanceId: "walk-test",
    initialParameters: parameters,
    parameterClasses: BM05_CLASSES,
    outputs: BM05_OUTPUTS,
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
test("BM-05 real worker returns the exact seeded law, histogram and comparison history", async (t) => {
  const { store, counts, scheduler } = owner(t);
  assert.equal(counts.created, 0);
  scheduler.request(store.issue("setup-change"));
  const { accepted: snapshot } = await wait(store, (v) => v.status === "accepted");
  const recording = accepted(
      await createBm05Recording(parameters, { yieldControl: async () => {} }),
    ),
    measured = accepted(await measureBm05(recording, parameters, false));
  for (const id of ["walkPositions", "histogramCounts", "comparisonDistance"])
    assert.deepEqual(out(snapshot, id).value.copy(), out(measured, id).value);
  assert.equal(out(snapshot, "recordingDraws").value, 6400);
  assert.equal(counts.created, 1);
  assert.equal(out(snapshot, "shapeTerm").value, 0.1875);
});
test("step observation and analytic bias changes retain the trial and distinguish cached from replayed work", async (t) => {
  const { store, scheduler } = owner(t);
  scheduler.request(store.issue("setup-change"));
  const initial = (await wait(store, (v) => v.status === "accepted")).accepted,
    run = initial.runId;
  for (const n of [16, 43, 4]) {
    scheduler.request(store.issue("measurement-change", { n }));
    const a = (await wait(store, (v) => v.status === "accepted")).accepted;
    assert.equal(a.runId, run);
    assert.equal(out(a, "reusedRecording").value, 1);
    assert.equal(out(a, "recordingDraws").value, 6400);
    if (n === 43) assert.ok(out(a, "replayedDraws").value > 0);
    else assert.equal(out(a, "replayedDraws").value, 0);
    if (n === 4)
      assert.deepEqual(
        out(a, "walkPositions").value.copy(),
        out(initial, "walkPositions").value.copy(),
      );
  }
  scheduler.request(store.issue("estimator-change", { bias: 0.5 }));
  const a = (await wait(store, (v) => v.status === "accepted")).accepted;
  assert.equal(a.runId, run);
  assert.equal(out(a, "biasedDiffusion").status, "value");
  assert.equal(out(a, "requestDraws").value, 0);
});
test("a zero-step point mass is not labeled a Gaussian; exact coin fractions remain data", async (t) => {
  const { store, scheduler } = owner(t);
  scheduler.request(store.issue("setup-change"));
  await wait(store, (v) => v.status === "accepted");
  scheduler.request(store.issue("measurement-change", { n: 0 }));
  const a = (await wait(store, (v) => v.status === "accepted")).accepted;
  assert.equal(out(a, "shapeTerm").status, "not-applicable");
  assert.equal(out(a, "sumKurtosis").status, "not-applicable");
  assert.deepEqual([...out(a, "histogramExact").value.copy()], [1]);
  assert.deepEqual([...out(a, "coinNumerators").value.copy()], [1]);
});
test("budget and uniform exact-law limits preserve prior accepted data", async (t) => {
  const { store, scheduler } = owner(t);
  scheduler.request(store.issue("setup-change"));
  const a = (await wait(store, (v) => v.status === "accepted")).accepted;
  scheduler.request(store.issue("setup-change", { walkers: 10000, runSteps: 10000 }));
  let b = await wait(store, (v) => v.status === "unavailable");
  assert.equal(b.accepted, a);
  assert.equal(b.outcome.outcome, "budget-exhausted");
  scheduler.request(store.issue("setup-change", { walkers: 80, runSteps: 401, kernel: "uniform" }));
  await wait(store, (v) => v.status === "accepted");
  const previous = store.getSnapshot().accepted;
  scheduler.request(store.issue("measurement-change", { n: 401 }));
  b = await wait(store, (v) => v.status === "unavailable");
  assert.equal(b.accepted, previous);
  assert.equal(b.outcome.outcome, "budget-exhausted");
});
test("unregistered provenance and malformed endpoint buffers never publish", async (t) => {
  for (const extra of [{ breakDigest: true }, { breakArray: true }]) {
    const { store, scheduler } = owner(t, extra);
    scheduler.request(store.issue("setup-change"));
    const b = await wait(store, (v) => v.status === "unavailable");
    assert.equal(b.accepted, null);
    scheduler.dispose();
  }
});
test("rapid requests cannot publish intermediate walk trials", async (t) => {
  const { store, scheduler, events } = owner(t);
  scheduler.request(store.issue("setup-change"));
  for (let i = 0; i < 30; i++)
    scheduler.request(store.issue("setup-change", { seed: String(1905 + i) }));
  const a = (await wait(store, (v) => v.status === "accepted")).accepted;
  assert.equal(a.parameters.seed, "1934");
  assert.equal(a.actionIndex, 31);
  assert.ok(events.some((e) => e.kind === "superseded"));
});
test("all three kernels and teaching deviations conform to one complete output contract", async () => {
  for (const kernel of ["coin", "uniform", "gaussian"])
    for (const n of [0, 4, 43]) {
      const p = { ...parameters, kernel, n },
        r = accepted(await createBm05Recording(p, { yieldControl: async () => {} })),
        e = accepted(await measureBm05(r, p, false));
      assert.equal(e.outputs.length, Object.keys(BM05_OUTPUTS).length);
      for (const o of e.outputs) decodeResult(o);
      const counts = out(e, "histogramCounts").value;
      assert.equal(
        counts.reduce((a, b) => a + b) + out(e, "underflow").value + out(e, "overflow").value,
        p.walkers,
      );
      assert.ok(out(e, "histogramExact").value.every((x) => x >= 0 && x <= 1));
      if (kernel === "coin" && n === 4) {
        assert.deepEqual(
          [...out(e, "histogramExact").value],
          [1, 4, 6, 4, 1].map((x) => x / 16),
        );
        assert.deepEqual([...out(e, "coinNumerators").value], [1, 4, 6, 4, 1]);
      }
      assert.equal(out(e, "biasedDiffusion").status, "outside-domain");
      assert.equal(out(e, "cauchyDiffusion").status, "outside-domain");
      assert.equal(out(e, "continuumLimit").status, "outside-domain");
    }
});
test("prepared sessions hydrate without a worker and refuse altered scientific contracts", async (t) => {
  const r = accepted(await createBm05Recording(parameters, { yieldControl: async () => {} })),
    e = accepted(await measureBm05(r, parameters, false));
  const example = {
    parameters,
    sourceDigest: digest,
    stepIndex: e.stepIndex,
    simulationTime: e.simulationTime,
    results: e.outputs.map(encodeResult),
  };
  const counts = { created: 0, disposed: 0 },
    session = createBm05Session("prepared", example, factory(counts));
  t.after(() => session.disconnect());
  assert.equal(counts.created, 0);
  assert.equal(session.getSnapshot(), session.getServerSnapshot());
  assert.throws(() =>
    createBm05Session(
      "broken",
      {
        ...example,
        results: example.results.map((s) => s.replace("synthetic-walk-endpoints", "wrong-layout")),
      },
      factory(counts),
    ),
  );
  assert.equal(session.apply({ ...parameters, n: 1000 }).kind, "refused");
  assert.equal(counts.created, 0);
  session.apply(parameters);
  await wait(session, (v) => v.status === "accepted");
  assert.equal(counts.created, 1);
  session.disconnect();
  assert.equal(counts.disposed, 1);
});
