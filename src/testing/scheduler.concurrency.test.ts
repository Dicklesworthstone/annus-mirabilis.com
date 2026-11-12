import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { detectDeviceConcurrencyLimit } from "../experiments/lifecycle/limits.ts";
import { createInstanceStore, type RequestToken } from "../experiments/store/instanceStore.ts";
import {
  createWorkerAdmission,
  type WorkerAdmission,
  WorkerAdmissionConfigurationError,
} from "../workers/scheduler/admission.ts";
import {
  createDedicatedScheduler,
  createHostScheduler,
  type HostProtocol,
  type WorkerChannel,
} from "../workers/scheduler/scheduler.ts";

type SentMessage =
  | Readonly<{ messageKind: "request"; token: RequestToken }>
  | Readonly<{ messageKind: "cancel"; actionIndex: number }>;
type ControlledChannel = {
  receive: (message: unknown) => void;
  crash: () => void;
  messages: SentMessage[];
  disposed: boolean;
};

const INITIAL_OUTPUT = {
  status: "value" as const,
  quantityId: "concentration",
  unit: "mol/m^3",
  semanticKind: "scalar",
  ownerId: "bm-06",
  value: 1,
};

function laboratory(
  t: TestContext,
  admission: WorkerAdmission | undefined,
  id: string,
  options: Readonly<{
    autoHello?: boolean;
    events?: string[];
    throwOnCreate?: boolean;
    productionFactory?: boolean;
    onCreate?: () => void;
  }> = {},
) {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: id,
    initialParameters: { diffusivity: 1, lower: 0, seed: "9007199254740993" },
    parameterClasses: { diffusivity: "input", lower: "measurement", seed: "input" },
    outputs: {
      concentration: {
        statuses: ["value"],
        unit: "mol/m^3",
        semanticKind: "scalar",
        ownerId: "bm-06",
      },
    },
  });
  const initial = store.issue("setup-change");
  assert.equal(
    store.publish({
      ...initial,
      outputs: [INITIAL_OUTPUT],
      stepIndex: 20,
      simulationTime: 2,
      final: true,
    }).accepted,
    true,
  );
  const channels: ControlledChannel[] = [];
  const events = options.events ?? [];
  const protocol: HostProtocol = {
    version: "admission-probe-v1",
    decodeHello(message) {
      assert.equal((message as { messageKind: string }).messageKind, "hello");
    },
    decodeResponse(message, token) {
      assert.equal((message as { messageKind: string }).messageKind, "result");
      assert.equal((message as { token: RequestToken }).token, token);
      return {
        token,
        result: {
          kind: "accepted",
          data: { outputs: [INITIAL_OUTPUT], stepIndex: 20, simulationTime: 2 },
        },
      };
    },
  };
  const factory = (): WorkerChannel => {
    events.push(id + ":create");
    options.onCreate?.();
    if (options.throwOnCreate) throw new Error("The controlled worker could not start.");
    const channel: ControlledChannel = {
      receive: () => {},
      crash: () => {},
      messages: [],
      disposed: false,
    };
    channels.push(channel);
    return {
      send(message) {
        const sent = message as SentMessage;
        channel.messages.push(sent);
        events.push(id + ":" + sent.messageKind);
      },
      listen(receive, crash) {
        channel.receive = receive;
        channel.crash = crash;
        if (options.autoHello !== false) receive({ messageKind: "hello" });
        return () => events.push(id + ":unlisten");
      },
      dispose() {
        channel.disposed = true;
        events.push(id + ":dispose");
      },
    };
  };
  const scheduler = options.productionFactory
    ? createHostScheduler(store, factory, "admission-probe", protocol)
    : createDedicatedScheduler({
        store,
        factory,
        sourceDigest: "admission-probe",
        protocol,
        ...(admission ? { admission } : {}),
        handshakeTimeoutMs: 100,
        responseTimeoutMs: 200,
      });
  t.after(() => scheduler.dispose());
  const requests = () =>
    channels
      .flatMap((channel) => channel.messages)
      .filter((message) => message.messageKind === "request")
      .map((message) => message.token);
  return {
    store,
    scheduler,
    channels,
    requests,
    request(lower = 1) {
      const token = store.issue("measurement-change", { lower });
      scheduler.request(token);
      return token;
    },
    finish(token = requests().at(-1)) {
      const channel = channels.at(-1);
      assert.ok(channel);
      assert.ok(token);
      channel.receive({ messageKind: "result", token });
    },
  };
}

function clock(t: TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000 });
  t.mock.method(performance, "now", () => Date.now());
  t.after(() => t.mock.timers.reset());
  return (milliseconds: number) => t.mock.timers.tick(milliseconds);
}

for (const capacity of [1, 2]) {
  test("a shared capacity of " + capacity + " bounds startup and dispatch in FIFO order", (t) => {
    const admission = createWorkerAdmission(capacity);
    const labs = ["first", "second", "third"].map((id) => laboratory(t, admission, id));
    for (const lab of labs) lab.request();
    assert.equal(
      labs.reduce((count, lab) => count + lab.requests().length, 0),
      capacity,
    );
    assert.equal(labs[2]?.channels.length, 0, "A queued owner starts no worker.");
    labs[0]?.finish();
    assert.equal(labs[capacity]?.requests().length, 1);
    if (capacity === 1) {
      labs[1]?.finish();
      assert.equal(labs[2]?.requests().length, 1);
    }
    labs[2]?.finish();
    if (capacity === 2) labs[1]?.finish();
    assert.equal(admission.activeCount, 0);
    assert.equal(admission.queuedCount, 0);
  });
}

test("the actual laboratory factory shares the device budget without caller opt-in", (t) => {
  const capacity = detectDeviceConcurrencyLimit().maxConcurrentHeavyLabs;
  const labs = Array.from({ length: capacity + 1 }, (_, index) =>
    laboratory(t, undefined, "production-" + index, { productionFactory: true }),
  );
  for (const lab of labs) lab.request();
  assert.equal(
    labs.reduce((count, lab) => count + lab.requests().length, 0),
    capacity,
  );
  assert.equal(labs.at(-1)?.channels.length, 0);
  labs[0]?.finish();
  assert.equal(labs.at(-1)?.requests().length, 1);
  for (const lab of labs.slice(1)) lab.finish();
});

test("fifty waiting changes occupy one queue position and preserve the previous accepted result", (t) => {
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first");
  const waiting = laboratory(t, admission, "waiting");
  first.request();
  const before = waiting.store.getSnapshot().accepted;
  let latest: RequestToken | undefined;
  for (let value = 0; value < 50; value++) latest = waiting.request(value);
  assert.equal(waiting.channels.length, 0);
  assert.equal(admission.queuedCount, 1);
  assert.equal(waiting.store.getSnapshot().accepted, before);
  first.finish();
  assert.deepEqual(waiting.requests(), [latest]);
  waiting.finish();
  assert.equal(waiting.store.getSnapshot().accepted?.parameters.lower, 49);
});

test("a supersession cancel packet retains its slot until the worker acknowledges completion", (t) => {
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first");
  const peer = laboratory(t, admission, "peer");
  const old = first.request(1);
  peer.request();
  const latest = first.request(2);
  assert.ok(first.channels[0]?.messages.some((message) => message.messageKind === "cancel"));
  assert.equal(peer.channels.length, 0, "Cancellation does not interrupt synchronous WASM.");
  first.finish(old);
  assert.equal(peer.requests().length, 1);
  assert.equal(first.requests().length, 1, "The superseding request waits behind its peer.");
  peer.finish();
  assert.equal(first.channels.length, 1, "Keep the worker's cached recording.");
  assert.equal(first.requests().at(-1), latest);
  first.finish(latest);
  assert.equal(first.store.getSnapshot().accepted?.actionIndex, latest.actionIndex);
});

test("hiding a waiting owner withdraws it and resuming keeps its exact request, run and seed", (t) => {
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first");
  const hidden = laboratory(t, admission, "hidden");
  const visible = laboratory(t, admission, "visible");
  first.request();
  const token = hidden.request();
  visible.request();
  const before = hidden.store.getSnapshot().accepted;
  hidden.scheduler.setSchedulingPaused(true);
  first.finish();
  assert.equal(hidden.channels.length, 0);
  assert.equal(visible.requests().length, 1);
  assert.equal(hidden.store.getSnapshot().accepted, before);
  hidden.scheduler.setSchedulingPaused(false);
  visible.finish();
  assert.equal(hidden.requests()[0], token);
  hidden.finish(token);
  assert.equal(hidden.store.getSnapshot().accepted?.runId, token.runId);
  assert.equal(hidden.store.getSnapshot().accepted?.parameters.seed, token.parameters.seed);
});

test("a hidden in-flight result frees capacity without restarting or dispatching hidden queued work", (t) => {
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first");
  const peer = laboratory(t, admission, "peer");
  const active = first.request();
  first.scheduler.setSchedulingPaused(true);
  const queued = first.request(2);
  peer.request();
  assert.equal(peer.channels.length, 0);
  first.finish(active);
  assert.equal(peer.requests().length, 1);
  assert.equal(first.requests().length, 1);
  assert.equal(first.channels[0]?.disposed, false);
  first.scheduler.setSchedulingPaused(false);
  peer.finish();
  assert.equal(first.channels.length, 1);
  assert.equal(first.requests().at(-1), queued);
  first.finish(queued);
});

test("hidden stalled shared work times out, releases only after termination and offers an explicit same-run retry", (t) => {
  const events: string[] = [];
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first", { events });
  const peer = laboratory(t, admission, "peer", { events });
  const advance = clock(t);
  const before = first.store.getSnapshot().accepted;
  const original = first.request();
  first.scheduler.setSchedulingPaused(true);
  peer.request();
  advance(200);
  const failed = first.store.getSnapshot();
  assert.equal(failed.outcome?.outcome, "worker-timeout");
  assert.equal(failed.outcome?.retry, "retry-same-request");
  assert.equal(failed.requested, original);
  assert.equal(failed.accepted, before);
  assert.equal(first.channels[0]?.disposed, true);
  assert.ok(events.indexOf("first:dispose") < events.indexOf("peer:create"));
  assert.equal(peer.requests().length, 1);
  const retry = first.request();
  assert.equal(first.channels.length, 1, "No automatic restart while hidden.");
  first.scheduler.setSchedulingPaused(false);
  peer.finish();
  assert.equal(first.channels.length, 2);
  first.finish(retry);
  assert.equal(first.store.getSnapshot().accepted?.runId, original.runId);
  assert.equal(first.store.getSnapshot().accepted?.parameters.seed, original.parameters.seed);
});

test("a handshake that finishes while hidden releases startup capacity and later reuses its worker", (t) => {
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first", { autoHello: false });
  const peer = laboratory(t, admission, "peer");
  first.request();
  first.scheduler.setSchedulingPaused(true);
  peer.request();
  first.channels[0]?.receive({ messageKind: "hello" });
  assert.equal(peer.requests().length, 1);
  assert.equal(first.requests().length, 0);
  first.scheduler.setSchedulingPaused(false);
  peer.finish();
  assert.equal(first.channels.length, 1);
  assert.equal(first.requests().length, 1);
  first.finish();
});

for (const operation of ["cancel", "dispose", "crash", "malformed", "handshake-timeout"] as const) {
  test(operation + " frees capacity after worker termination and ignores late packets", (t) => {
    const events: string[] = [];
    const admission = createWorkerAdmission(1);
    const first = laboratory(t, admission, "first", {
      events,
      autoHello: operation !== "handshake-timeout",
    });
    const peer = laboratory(t, admission, "peer", { events });
    const advance = clock(t);
    const token = first.request();
    const oldChannel = first.channels[0];
    assert.ok(oldChannel);
    peer.request();
    if (operation === "crash") oldChannel.crash();
    else if (operation === "malformed") oldChannel.receive({ messageKind: "malformed" });
    else if (operation === "handshake-timeout") advance(100);
    else first.scheduler[operation]();
    assert.equal(peer.requests().length, 1);
    assert.ok(events.indexOf("first:dispose") < events.indexOf("peer:create"));
    const stopped = first.store.getSnapshot();
    oldChannel.receive({ messageKind: "hello" });
    oldChannel.receive({ messageKind: "result", token });
    assert.equal(first.store.getSnapshot(), stopped);
    peer.finish();
    assert.equal(admission.activeCount, 0);
    assert.equal(admission.queuedCount, 0);
  });
}

test("disposing a waiting laboratory removes its reservation without constructing a worker", (t) => {
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first");
  const cancelled = laboratory(t, admission, "cancelled");
  const last = laboratory(t, admission, "last");
  first.request();
  cancelled.request();
  last.request();
  cancelled.scheduler.dispose();
  first.finish();
  assert.equal(cancelled.channels.length, 0);
  assert.equal(last.requests().length, 1);
  last.finish();
});

test("a queued worker startup failure does not strand the next laboratory or fail its predecessor", (t) => {
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first");
  const broken = laboratory(t, admission, "broken", { throwOnCreate: true });
  const last = laboratory(t, admission, "last");
  first.request();
  broken.request();
  last.request();
  first.finish();
  assert.equal(first.store.getSnapshot().status, "accepted");
  assert.equal(broken.store.getSnapshot().outcome?.outcome, "environment-unsupported");
  assert.equal(last.requests().length, 1);
  last.finish();
  assert.equal(admission.activeCount, 0);
  assert.equal(admission.queuedCount, 0);
});

test("a completion subscriber's new request rejoins behind a queued peer", (t) => {
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first");
  const peer = laboratory(t, admission, "peer");
  first.request();
  peer.request();
  let followedUp = false;
  const unsubscribe = first.store.subscribe(() => {
    if (followedUp || first.store.getSnapshot().status !== "accepted") return;
    followedUp = true;
    first.request(3);
  });
  t.after(unsubscribe);
  first.finish();
  assert.equal(followedUp, true);
  assert.equal(peer.requests().length, 1);
  assert.equal(first.requests().length, 1);
  peer.finish();
  assert.equal(first.requests().length, 2);
  first.finish();
});

for (const operation of ["cancel", "dispose"] as const) {
  test(
    "a synchronously starting peer can " + operation + " a completed owner before publication",
    (t) => {
      const admission = createWorkerAdmission(1);
      const first = laboratory(t, admission, "first");
      const peer = laboratory(t, admission, "peer", {
        onCreate: () => first.scheduler[operation](),
      });
      const before = first.store.getSnapshot().accepted;
      first.request();
      peer.request();
      first.finish();
      assert.equal(first.channels[0]?.disposed, true);
      assert.equal(
        first.store.getSnapshot().accepted,
        before,
        "A stopped owner cannot publish late.",
      );
      assert.equal(peer.requests().length, 1);
      peer.finish();
      assert.equal(admission.activeCount, 0);
      assert.equal(admission.queuedCount, 0);
    },
  );
}

test("cancelling an owner preserves a fresh request issued synchronously by an admitted peer", (t) => {
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first");
  let followUp: RequestToken | undefined;
  const peer = laboratory(t, admission, "peer", {
    onCreate: () => {
      followUp = first.request(3);
    },
  });
  first.request();
  peer.request();
  first.scheduler.cancel();
  assert.ok(followUp);
  assert.equal(first.store.getSnapshot().requested, followUp);
  assert.equal(first.store.getSnapshot().pending, true, "Only the cancelled token may be paused.");
  assert.equal(first.channels[0]?.disposed, true);
  assert.equal(first.requests().length, 1);
  peer.finish();
  assert.equal(first.requests().at(-1), followUp);
  first.finish(followUp);
  assert.equal(first.store.getSnapshot().status, "accepted");
  assert.equal(first.store.getSnapshot().accepted?.actionIndex, followUp.actionIndex);
  assert.equal(first.store.getSnapshot().accepted?.parameters.lower, 3);
  assert.equal(admission.activeCount, 0);
  assert.equal(admission.queuedCount, 0);
});

test("disposing an old scheduler does not complete a replacement consumer's fresh request", (t) => {
  const admission = createWorkerAdmission(1);
  const first = laboratory(t, admission, "first");
  let followUp: RequestToken | undefined;
  const peer = laboratory(t, admission, "peer", {
    onCreate: () => {
      followUp = first.store.issue("measurement-change", { lower: 4 });
    },
  });
  first.request();
  peer.request();
  first.scheduler.dispose();
  assert.ok(followUp);
  assert.equal(first.store.getSnapshot().requested, followUp);
  assert.equal(first.store.getSnapshot().pending, true);
  assert.equal(
    first.store.publish({
      ...followUp,
      outputs: [INITIAL_OUTPUT],
      stepIndex: 20,
      simulationTime: 2,
      final: true,
    }).accepted,
    true,
    "The replacement consumer's request remains publishable.",
  );
  assert.equal(first.store.getSnapshot().accepted?.actionIndex, followUp.actionIndex);
  peer.finish();
  assert.equal(admission.activeCount, 0);
  assert.equal(admission.queuedCount, 0);
});

test("standalone scheduling retains its existing visible-time deadline semantics", (t) => {
  const lab = laboratory(t, undefined, "standalone");
  const advance = clock(t);
  lab.request();
  advance(100);
  lab.scheduler.setSchedulingPaused(true);
  advance(400);
  assert.equal(lab.store.getSnapshot().pending, true);
  lab.scheduler.setSchedulingPaused(false);
  advance(99);
  assert.equal(lab.store.getSnapshot().pending, true);
  advance(1);
  assert.equal(lab.store.getSnapshot().outcome?.outcome, "worker-timeout");
});

test("admission drains through both a throwing start and a throwing failure handler", () => {
  const admission = createWorkerAdmission(1);
  const first = {};
  const broken = {};
  const last = {};
  const started: string[] = [];
  let failed = 0;
  const unexpected = () => assert.fail("This owner should start successfully.");
  admission.acquire(first, () => started.push("first"), unexpected);
  admission.acquire(
    broken,
    () => {
      throw new Error("Startup failed.");
    },
    () => {
      failed++;
      throw new Error("The failing owner also threw while reporting.");
    },
  );
  admission.acquire(last, () => started.push("last"), unexpected);
  assert.doesNotThrow(() => admission.release(first));
  assert.deepEqual(started, ["first", "last"]);
  assert.equal(failed, 1);
  assert.equal(admission.activeCount, 1);
  assert.equal(admission.queuedCount, 0);
  admission.release(last);
  assert.equal(admission.activeCount, 0);
});

test("invalid-worker-concurrency-limit rejects unbounded or unusable admission capacities", () => {
  for (const limit of [
    0,
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () => createWorkerAdmission(limit),
      (error: unknown) =>
        error instanceof WorkerAdmissionConfigurationError &&
        error.code === "invalid-worker-concurrency-limit",
    );
  }
});
