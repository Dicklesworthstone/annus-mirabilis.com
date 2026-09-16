import assert from "node:assert/strict";
import test from "node:test";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import {
  createDedicatedScheduler,
  type HostProtocol,
  type SchedulerEvent,
  type WorkerChannel,
} from "../workers/scheduler/scheduler.ts";

const SOURCE_DIGEST = "bm06-source-digest-test";

function mockProtocol(): HostProtocol {
  return {
    version: "bm06-host-v1",
    decodeHello: () => ({ messageKind: "hello" }),
    decodeResponse: (_msg, token) => ({
      token,
      result: {
        kind: "accepted" as const,
        data: {
          stepIndex: 10,
          simulationTime: 1.0,
          outputs: [
            {
              status: "value" as const,
              quantityId: "concentration",
              unit: "mol/m^3",
              semanticKind: "scalar",
              ownerId: "bm-06",
              value: 1.0,
            },
          ],
        },
      },
    }),
  };
}

test("Scheduler Burst Coalescing: 1 in-flight + 50 burst requests -> 2 dispatched, 48 superseded", () => {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "inst-coalesce-1",
    initialParameters: { diffusivity: 1.0 },
    parameterClasses: { diffusivity: "input" },
    outputs: {
      concentration: {
        statuses: ["value"],
        unit: "mol/m^3",
        semanticKind: "scalar",
        ownerId: "bm-06",
      },
    },
  });

  const events: SchedulerEvent[] = [];
  let workerListener: ((msg: unknown) => void) | null = null;
  const sentMessages: unknown[] = [];

  const mockChannel: WorkerChannel = {
    send(msg) {
      sentMessages.push(msg);
    },
    listen(onMsg) {
      workerListener = onMsg;
      onMsg({ messageKind: "hello" });
      return () => {
        workerListener = null;
      };
    },
    dispose() {},
  };

  const scheduler = createDedicatedScheduler({
    store,
    factory: () => mockChannel,
    sourceDigest: SOURCE_DIGEST,
    protocol: mockProtocol(),
    report: (e) => events.push(e),
  });

  // 1. Initial request (in-flight)
  const token0 = store.issue("setup-change", { diffusivity: 2.0 });
  scheduler.request(token0, "setup-change");

  assert.equal(events.length, 1);
  const firstEvent = events[0];
  assert.ok(firstEvent);
  assert.equal(firstEvent.kind, "dispatched");
  assert.equal(firstEvent.actionIndex, token0.actionIndex);

  // 2. Burst of 50 further changes while token0 is in-flight
  let lastToken = token0;
  for (let i = 1; i <= 50; i++) {
    lastToken = store.issue("setup-change", { diffusivity: 2.0 + i * 0.1 });
    scheduler.request(lastToken, "setup-change");
  }

  // Check superseded count before worker responds
  const supersededBefore = events.filter((e) => e.kind === "superseded");
  assert.equal(supersededBefore.length, 49); // tokens 1..49 were superseded in the pending slot

  // 3. Worker completes token0
  assert.ok(workerListener !== null);
  const listener = workerListener as (msg: unknown) => void;
  listener({
    messageKind: "result",
    protocolVersion: "bm06-host-v1",
    sourceDigest: SOURCE_DIGEST,
    token: token0,
    result: {
      kind: "accepted",
      data: {
        stepIndex: 10,
        simulationTime: 1.0,
        outputs: [
          {
            status: "value",
            quantityId: "concentration",
            unit: "mol/m^3",
            semanticKind: "scalar",
            ownerId: "bm-06",
            value: 2.0,
          },
        ],
      },
    },
  });

  // Token 50 should now be dispatched
  const dispatchedEvents = events.filter((e) => e.kind === "dispatched");
  assert.equal(dispatchedEvents.length, 2, "Expected exactly 2 dispatches: token0 and lastToken");
  const secondDispatch = dispatchedEvents[1];
  assert.ok(secondDispatch);
  assert.equal(secondDispatch.actionIndex, lastToken.actionIndex);

  // 4. Worker completes lastToken (action 51)
  listener({
    messageKind: "result",
    protocolVersion: "bm06-host-v1",
    sourceDigest: SOURCE_DIGEST,
    token: lastToken,
    result: {
      kind: "accepted",
      data: {
        stepIndex: 20,
        simulationTime: 2.0,
        outputs: [
          {
            status: "value",
            quantityId: "concentration",
            unit: "mol/m^3",
            semanticKind: "scalar",
            ownerId: "bm-06",
            value: 7.0,
          },
        ],
      },
    },
  });

  const completedEvents = events.filter((e) => e.kind === "completed");
  assert.equal(completedEvents.length, 1, "Expected lastToken to be completed and published");

  const staleEvents = events.filter((e) => e.kind === "stale");
  assert.equal(
    staleEvents.length,
    1,
    "Expected in-flight token0 to be stale upon publication check",
  );

  // Final store snapshot corresponds to the last requested actionIndex
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.accepted?.actionIndex, lastToken.actionIndex);
  assert.equal(snapshot.accepted?.parameters.diffusivity, lastToken.parameters.diffusivity);
});
