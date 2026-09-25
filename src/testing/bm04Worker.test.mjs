import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { BM04_CLASSES, BM04_DEFAULTS, BM04_OUTPUTS } from "../experiments/bm04/definition.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { evaluateBm04 } from "../workers/operations/bm04.ts";
import {
  BM04_PROTOCOL,
  decodeLabHello,
  decodeLabResponse,
  labHello,
} from "../workers/protocol/bm04.ts";
import { createBm04Scheduler } from "../workers/scheduler/bm04Scheduler.ts";

const digest = `source:sha256:${"a".repeat(64)}`;

function makeStore(id = "test", parameters = BM04_DEFAULTS) {
  return createInstanceStore({
    experimentId: "bm-04",
    instanceId: id,
    initialParameters: parameters,
    parameterClasses: BM04_CLASSES,
    outputs: BM04_OUTPUTS,
    allowPartial: true,
  });
}

function channelFactory(stats, extra = {}) {
  return () => {
    stats.created++;
    const worker = new Worker(new URL("./worker-fixtures/bm04NodeWorker.mjs", import.meta.url), {
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

test("lazy real worker publishes the same results as reference operation", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const store = makeStore();
  const scheduler = createBm04Scheduler(store, channelFactory(stats), digest);
  t.after(() => scheduler.dispose());
  assert.equal(stats.created, 0);
  scheduler.request(store.issue("setup-change"));
  const view = await waitFor(store, (s) => s.status === "accepted");
  const reference = await evaluateBm04(BM04_DEFAULTS);
  assert.equal(
    output(view.accepted, "diffusionCoefficient").value,
    reference.data.outputs.find((o) => o.quantityId === "diffusionCoefficient").value,
  );
  assert.deepEqual(
    output(view.accepted, "densityProfile").value.copy(),
    reference.data.outputs.find((o) => o.quantityId === "densityProfile").value,
  );
  assert.equal(stats.created, 1);
  scheduler.dispose();
  assert.equal(stats.disposed, 1);
});

test("burst requests evaluate only in-flight and final requests", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const events = [];
  const started = signal();
  const store = makeStore("burst", { ...BM04_DEFAULTS, steps: 500 });
  const scheduler = createBm04Scheduler(store, channelFactory(stats), digest, (event) => {
    events.push(event);
    if (event.kind === "dispatched") started.resolve();
  });
  t.after(() => scheduler.dispose());
  scheduler.request(store.issue("setup-change"));
  await started.promise;
  for (let i = 0; i < 20; i++) {
    scheduler.request(store.issue("setup-change", { eta: 0.001 + i * 0.0001 }));
  }
  const view = await waitFor(store, (s) => s.status === "accepted");
  assert.equal(view.accepted.actionIndex, 21);
  assert.equal(view.accepted.parameters.eta, 0.001 + 19 * 0.0001);
  assert.equal(events.filter((e) => e.kind === "dispatched").length, 2);
  assert.equal(events.filter((e) => e.kind === "superseded").length, 19);
});

test("two dedicated instances are independent", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const a = makeStore("left");
  const b = makeStore("right");
  const sa = createBm04Scheduler(a, channelFactory(stats), digest);
  const sb = createBm04Scheduler(b, channelFactory(stats), digest);
  t.after(() => {
    sa.dispose();
    sb.dispose();
  });
  sa.request(a.issue("setup-change"));
  sb.request(b.issue("setup-change", { eta: BM04_DEFAULTS.eta * 2 }));
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

test("a refused time step keeps the accepted snapshot", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const store = makeStore();
  const scheduler = createBm04Scheduler(store, channelFactory(stats), digest);
  t.after(() => scheduler.dispose());
  scheduler.request(store.issue("setup-change"));
  await waitFor(store, (s) => s.status === "accepted");
  const accepted = store.getSnapshot().accepted;
  // 0.1 s: inside the declared range, about 8.6 times the stability limit at the defaults.
  scheduler.request(store.issue("setup-change", { dt: 0.1 }));
  const refused = await waitFor(store, (s) => s.status === "refused");
  assert.equal(refused.accepted, accepted);
  assert.equal(refused.refusal.code, "drift-diffusion-unstable");
});

test("wrong provenance or buffer shape never earns an accepted snapshot", async (t) => {
  for (const extra of [{ breakDigest: true }, { breakArray: true }]) {
    const stats = { created: 0, disposed: 0 };
    const store = makeStore();
    const scheduler = createBm04Scheduler(store, channelFactory(stats, extra), digest);
    t.after(() => scheduler.dispose());
    scheduler.request(store.issue("setup-change"));
    const view = await waitFor(store, (s) => s.status === "unavailable");
    assert.equal(view.accepted, null);
    assert.equal(
      view.outcome.outcome,
      extra.breakDigest ? "artifact-mismatch" : "malformed-response",
    );
    scheduler.dispose();
  }
});

test("strict protocol rejects extra fields, identity mismatches, version mismatch and invalid arrays", async () => {
  const store = makeStore();
  const token = store.issue("setup-change");
  const result = await evaluateBm04(BM04_DEFAULTS);
  const response = {
    messageKind: "result",
    protocolVersion: BM04_PROTOCOL,
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
  ]) {
    assert.throws(() => decodeLabResponse(altered, token, digest));
  }
});
