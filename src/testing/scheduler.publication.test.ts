import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createInstanceStore, type RequestToken } from "../experiments/store/instanceStore.ts";
import { createWorkerAdmission } from "../workers/scheduler/admission.ts";
import {
  createDedicatedScheduler,
  type SchedulerEvent,
  type WorkerChannel,
} from "../workers/scheduler/scheduler.ts";
import { runtimeHostProtocol } from "./runtime-fixtures/app/hostProtocol.ts";
import {
  RUNTIME_FIXTURE_EXPERIMENT_ID,
  RUNTIME_FIXTURE_PROTOCOL,
  RUNTIME_FIXTURE_SOURCE_DIGEST,
} from "./runtime-fixtures/app/protocol.ts";
import {
  ANALYTIC_OWNER_ID,
  ANALYTIC_QUANTITY_ID,
  analyticProbe,
} from "./runtime-fixtures/fixtureAnalytic.ts";

/** The existing runtime fixture supplies the owner and wire decoder; the real store judges it. */
function response(
  token: RequestToken,
  changes: Readonly<{
    stepIndex?: number;
    simulationTime?: number;
    unit?: string;
    ownerId?: string;
    value?: number;
  }> = {},
) {
  return {
    messageKind: "result",
    protocolVersion: RUNTIME_FIXTURE_PROTOCOL,
    sourceDigest: RUNTIME_FIXTURE_SOURCE_DIGEST,
    token,
    result: {
      kind: "accepted",
      data: {
        stepIndex: changes.stepIndex ?? 10,
        simulationTime: changes.simulationTime ?? 1,
        outputs: [
          {
            status: "value",
            quantityId: ANALYTIC_QUANTITY_ID,
            unit: changes.unit ?? "1",
            semanticKind: "scalar",
            ownerId: changes.ownerId ?? ANALYTIC_OWNER_ID,
            value:
              changes.value ??
              analyticProbe(String(token.parameters.seed), Number(token.parameters.frameSpeed)),
          },
        ],
      },
    },
  };
}

function laboratory(t: TestContext) {
  const store = createInstanceStore({
    experimentId: RUNTIME_FIXTURE_EXPERIMENT_ID,
    instanceId: "publication-laboratory",
    initialParameters: { seed: "1905", frameSpeed: 0 },
    parameterClasses: { seed: "input", frameSpeed: "observer" },
    outputs: {
      [ANALYTIC_QUANTITY_ID]: {
        statuses: ["value"],
        unit: "1",
        semanticKind: "scalar",
        ownerId: ANALYTIC_OWNER_ID,
      },
    },
  });
  const admission = createWorkerAdmission(1);
  const events: SchedulerEvent[] = [];
  const channels: Array<{
    receive: (message: unknown) => void;
    requests: RequestToken[];
    disposed: boolean;
  }> = [];
  const scheduler = createDedicatedScheduler({
    store,
    admission,
    sourceDigest: RUNTIME_FIXTURE_SOURCE_DIGEST,
    protocol: runtimeHostProtocol(),
    report: (event) => events.push(event),
    factory(): WorkerChannel {
      const channel = {
        receive: (_message: unknown) => {},
        requests: [] as RequestToken[],
        disposed: false,
      };
      channels.push(channel);
      return {
        send(message) {
          const sent = message as { messageKind: string; token: RequestToken };
          if (sent.messageKind === "request") channel.requests.push(sent.token);
        },
        listen(receive) {
          channel.receive = receive;
          receive({
            messageKind: "hello",
            protocolVersion: RUNTIME_FIXTURE_PROTOCOL,
            sourceDigest: RUNTIME_FIXTURE_SOURCE_DIGEST,
          });
          // Keep the callback so a queued late message can test the connection-generation fence.
          return () => {};
        },
        dispose() {
          channel.disposed = true;
        },
      };
    },
  });
  t.after(() => scheduler.dispose());
  function latestChannel() {
    const channel = channels.at(-1);
    assert.ok(channel);
    return channel;
  }
  function request(frameSpeed: number) {
    const token = store.issue("observer-change", { frameSpeed });
    scheduler.request(token);
    return token;
  }
  const initial = store.issue("setup-change");
  scheduler.request(initial);
  latestChannel().receive(response(initial));
  assert.equal(store.getSnapshot().status, "accepted");
  return { store, scheduler, admission, events, channels, initial, request, latestChannel };
}

for (const [description, changes, reason] of [
  ["wrong units", { unit: "m" }, /^malformed-publication$/],
  ["unregistered owner", { ownerId: "unregistered" }, /^malformed-publication$/],
  ["nonfinite output", { value: Number.NaN }, /^unattributed-throw:/],
  ["backward solver step", { stepIndex: 9 }, /^non-monotone-step$/],
  ["backward scientific time", { simulationTime: 0.5 }, /^non-monotone-step$/],
] as const) {
  test(`a current response with ${description} terminates pending work and can recover`, (t) => {
    const f = laboratory(t);
    const accepted = f.store.getSnapshot().accepted;
    const token = f.request(0.6);
    const oldChannel = f.latestChannel();
    oldChannel.receive(response(token, changes));
    const failed = f.store.getSnapshot();
    assert.equal(failed.status, "unavailable");
    assert.equal(failed.pending, false);
    assert.equal(failed.outcome?.outcome, "invariant-violation");
    assert.equal(failed.outcome?.retry, "new-run");
    assert.match(String(failed.outcome?.details?.reason), reason);
    assert.equal(failed.accepted, accepted, "A rejected result never replaces the legal one.");
    assert.equal(failed.requested, token, "The refused request remains identifiable.");
    assert.equal(oldChannel.disposed, true);
    assert.equal(f.admission.activeCount, 0);
    assert.equal(f.admission.queuedCount, 0);
    assert.equal(f.events.at(-1)?.kind, "failed");
    assert.equal(f.events.at(-1)?.actionIndex, token.actionIndex);

    const retry = f.store.issue("setup-change", { seed: "1906" });
    f.scheduler.request(retry);
    const replacement = f.latestChannel();
    assert.notEqual(replacement, oldChannel);
    oldChannel.receive(response(token));
    assert.equal(f.store.getSnapshot().status, "pending");
    assert.equal(f.store.getSnapshot().accepted, accepted);
    replacement.receive(response(retry));
    assert.equal(f.store.getSnapshot().status, "accepted");
    assert.equal(f.store.getSnapshot().accepted?.actionIndex, retry.actionIndex);
    assert.equal(f.admission.activeCount, 0);
  });
}

test("a late decoded response does not consume the active request or release its worker slot", (t) => {
  const f = laboratory(t);
  const accepted = f.store.getSnapshot().accepted;
  const token = f.request(0.6);
  const channel = f.latestChannel();
  channel.receive(response(f.initial));
  assert.equal(f.store.getSnapshot().status, "pending");
  assert.equal(f.store.getSnapshot().accepted, accepted);
  assert.equal(f.admission.activeCount, 1);
  assert.equal(channel.disposed, false);
  assert.equal(f.events.at(-1)?.kind, "stale");
  channel.receive(response(token));
  assert.equal(f.store.getSnapshot().status, "accepted");
  assert.equal(f.store.getSnapshot().accepted?.actionIndex, token.actionIndex);
  assert.equal(f.admission.activeCount, 0);
});

test("a rejected superseded response leaves the latest queued calculation free to complete", (t) => {
  const f = laboratory(t);
  const accepted = f.store.getSnapshot().accepted;
  const previous = f.request(0.2);
  const latest = f.request(0.6);
  const channel = f.latestChannel();
  channel.receive(response(previous, { unit: "m" }));
  assert.equal(f.store.getSnapshot().status, "pending");
  assert.equal(f.store.getSnapshot().requested, latest);
  assert.equal(f.store.getSnapshot().accepted, accepted);
  assert.equal(channel.requests.at(-1), latest);
  assert.equal(channel.disposed, false);
  channel.receive(response(latest));
  assert.equal(f.store.getSnapshot().status, "accepted");
  assert.equal(f.store.getSnapshot().accepted?.actionIndex, latest.actionIndex);
  assert.equal(
    f.events.some((event) => event.kind === "failed"),
    false,
  );
});

test("a completed or paused request is not overwritten by a rejected late publication", (t) => {
  const f = laboratory(t);
  const token = f.request(0.6);
  f.store.pause();
  const paused = f.store.getSnapshot();
  f.latestChannel().receive(response(token));
  assert.equal(f.store.getSnapshot(), paused);
  assert.equal(f.events.at(-1)?.kind, "stale");
  assert.equal(f.admission.activeCount, 0);
});

test("a failure subscriber can immediately start new work without old teardown cancelling it", (t) => {
  const f = laboratory(t);
  const token = f.request(0.6);
  const oldChannel = f.latestChannel();
  let retry: RequestToken | null = null;
  const unsubscribe = f.store.subscribe(() => {
    if (retry || f.store.getSnapshot().outcome?.outcome !== "invariant-violation") return;
    retry = f.store.issue("setup-change", { seed: "1906" });
    f.scheduler.request(retry);
  });
  t.after(unsubscribe);
  oldChannel.receive(response(token, { unit: "m" }));
  assert.ok(retry);
  assert.equal(oldChannel.disposed, true);
  assert.equal(f.store.getSnapshot().status, "pending");
  assert.equal(f.store.getSnapshot().requested, retry);
  assert.equal(f.admission.activeCount, 1);
  f.latestChannel().receive(response(retry));
  assert.equal(f.store.getSnapshot().status, "accepted");
  assert.equal(f.store.getSnapshot().accepted?.actionIndex, (retry as RequestToken).actionIndex);
  assert.equal(f.admission.activeCount, 0);
});
