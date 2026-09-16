import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { BM07_CLASSES, BM07_DEFAULTS, BM07_OUTPUTS } from "../experiments/bm07/definition.ts";
import { createBm07Session } from "../experiments/bm07/session.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { createBm07Recording, measureBm07 } from "../workers/operations/bm07.ts";
import { BM07_PROTOCOL, decodeLabHello, decodeLabResponse } from "../workers/protocol/bm07.ts";
import { createHostScheduler } from "../workers/scheduler/hostScheduler.ts";

const digest = `source:sha256:${"a".repeat(64)}`;
const parameters = { ...BM07_DEFAULTS };
const protocol = {
  version: BM07_PROTOCOL,
  decodeHello: decodeLabHello,
  decodeResponse: decodeLabResponse,
};
const out = (s, id) => s.outputs.find((o) => o.quantityId === id);
const accepted = (r) => {
  assert.equal(r.kind, "accepted", JSON.stringify(r));
  return r.data;
};
const same = (a, b, id) => assert.deepEqual(out(a, id).value.copy(), out(b, id).value.copy());
function factory(counts, extra = {}) {
  return () => {
    counts.created++;
    const worker = new Worker(new URL("./worker-fixtures/bm07NodeWorker.mjs", import.meta.url), {
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
    experimentId: "bm-07",
    instanceId: "inference-test",
    initialParameters: parameters,
    parameterClasses: BM07_CLASSES,
    outputs: BM07_OUTPUTS,
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
const run = async (o, command, patch) => {
  o.scheduler.request(o.store.issue(command, patch));
  return (await wait(o.store, (v) => v.status === "accepted")).accepted;
};
test("BM-07 real worker returns all owned observations and starts with non-identifiability", async (t) => {
  const o = owner(t);
  assert.equal(o.counts.created, 0);
  const a = await run(o, "setup-change");
  const r = accepted(await createBm07Recording(parameters, { yieldControl: async () => {} })),
    e = accepted(await measureBm07(r, parameters, false));
  assert.equal(a.outputs.length, Object.keys(BM07_OUTPUTS).length);
  for (const id of [
    "observationPositions",
    "observationIncrements",
    "familyRadii",
    "familyNumbers",
  ])
    assert.deepEqual(out(a, id).value.copy(), out(e, id).value);
  assert.equal(out(a, "avogadroNumberEstimate").status, "underdetermined");
  assert.equal(out(a, "degreesOfFreedom").value, 100);
  assert.equal(out(a, "recordingDraws").value, 16385);
  assert.equal(o.counts.created, 1);
});
test("radius assumptions change inversion without touching the observations, generator or run", async (t) => {
  const o = owner(t),
    a = await run(o, "setup-change");
  const b = await run(o, "estimator-change", { radiusKnown: true }),
    c = await run(o, "estimator-change", { a: parameters.a * 2 });
  assert.equal(b.runId, a.runId);
  assert.equal(c.runId, a.runId);
  same(a, c, "observationPositions");
  same(a, c, "observationIncrements");
  assert.equal(out(c, "requestDraws").value, 0);
  assert.equal(out(c, "avogadroNumberEstimate").value, out(b, "avogadroNumberEstimate").value / 2);
  assert.equal(out(c, "generatorMolecularNumber").value, out(a, "generatorMolecularNumber").value);
  const changed = await run(o, "setup-change", { generatorRadius: parameters.generatorRadius * 2 });
  assert.notEqual(changed.runId, a.runId);
  assert.notDeepEqual(
    out(changed, "observationPositions").value.copy(),
    out(a, "observationPositions").value.copy(),
  );
});
test("M, coordinate dimension and spacing select the same latent recording; returning is exact", async (t) => {
  const o = owner(t),
    a = await run(o, "setup-change");
  for (const patch of [
    { M: 20, d: 1, dt: 2 },
    { M: 50, d: 2, dt: 1 },
  ]) {
    const b = await run(o, "measurement-change", patch);
    assert.equal(b.runId, a.runId);
    assert.equal(out(b, "reusedRecording").value, 1);
    assert.equal(out(b, "requestDraws").value, 0);
    if (patch.d === 2) same(a, b, "observationIncrements");
  }
});
test("centered and centered-MLE use the same rescaled interval; one fitted increment stays underdetermined", async (t) => {
  const o = owner(t);
  await run(o, "setup-change");
  const a = await run(o, "estimator-change", { estimator: "drift-centered", radiusKnown: true }),
    b = await run(o, "estimator-change", { estimator: "maximum-likelihood-centered" });
  assert.equal(out(a, "degreesOfFreedom").value, 98);
  same(a, b, "diffusionInterval");
  same(a, b, "molecularInterval");
  assert.equal(out(b, "diffusionBiasFactor").value, 49 / 50);
  const c = await run(o, "measurement-change", { M: 1 });
  assert.equal(out(c, "degreesOfFreedom").value, 0);
  assert.equal(out(c, "diffusionCoefficientEstimate").status, "underdetermined");
  assert.equal(out(c, "avogadroNumberEstimate").status, "underdetermined");
  assert.equal(out(c, "coverageDiffusion").status, "underdetermined");
  const d = await run(o, "estimator-change", {
    estimator: "independent-increment-known-zero-drift",
  });
  assert.equal(out(d, "diffusionCoefficientEstimate").status, "value");
  assert.equal(out(d, "inverseBiasFactor").status, "not-applicable");
});
test("off-grid and overlong observations preserve accepted data; the actual offered repair recovers", async (t) => {
  const o = owner(t),
    a = await run(o, "setup-change");
  o.scheduler.request(o.store.issue("measurement-change", { dt: 0.3 }));
  let s = await wait(o.store, (v) => v.status === "refused");
  assert.equal(s.accepted, a);
  assert.equal(s.refusal.code, "off-replay-grid");
  const action = s.refusal.rankedRepairs[0].action;
  const b = await run(o, "measurement-change", { [action.parameterId]: action.value });
  assert.equal(b.runId, a.runId);
  o.scheduler.request(o.store.issue("measurement-change", { M: 1000, dt: 2 }));
  s = await wait(o.store, (v) => v.status === "refused");
  assert.equal(s.accepted, b);
});
test("conditional and conservative combined intervals remain distinct; missing input coverage is not fabricated", async (t) => {
  const o = owner(t);
  await run(o, "setup-change");
  const a = await run(o, "estimator-change", { radiusKnown: true }),
    b = await run(o, "estimator-change", { intervalKind: "combined" });
  same(a, b, "conditionalInterval");
  const x = out(a, "molecularInterval").value.copy(),
    y = out(b, "molecularInterval").value.copy();
  assert.ok(y[0] < x[0] && y[1] > x[1]);
  assert.match(out(b, "avogadroNumberEstimate").uncertainty.method, /conservative/);
  assert.ok(Math.abs(out(b, "avogadroNumberEstimate").uncertainty.coverage - 0.95) < 1e-12);
  const c = await run(o, "estimator-change", { inputCoverage: 0 });
  assert.equal(out(c, "molecularInterval").status, "not-applicable");
  assert.equal(out(c, "avogadroNumberEstimate").status, "value");
  assert.equal(out(c, "avogadroNumberEstimate").uncertainty, undefined);
  assert.equal(out(c, "requestDraws").value, 0);
});
test("repeated hypothetical trials leave primary observations intact and reveal wrong-radius conditional coverage", async (t) => {
  const o = owner(t);
  const a = await run(o, "setup-change");
  const b = await run(o, "estimator-change", { coverageTrials: 30, radiusKnown: true });
  same(a, b, "observationPositions");
  assert.equal(b.runId, a.runId);
  assert.equal(out(b, "recordingDraws").value, 16385);
  assert.equal(out(b, "coverageDraws").value, 30 * (1 + 4 * 200));
  assert.equal(out(b, "diffusionCoveringCount").value, out(b, "molecularCoveringCount").value);
  const c = await run(o, "estimator-change", { a: parameters.a * 2 });
  same(b, c, "coverageDiffusion");
  assert.ok(out(c, "molecularCoveringCount").value < out(b, "molecularCoveringCount").value);
  same(a, c, "observationIncrements");
  const d = await run(o, "estimator-change", { intervalKind: "combined" });
  assert.equal(out(d, "coverageDiffusion").status, "not-applicable");
  assert.equal(out(d, "coverageDraws").value, 0);
});
test("wrong provenance and malformed observation arrays never earn an accepted inference", async (t) => {
  for (const extra of [{ breakDigest: true }, { breakArray: true }]) {
    const o = owner(t, extra);
    o.scheduler.request(o.store.issue("setup-change"));
    const s = await wait(o.store, (v) => v.status === "unavailable");
    assert.equal(s.accepted, null);
    o.scheduler.dispose();
  }
});
test("rapid requests publish only the newest inference trial; separate instances stay isolated", async (t) => {
  const a = owner(t),
    b = owner(t);
  a.scheduler.request(a.store.issue("setup-change"));
  for (let i = 0; i < 30; i++)
    a.scheduler.request(a.store.issue("setup-change", { seed: String(1905 + i) }));
  const final = (await wait(a.store, (v) => v.status === "accepted")).accepted;
  assert.equal(final.parameters.seed, "1934");
  assert.equal(final.actionIndex, 31);
  assert.ok(a.events.some((e) => e.kind === "superseded"));
  const other = await run(b, "setup-change");
  assert.equal(other.parameters.seed, "1905");
  assert.notDeepEqual(
    out(other, "observationIncrements").value.copy(),
    out(final, "observationIncrements").value.copy(),
  );
});
test("prepared example needs no worker and cannot be tampered into an identified result", async (t) => {
  const recording = accepted(
      await createBm07Recording(parameters, { yieldControl: async () => {} }),
    ),
    measured = accepted(await measureBm07(recording, parameters, false));
  const example = {
    parameters,
    sourceDigest: digest,
    stepIndex: measured.stepIndex,
    simulationTime: measured.simulationTime,
    results: measured.outputs.map(encodeResult),
  };
  const counts = { created: 0, disposed: 0 },
    session = createBm07Session("prepared", example, factory(counts));
  t.after(() => session.disconnect());
  assert.equal(counts.created, 0);
  assert.equal(session.getSnapshot(), session.getServerSnapshot());
  assert.throws(() =>
    createBm07Session(
      "tampered",
      {
        ...example,
        results: example.results.map((s) =>
          s.replace("synthetic-recovery", "independent-estimate"),
        ),
      },
      factory(counts),
    ),
  );
  assert.equal(session.apply({ ...parameters, M: 1001 }).kind, "refused");
  assert.equal(counts.created, 0);
  session.apply({ ...parameters, radiusKnown: true });
  const s = await wait(session, (v) => v.status === "accepted");
  assert.equal(out(s.accepted, "avogadroNumberEstimate").status, "value");
  assert.equal(counts.created, 1);
  session.disconnect();
  assert.equal(counts.disposed, 1);
});
