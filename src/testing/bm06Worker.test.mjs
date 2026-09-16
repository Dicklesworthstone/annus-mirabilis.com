import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import {
  BM06_DEFAULTS,
  BM06_OUTPUTS,
  BM06_PARAMETER_CLASSES,
} from "../experiments/bm06/definition.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { evaluateBm06 } from "../workers/operations/bm06.ts";
import { remeasureBm06 } from "../workers/operations/bm06Measurement.ts";
import {
  BM06_PROTOCOL,
  decodeLabHello,
  decodeLabResponse,
  labHello,
} from "../workers/protocol/bm06.ts";
import { createBm06Scheduler } from "../workers/scheduler/bm06Scheduler.ts";

// Test provenance is deliberately separate from the production build's source hash.
const digest = `source:sha256:${"a".repeat(64)}`;
function makeStore(id = "test", parameters = BM06_DEFAULTS) {
  return createInstanceStore({
    experimentId: "bm-06",
    instanceId: id,
    initialParameters: parameters,
    parameterClasses: BM06_PARAMETER_CLASSES,
    outputs: BM06_OUTPUTS,
    allowPartial: true,
  });
}
function channelFactory(stats, extra = {}) {
  return () => {
    stats.created++;
    const worker = new Worker(new URL("./worker-fixtures/bm06NodeWorker.mjs", import.meta.url), {
      workerData: { digest, ...extra },
      execArgv: ["--experimental-strip-types"],
    });
    return {
      send: (message) => worker.postMessage(message),
      listen: (onMessage, onError) => {
        worker.on("message", onMessage);
        worker.on("error", onError);
        return () => {
          worker.off("message", onMessage);
          worker.off("error", onError);
        };
      },
      dispose: () => {
        stats.disposed++;
        void worker.terminate();
      },
    };
  };
}
function waitFor(store, predicate) {
  if (predicate(store.getSnapshot())) return Promise.resolve(store.getSnapshot());
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Worker did not reach the requested state."));
    }, 5000);
    const unsubscribe = store.subscribe(() => {
      const s = store.getSnapshot();
      if (predicate(s)) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(s);
      }
    });
  });
}
function signal() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const output = (snapshot, id) => snapshot.outputs.find((o) => o.quantityId === id);

test("lazy real worker publishes the same results as the reference operation", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const store = makeStore();
  const scheduler = createBm06Scheduler(store, channelFactory(stats), digest);
  t.after(() => scheduler.dispose());
  assert.equal(stats.created, 0);
  scheduler.request(store.issue("setup-change"));
  const view = await waitFor(store, (s) => s.status === "accepted");
  const reference = await evaluateBm06(BM06_DEFAULTS);
  assert.equal(
    output(view.accepted, "diffusionCoefficient").value,
    reference.data.outputs.find((o) => o.quantityId === "diffusionCoefficient").value,
  );
  assert.deepEqual(
    output(view.accepted, "probabilityDensity").value.copy(),
    reference.data.outputs.find((o) => o.quantityId === "probabilityDensity").value,
  );
  assert.equal(stats.created, 1);
  scheduler.dispose();
  assert.equal(stats.disposed, 1);
});
test("50 rapid changes evaluate only the in-flight and final requests", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const events = [];
  const started = signal();
  const store = makeStore("burst", { ...BM06_DEFAULTS, gridEnabled: true, steps: 10000 });
  const scheduler = createBm06Scheduler(store, channelFactory(stats), digest, (event) => {
    events.push(event);
    if (event.kind === "dispatched") started.resolve();
  });
  t.after(() => scheduler.dispose());
  scheduler.request(store.issue("setup-change"));
  await started.promise;
  for (let i = 0; i < 50; i++)
    scheduler.request(store.issue("setup-change", { eta: 0.001 + i * 0.0001, gridEnabled: false }));
  const view = await waitFor(store, (s) => s.status === "accepted");
  assert.equal(view.accepted.actionIndex, 51);
  assert.equal(view.accepted.parameters.eta, 0.001 + 49 * 0.0001);
  assert.equal(events.filter((e) => e.kind === "dispatched").length, 2);
  assert.equal(events.filter((e) => e.kind === "superseded").length, 49);
  assert.equal(view.accepted.snapshotVersion, 1);
});
test("two dedicated instances are independent", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const a = makeStore("left"),
    b = makeStore("right");
  const sa = createBm06Scheduler(a, channelFactory(stats), digest),
    sb = createBm06Scheduler(b, channelFactory(stats), digest);
  t.after(() => {
    sa.dispose();
    sb.dispose();
  });
  sa.request(a.issue("setup-change"));
  sb.request(b.issue("setup-change", { eta: 0.002 }));
  await Promise.all([
    waitFor(a, (s) => s.status === "accepted"),
    waitFor(b, (s) => s.status === "accepted"),
  ]);
  assert.equal(stats.created, 2);
  assert.notEqual(a.getSnapshot().accepted.runId, b.getSnapshot().accepted.runId);
  assert.equal(
    output(b.getSnapshot().accepted, "diffusionCoefficient").value,
    output(a.getSnapshot().accepted, "diffusionCoefficient").value / 2,
  );
});
test("a refused grid keeps the accepted snapshot and an executable repair recovers", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const store = makeStore();
  const scheduler = createBm06Scheduler(store, channelFactory(stats), digest);
  t.after(() => scheduler.dispose());
  scheduler.request(store.issue("setup-change"));
  await waitFor(store, (s) => s.status === "accepted");
  const accepted = store.getSnapshot().accepted;
  scheduler.request(store.issue("setup-change", { gridEnabled: true, steps: 1 }));
  const refused = await waitFor(store, (s) => s.status === "refused");
  assert.equal(refused.accepted, accepted);
  const action = refused.refusal.rankedRepairs[0].action;
  scheduler.request(store.issue("setup-change", { [action.parameterId]: action.value }));
  const recovered = await waitFor(store, (s) => s.status === "accepted");
  assert.equal(recovered.accepted.snapshotVersion, 2);
  assert.equal(stats.created, 1);
});
test("measurement changes reuse the same field and preserve the physical run", async (t) => {
  const parameters = { ...BM06_DEFAULTS, gridEnabled: true };
  const reference = await evaluateBm06(parameters, { yieldControl: async () => {} });
  const changed = remeasureBm06(parameters, reference.data, {
    ...parameters,
    lower: 0,
    upper: 1e-6,
  });
  assert.equal(changed.kind, "accepted");
  assert.equal(
    changed.data.outputs.find((o) => o.quantityId === "gridDensity").value,
    reference.data.outputs.find((o) => o.quantityId === "gridDensity").value,
  );
  const stats = { created: 0, disposed: 0 };
  const store = makeStore("measurement", parameters);
  const scheduler = createBm06Scheduler(store, channelFactory(stats), digest);
  t.after(() => scheduler.dispose());
  scheduler.request(store.issue("setup-change"));
  const before = await waitFor(store, (s) => s.status === "accepted");
  scheduler.request(store.issue("measurement-change", { lower: 0, upper: 1e-6 }));
  const after = await waitFor(store, (s) => s.status === "accepted");
  assert.equal(after.accepted.runId, before.accepted.runId);
  assert.equal(after.accepted.stepIndex, before.accepted.stepIndex);
  assert.deepEqual(
    output(after.accepted, "gridDensity").value.copy(),
    output(before.accepted, "gridDensity").value.copy(),
  );
  assert.ok(
    output(after.accepted, "intervalProbability").value <
      output(before.accepted, "intervalProbability").value,
  );
});
test("wrong provenance or buffer shape never earns an accepted snapshot", async (t) => {
  for (const extra of [{ breakDigest: true }, { breakArray: true }]) {
    const stats = { created: 0, disposed: 0 };
    const store = makeStore();
    const scheduler = createBm06Scheduler(store, channelFactory(stats, extra), digest);
    t.after(() => scheduler.dispose());
    scheduler.request(store.issue("setup-change"));
    const view = await waitFor(store, (s) => s.status === "unavailable");
    assert.equal(view.accepted, null);
    assert.equal(
      view.outcome.outcome,
      extra.breakDigest ? "artifact-mismatch" : "malformed-response",
    );
  }
});
test("cancelling and disposing release worker ownership and ignore late messages", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const started = signal();
  const store = makeStore("cancel", { ...BM06_DEFAULTS, gridEnabled: true, steps: 10000 });
  const scheduler = createBm06Scheduler(store, channelFactory(stats), digest, (e) => {
    if (e.kind === "dispatched") started.resolve();
  });
  t.after(() => scheduler.dispose());
  scheduler.request(store.issue("setup-change"));
  await started.promise;
  scheduler.cancel();
  assert.equal(store.getSnapshot().status, "paused");
  assert.equal(stats.disposed, 1);
  scheduler.request(store.issue("setup-change", { gridEnabled: false }));
  await waitFor(store, (s) => s.status === "accepted");
  scheduler.dispose();
  assert.equal(stats.created, 2);
  assert.equal(stats.disposed, 2);
  assert.throws(() => scheduler.request(store.issue("continue")), /disposed/);
});
test("strict protocol rejects extra fields, identity mismatches, version mismatch and invalid arrays", async () => {
  const store = makeStore();
  const token = store.issue("setup-change");
  const result = await evaluateBm06(BM06_DEFAULTS);
  const response = {
    messageKind: "result",
    protocolVersion: BM06_PROTOCOL,
    sourceDigest: digest,
    token,
    result,
  };
  decodeLabResponse(response, token, digest);
  decodeLabHello(labHello(digest), digest);
  for (const altered of [
    { ...response, extra: true },
    { ...response, protocolVersion: 99 },
    { ...response, token: { ...token, actionIndex: 2 } },
    { ...response, sourceDigest: `source:sha256:${"0".repeat(64)}` },
  ])
    assert.throws(() => decodeLabResponse(altered, token, digest));
  const changed = structuredClone(response);
  changed.result.data.outputs.find((o) => o.quantityId === "diffusionCoefficient").value = NaN;
  assert.throws(() => decodeLabResponse(changed, token, digest));
});
test("worker creation failures have a bounded retry count", () => {
  const store = makeStore();
  let attempts = 0;
  const scheduler = createBm06Scheduler(
    store,
    () => {
      attempts++;
      throw new Error("Unavailable");
    },
    digest,
  );
  for (let i = 0; i < 10; i++) scheduler.request(store.issue("setup-change"));
  assert.equal(attempts, 3);
  assert.equal(store.getSnapshot().status, "unavailable");
  scheduler.dispose();
});
