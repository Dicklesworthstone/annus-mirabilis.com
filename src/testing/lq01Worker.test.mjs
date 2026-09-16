import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { LQ01_CLASSES, LQ01_DEFAULTS, LQ01_OUTPUTS } from "../experiments/lq01/definition.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { evaluateLq01 } from "../workers/operations/lq01.ts";
import {
  LQ01_PROTOCOL,
  decodeLabHello,
  decodeLabResponse,
  labHello,
} from "../workers/protocol/lq01.ts";
import { createLq01Scheduler } from "../workers/scheduler/lq01Scheduler.ts";

const digest = `source:sha256:${"a".repeat(64)}`;

function makeStore(id = "test", parameters = LQ01_DEFAULTS) {
  return createInstanceStore({
    experimentId: "lq-01",
    instanceId: id,
    initialParameters: parameters,
    parameterClasses: LQ01_CLASSES,
    outputs: LQ01_OUTPUTS,
    allowPartial: true,
  });
}

function channelFactory(stats, extra = {}) {
  return () => {
    stats.created++;
    const worker = new Worker(new URL("./worker-fixtures/lq01NodeWorker.mjs", import.meta.url), {
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
  const scheduler = createLq01Scheduler(store, channelFactory(stats), digest);
  t.after(() => scheduler.dispose());
  assert.equal(stats.created, 0);
  scheduler.request(store.issue("setup-change"));
  const view = await waitFor(store, (s) => s.status === "accepted");
  const reference = await evaluateLq01(LQ01_DEFAULTS);
  assert.equal(
    output(view.accepted, "centerIntensity").value,
    reference.data.outputs.find((o) => o.quantityId === "centerIntensity").value,
  );
  assert.deepEqual(
    output(view.accepted, "screenIntensity").value.copy(),
    reference.data.outputs.find((o) => o.quantityId === "screenIntensity").value,
  );
  assert.equal(stats.created, 1);
  scheduler.dispose();
  assert.equal(stats.disposed, 1);
});

test("burst requests evaluate only in-flight and final requests", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const events = [];
  const started = signal();
  const store = makeStore("burst", { ...LQ01_DEFAULTS });
  const scheduler = createLq01Scheduler(store, channelFactory(stats), digest, (event) => {
    events.push(event);
    if (event.kind === "dispatched") started.resolve();
  });
  t.after(() => scheduler.dispose());
  scheduler.request(store.issue("setup-change"));
  await started.promise;
  for (let i = 0; i < 20; i++) {
    scheduler.request(store.issue("setup-change", { delta: i * 0.1 }));
  }
  const view = await waitFor(store, (s) => s.status === "accepted");
  assert.equal(view.accepted.actionIndex, 21);
  assert.equal(view.accepted.parameters.delta, 19 * 0.1);
  assert.equal(events.filter((e) => e.kind === "dispatched").length, 2);
  assert.equal(events.filter((e) => e.kind === "superseded").length, 19);
});

test("two dedicated instances are independent", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const a = makeStore("left");
  const b = makeStore("right");
  const sa = createLq01Scheduler(a, channelFactory(stats), digest);
  const sb = createLq01Scheduler(b, channelFactory(stats), digest);
  t.after(() => {
    sa.dispose();
    sb.dispose();
  });
  sa.request(a.issue("setup-change"));
  sb.request(b.issue("setup-change", { delta: Math.PI }));
  await Promise.all([
    waitFor(a, (s) => s.status === "accepted"),
    waitFor(b, (s) => s.status === "accepted"),
  ]);
  assert.equal(stats.created, 2);
  assert.notEqual(a.getSnapshot().accepted.runId, b.getSnapshot().accepted.runId);
  assert.equal(output(a.getSnapshot().accepted, "centerIntensity").value, 4);
  assert.equal(Math.abs(output(b.getSnapshot().accepted, "centerIntensity").value) < 1e-12, true);
});

test("a refused parameter keeps the accepted snapshot", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const store = makeStore();
  const scheduler = createLq01Scheduler(store, channelFactory(stats), digest);
  t.after(() => scheduler.dispose());
  scheduler.request(store.issue("setup-change"));
  await waitFor(store, (s) => s.status === "accepted");
  const accepted = store.getSnapshot().accepted;
  scheduler.request(store.issue("setup-change", { r: 0 }));
  const refused = await waitFor(store, (s) => s.status === "refused");
  assert.equal(refused.accepted, accepted);
  assert.equal(refused.refusal.code, "invalid-parameter");
});

test("wrong provenance or buffer shape never earns an accepted snapshot", async (t) => {
  for (const extra of [{ breakDigest: true }, { breakArray: true }]) {
    const stats = { created: 0, disposed: 0 };
    const store = makeStore();
    const scheduler = createLq01Scheduler(store, channelFactory(stats, extra), digest);
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
  const result = await evaluateLq01(LQ01_DEFAULTS);
  const response = {
    messageKind: "result",
    protocolVersion: LQ01_PROTOCOL,
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
