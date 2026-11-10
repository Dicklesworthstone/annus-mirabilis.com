import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test, { type TestContext } from "node:test";
import {
  BM06_DEFAULTS,
  BM06_HOST_GRID_OWNER,
  BM06_OUTPUTS,
  BM06_PARAMETER_CLASSES,
  type Bm06Parameters,
} from "../experiments/bm06/definition.ts";
import { createInstanceStore, type RequestToken } from "../experiments/store/instanceStore.ts";
import { createBm06Host } from "../workers/host/bm06Host.ts";
import { type Bm06GridStepper, evaluateBm06 } from "../workers/operations/bm06.ts";
import {
  BM06_PROTOCOL,
  decodeLabHello,
  decodeLabProgress,
  decodeLabResponse,
  labHello,
} from "../workers/protocol/bm06.ts";
import { createBm06Scheduler } from "../workers/scheduler/bm06Scheduler.ts";
import {
  createDedicatedScheduler,
  SchedulerConfigurationError,
  type SchedulerEvent,
  type WorkerChannel,
} from "../workers/scheduler/scheduler.ts";
import { frankensimGridStepper } from "../workers/wasm/frankensimFtcsGrid.ts";
import { PINNED_ARTIFACT } from "../workers/wasm/pinnedArtifact.ts";
import { loadPinnedBundle } from "../workers/wasm/pinnedBundle.ts";

const SOURCE_DIGEST = `source:sha256:${"a".repeat(64)}`;
const HANDSHAKE_MS = 100;
const RESPONSE_MS = 200;

function clock(t: TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000 });
  t.mock.method(performance, "now", () => Date.now());
  t.after(() => t.mock.timers.reset());
  return (milliseconds: number) => t.mock.timers.tick(milliseconds);
}

async function response(token: RequestToken) {
  const result = await evaluateBm06(token.parameters as Bm06Parameters, {
    yieldControl: async () => {},
  });
  assert.equal(result.kind, "accepted");
  return {
    messageKind: "result",
    protocolVersion: BM06_PROTOCOL,
    sourceDigest: SOURCE_DIGEST,
    token,
    result,
  };
}

function progress(token: RequestToken, completedSteps: number) {
  return {
    messageKind: "progress",
    protocolVersion: BM06_PROTOCOL,
    sourceDigest: SOURCE_DIGEST,
    token,
    completedSteps,
  };
}

async function fixture(t: TestContext) {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "deadline-laboratory",
    initialParameters: BM06_DEFAULTS,
    parameterClasses: BM06_PARAMETER_CLASSES,
    outputs: BM06_OUTPUTS,
    allowPartial: true,
  });
  const initialToken = store.issue("setup-change");
  const initial = await response(initialToken);
  assert.equal(initial.result.kind, "accepted");
  if (initial.result.kind !== "accepted") throw new Error("The reference example must evaluate.");
  assert.equal(
    store.publish({ ...initialToken, ...initial.result.data, final: true }).accepted,
    true,
  );
  const accepted = store.getSnapshot().accepted;
  const channels: Array<{
    receive: (message: unknown) => void;
    messages: unknown[];
    disposed: number;
    unlistened: number;
  }> = [];
  const events: SchedulerEvent[] = [];
  const scheduler = createDedicatedScheduler({
    store,
    sourceDigest: SOURCE_DIGEST,
    protocol: {
      version: BM06_PROTOCOL,
      decodeHello: decodeLabHello,
      decodeProgress: decodeLabProgress,
      decodeResponse: decodeLabResponse,
    },
    handshakeTimeoutMs: HANDSHAKE_MS,
    responseTimeoutMs: RESPONSE_MS,
    maxRestarts: 3,
    report: (event) => events.push(event),
    factory(): WorkerChannel {
      const channel = {
        receive: (_message: unknown) => {},
        messages: [] as unknown[],
        disposed: 0,
        unlistened: 0,
      };
      channels.push(channel);
      return {
        send: (message) => channel.messages.push(message),
        listen(onMessage) {
          channel.receive = onMessage;
          // Retain the callback to exercise an already queued event after teardown.
          return () => channel.unlistened++;
        },
        dispose: () => channel.disposed++,
      };
    },
  });
  t.after(() => scheduler.dispose());
  function request(eta = 0.002) {
    const token = store.issue("setup-change", { eta });
    scheduler.request(token);
    return token;
  }
  function latestChannel() {
    const channel = channels.at(-1);
    assert.ok(channel);
    return channel;
  }
  return { store, scheduler, accepted, channels, events, request, latestChannel };
}

test("a silent worker handshake times out without replacing the accepted calculation or current inputs", async (t) => {
  const f = await fixture(t);
  const advance = clock(t);
  const token = f.request();
  advance(HANDSHAKE_MS - 1);
  assert.equal(f.store.getSnapshot().status, "pending");
  advance(1);
  const view = f.store.getSnapshot();
  assert.equal(view.status, "unavailable");
  assert.equal(view.pending, false);
  assert.equal(view.outcome?.outcome, "worker-timeout");
  assert.equal(view.outcome?.retry, "retry-same-request");
  assert.deepEqual(view.outcome?.details, { phase: "handshake", timeoutMs: HANDSHAKE_MS });
  assert.equal(view.accepted, f.accepted);
  assert.equal(view.requested, token);
  assert.equal(f.latestChannel().messages.length, 0);
  assert.equal(f.latestChannel().disposed, 1);
  assert.equal(f.latestChannel().unlistened, 1);
});

test("a hung calculation fails the newest queued request and a fresh worker can recover", async (t) => {
  const f = await fixture(t);
  const advance = clock(t);
  const first = f.request();
  const oldChannel = f.latestChannel();
  oldChannel.receive(labHello(SOURCE_DIGEST));
  const latest = f.request(0.003);
  advance(RESPONSE_MS);
  assert.equal(f.store.getSnapshot().outcome?.outcome, "worker-timeout");
  assert.deepEqual(f.store.getSnapshot().outcome?.details, {
    phase: "response",
    timeoutMs: RESPONSE_MS,
  });
  assert.equal(f.store.getSnapshot().requested, latest);
  assert.equal(f.store.getSnapshot().accepted, f.accepted);
  assert.equal(f.events.at(-1)?.actionIndex, latest.actionIndex);
  assert.equal(oldChannel.disposed, 1);

  const retry = f.request(0.003);
  const replacement = f.latestChannel();
  assert.notEqual(replacement, oldChannel);
  replacement.receive(labHello(SOURCE_DIGEST));
  oldChannel.receive(await response(first));
  assert.equal(f.store.getSnapshot().status, "pending");
  replacement.receive(await response(retry));
  const recovered = f.store.getSnapshot();
  assert.equal(recovered.status, "accepted");
  assert.equal(recovered.accepted?.actionIndex, retry.actionIndex);
  assert.equal(recovered.accepted?.parameters.eta, 0.003);
  advance(RESPONSE_MS * 2);
  assert.equal(f.store.getSnapshot(), recovered);
  assert.equal(f.scheduler.getRestartCount(), 1);
});

test("repeated silent starts exhaust the reconnect limit without creating another worker", async (t) => {
  const f = await fixture(t);
  const advance = clock(t);
  for (let attempt = 0; attempt < 3; attempt++) {
    f.request();
    advance(HANDSHAKE_MS);
    assert.equal(f.store.getSnapshot().outcome?.outcome, "worker-timeout");
  }
  f.request();
  assert.equal(f.channels.length, 3);
  assert.equal(f.store.getSnapshot().outcome?.outcome, "environment-unsupported");
  assert.equal(f.store.getSnapshot().accepted, f.accepted);
});

for (const phase of ["handshake", "response"] as const) {
  test(`${phase} deadlines count only unpaused time and queued work stays lazy`, async (t) => {
    const f = await fixture(t);
    const advance = clock(t);
    f.scheduler.setSchedulingPaused(true);
    f.request();
    advance(RESPONSE_MS * 10);
    assert.equal(f.channels.length, 0);
    assert.equal(f.store.getSnapshot().status, "pending");
    f.scheduler.setSchedulingPaused(false);
    const timeout = phase === "handshake" ? HANDSHAKE_MS : RESPONSE_MS;
    if (phase === "response") f.latestChannel().receive(labHello(SOURCE_DIGEST));
    advance(timeout / 2);
    f.scheduler.setSchedulingPaused(true);
    advance(timeout * 10);
    assert.equal(f.store.getSnapshot().status, "pending");
    assert.equal(f.latestChannel().disposed, 0);
    f.scheduler.setSchedulingPaused(false);
    advance(timeout / 2 - 1);
    assert.equal(f.store.getSnapshot().status, "pending");
    advance(1);
    assert.equal(f.store.getSnapshot().outcome?.outcome, "worker-timeout");
  });
}

test("a completed in-flight result clears its deadline while hidden and keeps the newest request queued", async (t) => {
  const f = await fixture(t);
  const advance = clock(t);
  const first = f.request();
  f.latestChannel().receive(labHello(SOURCE_DIGEST));
  advance(RESPONSE_MS / 2);
  f.scheduler.setSchedulingPaused(true);
  const latest = f.request(0.003);
  f.latestChannel().receive(await response(first));
  advance(RESPONSE_MS * 10);
  assert.equal(f.store.getSnapshot().status, "pending");
  assert.equal(f.scheduler.getWorkerMessageCount(), 1);
  f.scheduler.setSchedulingPaused(false);
  assert.equal(f.scheduler.getWorkerMessageCount(), 2);
  advance(RESPONSE_MS - 1);
  f.latestChannel().receive(await response(latest));
  const accepted = f.store.getSnapshot();
  assert.equal(accepted.status, "accepted");
  advance(RESPONSE_MS * 2);
  assert.equal(f.store.getSnapshot(), accepted);
});

for (const stop of ["cancel", "dispose"] as const) {
  for (const phase of ["handshake", "response"] as const) {
    test(`${stop} clears the ${phase} deadline and ignores late worker messages`, async (t) => {
      const f = await fixture(t);
      const advance = clock(t);
      const token = f.request();
      const channel = f.latestChannel();
      if (phase === "response") channel.receive(labHello(SOURCE_DIGEST));
      f.scheduler[stop]();
      const stopped = f.store.getSnapshot();
      assert.equal(stopped.status, "paused");
      advance(RESPONSE_MS * 10);
      channel.receive(labHello(SOURCE_DIGEST));
      channel.receive(await response(token));
      assert.equal(f.store.getSnapshot(), stopped);
      assert.equal(stopped.accepted, f.accepted);
      assert.equal(f.scheduler.getRestartCount(), 0);
      assert.equal(channel.disposed, 1);
    });
  }
}

test("a retry issued by a timeout subscriber survives the failed worker's teardown", async (t) => {
  const f = await fixture(t);
  const advance = clock(t);
  f.request();
  let retried = false;
  const unsubscribe = f.store.subscribe(() => {
    if (retried || f.store.getSnapshot().outcome?.outcome !== "worker-timeout") return;
    retried = true;
    f.request();
  });
  t.after(unsubscribe);
  advance(HANDSHAKE_MS);
  assert.equal(retried, true);
  assert.equal(f.channels.length, 2);
  assert.equal(f.latestChannel().disposed, 0);
  assert.equal(f.store.getSnapshot().status, "pending");
  f.latestChannel().receive(labHello(SOURCE_DIGEST));
  const token = f.store.getSnapshot().requested;
  assert.ok(token);
  f.latestChannel().receive(await response(token));
  assert.equal(f.store.getSnapshot().status, "accepted");
});

test("an admitted long BM-06 run survives browser timer clamping through real WASM-to-host fallback", async (t) => {
  const f = await fixture(t);
  const loaded = await loadPinnedBundle({
    wasmUrl: resolve(
      "public/wasm",
      PINNED_ARTIFACT.bundleId,
      PINNED_ARTIFACT.hashPrefix,
      PINNED_ARTIFACT.wasmFile,
    ),
    readBytes: (path) => readFile(path),
  });
  assert.equal(loaded.kind, "loaded");
  if (loaded.kind !== "loaded") return;
  const advance = clock(t);
  const startedAt = performance.now();
  const realStepper = frankensimGridStepper(loaded.exports);
  let yielded = 0;
  const clampedStepper: Bm06GridStepper = {
    step: (run, control) =>
      realStepper.step(run, {
        ...control,
        async yieldControl() {
          yielded++;
          // Model the browser's nested-timer floor without waiting 83 seconds in the test.
          advance(4);
        },
      }),
  };
  const jobs: Promise<void>[] = [];
  let progressMessages = 0;
  const scheduler = createBm06Scheduler(
    f.store,
    () => {
      let receive: (message: unknown) => void = () => {};
      const host = createBm06Host(
        (message) => {
          if ((message as { messageKind: string }).messageKind === "progress") progressMessages++;
          receive(message);
        },
        SOURCE_DIGEST,
        clampedStepper,
      );
      return {
        send: (message) => {
          jobs.push(host.receive(message));
        },
        listen(onMessage) {
          receive = onMessage;
          host.hello();
          return () => {
            receive = () => {};
          };
        },
        dispose: () => host.dispose(),
      };
    },
    SOURCE_DIGEST,
  );
  t.after(() => scheduler.dispose());
  const token = f.store.issue("setup-change", { gridEnabled: true, n: 3, steps: 1_333_333 });
  let publications = 0;
  const unsubscribe = f.store.subscribe(() => publications++);
  t.after(unsubscribe);
  scheduler.request(token);
  await Promise.all(jobs);
  const view = f.store.getSnapshot();
  assert.equal(view.status, "accepted");
  assert.equal(view.accepted?.stepIndex, 1_333_333);
  assert.equal(view.accepted?.parameters.n, 3);
  assert.equal(
    view.accepted?.outputs.find((output) => output.quantityId === "gridDensity")?.ownerId,
    BM06_HOST_GRID_OWNER,
  );
  assert.equal(yielded, 20_834);
  assert.equal(performance.now() - startedAt, 83_336);
  assert.ok(progressMessages > 0);
  assert.ok(progressMessages < yielded, "Progress messages are coalesced by completed work.");
  assert.equal(publications, 1, "Progress does not publish partial scientific results.");
  assert.equal(scheduler.getRestartCount(), 0);
});

test("forward progress renews inactivity, while repeated or regressing progress still times out", async (t) => {
  const f = await fixture(t);
  const advance = clock(t);
  const token = f.store.issue("setup-change", { gridEnabled: true, n: 3, steps: 8192 });
  f.scheduler.request(token);
  f.latestChannel().receive(labHello(SOURCE_DIGEST));
  advance(RESPONSE_MS - 1);
  f.latestChannel().receive(progress(token, 4096));
  assert.equal(f.store.getSnapshot().accepted, f.accepted);
  advance(RESPONSE_MS - 1);
  assert.equal(f.store.getSnapshot().status, "pending");
  f.latestChannel().receive(progress(token, 4096));
  f.latestChannel().receive(progress(token, 64));
  advance(1);
  assert.equal(f.store.getSnapshot().outcome?.outcome, "worker-timeout");
  assert.equal(f.store.getSnapshot().accepted, f.accepted);
});

test("a superseded calculation's progress cannot prolong the replacement request", async (t) => {
  const f = await fixture(t);
  const advance = clock(t);
  const first = f.store.issue("setup-change", { gridEnabled: true, n: 3, steps: 8192 });
  f.scheduler.request(first);
  f.latestChannel().receive(labHello(SOURCE_DIGEST));
  const latest = f.request(0.003);
  f.latestChannel().receive(progress(first, 8192));
  assert.equal(f.store.getSnapshot().accepted, f.accepted);
  f.latestChannel().receive(await response(first));
  assert.equal(f.scheduler.getWorkerMessageCount(), 2);
  advance(RESPONSE_MS - 1);
  f.latestChannel().receive(progress(latest, 4096));
  advance(RESPONSE_MS - 1);
  assert.equal(f.store.getSnapshot().status, "pending");
  f.latestChannel().receive(progress(first, 8192));
  advance(1);
  assert.equal(f.store.getSnapshot().outcome?.outcome, "worker-timeout");
  assert.equal(f.store.getSnapshot().requested, latest);
  assert.equal(f.store.getSnapshot().accepted, f.accepted);
});

test("progress received while hidden does not arm a deadline or publish a partial result", async (t) => {
  const f = await fixture(t);
  const advance = clock(t);
  const token = f.store.issue("setup-change", { gridEnabled: true, n: 3, steps: 8192 });
  f.scheduler.request(token);
  f.latestChannel().receive(labHello(SOURCE_DIGEST));
  advance(RESPONSE_MS / 2);
  f.scheduler.setSchedulingPaused(true);
  f.latestChannel().receive(progress(token, 4096));
  advance(RESPONSE_MS * 10);
  assert.equal(f.store.getSnapshot().status, "pending");
  assert.equal(f.store.getSnapshot().accepted, f.accepted);
  f.scheduler.setSchedulingPaused(false);
  advance(RESPONSE_MS - 1);
  assert.equal(f.store.getSnapshot().status, "pending");
  f.latestChannel().receive(await response(token));
  const accepted = f.store.getSnapshot();
  assert.equal(accepted.status, "accepted");
  advance(RESPONSE_MS * 2);
  assert.equal(f.store.getSnapshot(), accepted);
});

test("malformed-response progress is bounded by actual admitted steps and complete request identity", async (t) => {
  const f = await fixture(t);
  const token = f.store.issue("setup-change", { gridEnabled: true, n: 3, steps: 8192 });
  for (const completedSteps of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 8193]) {
    assert.throws(
      () => decodeLabProgress(progress(token, completedSteps), token, SOURCE_DIGEST),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "malformed-response",
    );
  }
  for (const patch of [{ gridEnabled: false }, { t: 0 }, { n: 4097, steps: 8192 }]) {
    const invalid = { ...token, parameters: { ...token.parameters, ...patch } };
    assert.throws(
      () => decodeLabProgress(progress(invalid, 64), invalid, SOURCE_DIGEST),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "malformed-response",
    );
  }
  const otherParent = { ...token, parentRunId: "another-parent" };
  assert.deepEqual(decodeLabProgress(progress(otherParent, 64), token, SOURCE_DIGEST), {
    current: false,
    completed: 64,
  });
  assert.throws(
    () =>
      decodeLabProgress(
        { ...progress(token, 64), sourceDigest: `source:sha256:${"b".repeat(64)}` },
        token,
        SOURCE_DIGEST,
      ),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "artifact-mismatch",
  );
});

test("invalid-worker-deadline rejects invalid configuration before a worker can be created", async (t) => {
  const f = await fixture(t);
  let created = 0;
  for (const key of ["handshakeTimeoutMs", "responseTimeoutMs"] as const) {
    for (const timeout of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648]) {
      assert.throws(
        () =>
          createDedicatedScheduler({
            store: f.store,
            sourceDigest: SOURCE_DIGEST,
            protocol: {
              version: BM06_PROTOCOL,
              decodeHello: decodeLabHello,
              decodeResponse: decodeLabResponse,
            },
            [key]: timeout,
            factory() {
              created++;
              return { send() {}, listen: () => () => {}, dispose() {} };
            },
          }),
        (error: unknown) =>
          error instanceof SchedulerConfigurationError && error.code === "invalid-worker-deadline",
      );
    }
  }
  assert.equal(created, 0);
});
