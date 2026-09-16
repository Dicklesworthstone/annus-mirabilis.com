import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import {
  SR03_DEFAULTS,
  SR03_OUTPUTS,
  SR03_PARAMETER_CLASSES,
} from "../experiments/sr03/definition.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { evaluateSr03 } from "../workers/operations/sr03.ts";
import {
  SR03_PROTOCOL,
  decodeLabHello,
  decodeLabResponse,
  labHello,
} from "../workers/protocol/sr03.ts";
import { createSr03Scheduler } from "../workers/scheduler/sr03Scheduler.ts";

const digest = `source:sha256:${"a".repeat(64)}`;

function makeStore(id = "test", parameters = SR03_DEFAULTS) {
  return createInstanceStore({
    experimentId: "sr-03",
    instanceId: id,
    initialParameters: parameters,
    parameterClasses: SR03_PARAMETER_CLASSES,
    outputs: SR03_OUTPUTS,
    allowPartial: true,
  });
}

function channelFactory(stats, extra = {}) {
  return () => {
    stats.created++;
    const worker = new Worker(new URL("./worker-fixtures/sr03NodeWorker.mjs", import.meta.url), {
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

const output = (snapshot, id) => snapshot.outputs.find((o) => o.quantityId === id);

test("lazy real worker publishes the same results as reference operation", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const store = makeStore();
  const scheduler = createSr03Scheduler(store, channelFactory(stats), digest);
  t.after(() => scheduler.dispose());
  assert.equal(stats.created, 0);
  scheduler.request(store.issue("setup-change"));
  const view = await waitFor(store, (s) => s.status === "accepted");
  const reference = await evaluateSr03(SR03_DEFAULTS);
  assert.equal(
    output(view.accepted, "gammaFactor").value,
    reference.data.outputs.find((o) => o.quantityId === "gammaFactor").value,
  );
  assert.equal(
    output(view.accepted, "spacetimeIntervalSquared").value,
    reference.data.outputs.find((o) => o.quantityId === "spacetimeIntervalSquared").value,
  );
  assert.equal(stats.created, 1);
  scheduler.dispose();
  assert.equal(stats.disposed, 1);
});

test("two dedicated instances are independent", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const a = makeStore("left");
  const b = makeStore("right");
  const sa = createSr03Scheduler(a, channelFactory(stats), digest);
  const sb = createSr03Scheduler(b, channelFactory(stats), digest);
  t.after(() => {
    sa.dispose();
    sb.dispose();
  });
  sa.request(a.issue("setup-change"));
  sb.request(b.issue("setup-change", { v: 0.8 }));
  await Promise.all([
    waitFor(a, (s) => s.status === "accepted"),
    waitFor(b, (s) => s.status === "accepted"),
  ]);
  assert.equal(stats.created, 2);
  assert.notEqual(a.getSnapshot().accepted.runId, b.getSnapshot().accepted.runId);
  assert.notEqual(
    output(a.getSnapshot().accepted, "gammaFactor").value,
    output(b.getSnapshot().accepted, "gammaFactor").value,
  );
});

test("a superluminal frame speed refuses with superluminal-observer", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const store = makeStore();
  const scheduler = createSr03Scheduler(store, channelFactory(stats), digest);
  t.after(() => scheduler.dispose());
  scheduler.request(store.issue("setup-change"));
  await waitFor(store, (s) => s.status === "accepted");
  const accepted = store.getSnapshot().accepted;
  scheduler.request(store.issue("setup-change", { v: 0.99 }));
  const refused = await waitFor(store, (s) => s.status === "refused");
  assert.equal(refused.accepted, accepted);
  assert.equal(refused.refusal.code, "superluminal-observer");
});

test("wrong provenance never earns an accepted snapshot", async (t) => {
  const stats = { created: 0, disposed: 0 };
  const store = makeStore();
  const scheduler = createSr03Scheduler(
    store,
    channelFactory(stats, { breakDigest: true }),
    digest,
  );
  t.after(() => scheduler.dispose());
  scheduler.request(store.issue("setup-change"));
  const view = await waitFor(store, (s) => s.status === "unavailable");
  assert.equal(view.accepted, null);
  assert.equal(view.outcome.outcome, "artifact-mismatch");
  scheduler.dispose();
});

test("strict protocol rejects extra fields and version mismatch", async () => {
  const store = makeStore();
  const token = store.issue("setup-change");
  const result = await evaluateSr03(SR03_DEFAULTS);
  const response = {
    messageKind: "result",
    protocolVersion: SR03_PROTOCOL,
    sourceDigest: digest,
    token,
    result,
  };
  decodeLabResponse(response, token, digest);
  decodeLabHello(labHello(digest), digest);
  for (const altered of [
    { ...response, extra: true },
    { ...response, protocolVersion: 99 },
    { ...response, sourceDigest: `source:sha256:${"0".repeat(64)}` },
  ]) {
    assert.throws(() => decodeLabResponse(altered, token, digest));
  }
});
