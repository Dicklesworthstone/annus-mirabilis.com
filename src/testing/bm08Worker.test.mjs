import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { fromCameraDraft, toCameraDraft } from "../experiments/bm08/controls.ts";
import {
  BM08_CLASSES,
  BM08_OUTPUTS,
  BM08_DEFAULTS as defaults,
} from "../experiments/bm08/definition.ts";
import { decodeBm08Settings, encodeBm08Settings } from "../experiments/bm08/permalink.ts";
import { createBm08Session } from "../experiments/bm08/session.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { createBm08Recording, measureBm08 } from "../workers/operations/bm08.ts";
import { BM08_PROTOCOL, decodeLabHello, decodeLabResponse } from "../workers/protocol/bm08.ts";
import { createHostScheduler } from "../workers/scheduler/hostScheduler.ts";

const digest = `source:sha256:${"a".repeat(64)}`,
  protocol = {
    version: BM08_PROTOCOL,
    decodeHello: decodeLabHello,
    decodeResponse: decodeLabResponse,
  };
const out = (s, id) => s.outputs.find((o) => o.quantityId === id);
const ok = (r) => {
  assert.equal(r.kind, "accepted", JSON.stringify(r));
  return r.data;
};
const copy = (s, id) => out(s, id).value.copy();
function factory(counts, extra = {}) {
  return () => {
    counts.created++;
    const worker = new Worker(new URL("./worker-fixtures/bm08NodeWorker.mjs", import.meta.url), {
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
function wait(store, pred) {
  if (pred(store.getSnapshot())) return Promise.resolve(store.getSnapshot());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(JSON.stringify(store.getSnapshot())));
    }, 15000);
    const off = store.subscribe(() => {
      const s = store.getSnapshot();
      if (pred(s)) {
        clearTimeout(timer);
        off();
        resolve(s);
      }
    });
  });
}
function owner(t, extra = {}) {
  const store = createInstanceStore({
      experimentId: "bm-08",
      instanceId: "camera-test",
      initialParameters: defaults,
      parameterClasses: BM08_CLASSES,
      outputs: BM08_OUTPUTS,
      allowPartial: true,
    }),
    counts = { created: 0, disposed: 0 };
  const scheduler = createHostScheduler(store, factory(counts, extra), digest, protocol);
  t.after(() => scheduler.dispose());
  return { store, counts, scheduler };
}
async function run(o, cmd, patch) {
  o.scheduler.request(o.store.issue(cmd, patch));
  return (await wait(o.store, (s) => s.status === "accepted")).accepted;
}
test("BM08 real worker publishes the exact camera observations and correctly declines ideal intervals", async (t) => {
  const o = owner(t),
    s = await run(o, "setup-change");
  assert.equal(o.counts.created, 1);
  assert.equal(s.outputs.length, Object.keys(BM08_OUTPUTS).length);
  const r = ok(await createBm08Recording(defaults, { yieldControl: async () => {} })),
    m = ok(await measureBm08(r, defaults, false));
  for (const id of [
    "positions",
    "blurredPositions",
    "stationaryClicks",
    "latentWitness",
    "pairInterval",
  ])
    assert.deepEqual(copy(s, id), out(m, id).value);
  assert.equal(out(s, "naiveInterval").status, "not-applicable");
  assert.equal(out(s, "centeredInterval").status, "not-applicable");
  assert.equal(out(s, "pairDegrees").value, 98);
  assert.equal(out(s, "recordingDraws").value, 32896);
  assert.equal(out(s, "retainedBytes").value, 131600);
});
test("measurement changes preserve every latent witness and returning recreates identical frames", async (t) => {
  const o = owner(t),
    a = await run(o, "setup-change");
  for (const patch of [
    { sigma: 0.4e-6 },
    { exposure: 0 },
    { stageDrift: 0.1e-6 },
    { noiseSeed: "9007199254740993" },
  ]) {
    const b = await run(o, "measurement-change", patch);
    assert.equal(a.runId, b.runId);
    assert.deepEqual(copy(a, "latentWitness"), copy(b, "latentWitness"));
    assert.equal(out(b, "requestDraws").value, 0);
    assert.equal(out(b, "reusedRecording").value, 1);
    assert.equal(out(b, "reusedObservation").value, 0);
    assert.notDeepEqual(copy(a, "positions"), copy(b, "positions"));
  }
  const b = await run(o, "measurement-change", {
    sigma: defaults.sigma,
    exposure: defaults.exposure,
    stageDrift: 0,
    noiseSeed: defaults.noiseSeed,
  });
  assert.deepEqual(copy(a, "positions"), copy(b, "positions"));
  const c = await run(o, "setup-change", { flowDrift: 0.1e-6 });
  assert.notEqual(c.runId, a.runId);
  assert.notDeepEqual(copy(c, "latentWitness"), copy(a, "latentWitness"));
});
test("noise inference and confidence settings reuse both physical and observed data without stream evaluation", async (t) => {
  const o = owner(t),
    a = await run(o, "setup-change"),
    b = await run(o, "estimator-change", { noiseMethod: "known", coverage: 0.9 });
  assert.equal(b.runId, a.runId);
  for (const id of ["positions", "stationaryClicks", "increments"])
    assert.deepEqual(copy(a, id), copy(b, id));
  assert.equal(out(b, "measurementDraws").value, 0);
  assert.equal(out(b, "requestDraws").value, 0);
  assert.equal(out(b, "reusedObservation").value, 1);
  assert.notDeepEqual(copy(a, "pairInterval"), copy(b, "pairInterval"));
});
test("zero camera error restores appropriate ideal intervals, while fitting drift removes only drift", async (t) => {
  const o = owner(t);
  await run(o, "setup-change");
  const a = await run(o, "measurement-change", { sigma: 0, exposure: 0 });
  assert.equal(out(a, "naiveInterval").status, "value");
  assert.equal(out(a, "centeredInterval").status, "value");
  assert.deepEqual(copy(a, "idealPositions"), copy(a, "positions"));
  assert.deepEqual(copy(a, "idealSpeeds"), copy(a, "cameraSpeeds"));
  assert.equal(out(a, "speedCrossover").status, "not-applicable");
  const b = await run(o, "measurement-change", { stageDrift: 2e-6 });
  assert.equal(out(b, "naiveInterval").status, "not-applicable");
  assert.equal(out(b, "centeredInterval").status, "value");
  assert.ok(Math.abs(out(b, "centeredD").value - out(a, "centeredD").value) < 1e-25);
});
test("off-grid exposure refusal preserves accepted data and offered repair really succeeds", async (t) => {
  const o = owner(t),
    a = await run(o, "setup-change");
  o.scheduler.request(o.store.issue("measurement-change", { exposure: 0.3 }));
  const s = await wait(o.store, (v) => v.status === "refused");
  assert.equal(s.accepted, a);
  const repair = s.refusal.rankedRepairs[0].action;
  const b = await run(o, "measurement-change", { [repair.parameterId]: repair.value });
  assert.equal(b.parameters.exposure, 0.25);
  assert.equal(b.runId, a.runId);
  o.scheduler.request(o.store.issue("measurement-change", { M: 1000, dt: 4 }));
  const refused = await wait(o.store, (v) => v.status === "refused");
  assert.equal(refused.accepted, b);
});
test("explicit coverage keeps primary data and all hypothetical intervals, including misses", async (t) => {
  const o = owner(t),
    a = await run(o, "setup-change"),
    b = await run(o, "estimator-change", { coverageTrials: 12 });
  assert.equal(b.runId, a.runId);
  assert.deepEqual(copy(a, "positions"), copy(b, "positions"));
  assert.equal(copy(b, "coverageIntervals").length, 72);
  assert.equal(out(b, "measurementDraws").value, 0);
  assert.equal(out(b, "requestDraws").value, 0);
  assert.ok(out(b, "coverageDraws").value > 0);
  const c = await run(o, "estimator-change", { noiseMethod: "known" });
  assert.deepEqual(copy(a, "positions"), copy(c, "positions"));
  const before = copy(b, "coverageIntervals"),
    after = copy(c, "coverageIntervals");
  for (let i = 0; i < 12; i++) {
    assert.equal(before[i * 6], after[i * 6]);
    assert.equal(before[i * 6 + 1], after[i * 6 + 1]);
  }
});
test("malformed arrays or provenance never replace accepted science", async (t) => {
  for (const extra of [{ breakDigest: true }, { breakArray: true }]) {
    const o = owner(t, extra);
    o.scheduler.request(o.store.issue("setup-change"));
    const s = await wait(o.store, (v) => v.status === "unavailable");
    assert.equal(s.accepted, null);
  }
});
test("prepared session has no worker and invalid drafts or links cannot change the example", async (t) => {
  const r = ok(await createBm08Recording(defaults, { yieldControl: async () => {} })),
    m = ok(await measureBm08(r, defaults, false)),
    example = {
      sourceDigest: digest,
      parameters: defaults,
      results: m.outputs.map(encodeResult),
      stepIndex: m.stepIndex,
      simulationTime: m.simulationTime,
    };
  const counts = { created: 0, disposed: 0 },
    session = createBm08Session("static", example, factory(counts));
  t.after(() => session.disconnect());
  assert.equal(counts.created, 0);
  assert.equal(session.getSnapshot(), session.getServerSnapshot());
  assert.equal(session.apply({ ...defaults, M: 1001 }).kind, "refused");
  assert.deepEqual(fromCameraDraft(toCameraDraft(defaults)), defaults);
  const shared = {
    ...defaults,
    seed: "18446744073709551615",
    noiseSeed: "9007199254740993",
    coverageTrials: 100,
  };
  assert.deepEqual(decodeBm08Settings(encodeBm08Settings(shared)), {
    kind: "settings",
    parameters: { ...shared, coverageTrials: 0 },
  });
  for (const suffix of ["&D=1", "&private=secret"])
    assert.equal(decodeBm08Settings(encodeBm08Settings(defaults) + suffix).kind, "invalid");
  assert.equal(decodeBm08Settings("?camera=1").kind, "invalid");
  session.apply({ ...defaults, noiseMethod: "known" });
  await wait(session, (s) => s.status === "accepted");
  assert.equal(counts.created, 1);
});
