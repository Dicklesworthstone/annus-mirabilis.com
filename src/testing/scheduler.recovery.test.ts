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

test("Scheduler Recovery: Worker crash triggers bounded reconnects and fails cleanly to environment-unsupported", () => {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "inst-recovery-1",
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
  let errorCallback: (() => void) | null = null;
  let factoryCount = 0;

  const mockFactory = (): WorkerChannel => {
    factoryCount++;
    return {
      send() {},
      listen(onMsg, onErr) {
        errorCallback = onErr;
        onMsg({ messageKind: "hello" });
        return () => {
          errorCallback = null;
        };
      },
      dispose() {},
    };
  };

  const scheduler = createDedicatedScheduler({
    store,
    factory: mockFactory,
    sourceDigest: SOURCE_DIGEST,
    protocol: mockProtocol(),
    report: (e) => events.push(e),
    maxRestarts: 3,
  });

  // Request 1: triggers factory creation #1
  const token1 = store.issue("setup-change", { diffusivity: 2.0 });
  scheduler.request(token1, "setup-change");
  assert.equal(factoryCount, 1);

  // Simulate Crash #1
  assert.ok(errorCallback !== null);
  const triggerError1 = errorCallback as () => void;
  triggerError1();

  // Request 2: triggers factory creation #2
  const token2 = store.issue("setup-change", { diffusivity: 3.0 });
  scheduler.request(token2, "setup-change");
  assert.equal(factoryCount, 2);

  // Simulate Crash #2
  assert.ok(errorCallback !== null);
  const triggerError2 = errorCallback as () => void;
  triggerError2();

  // Request 3: triggers factory creation #3
  const token3 = store.issue("setup-change", { diffusivity: 4.0 });
  scheduler.request(token3, "setup-change");
  assert.equal(factoryCount, 3);

  // Simulate Crash #3
  assert.ok(errorCallback !== null);
  const triggerError3 = errorCallback as () => void;
  triggerError3();

  // Request 4: Exceeds maxRestarts (3). Should cleanly transition to environment-unsupported
  const token4 = store.issue("setup-change", { diffusivity: 5.0 });
  scheduler.request(token4, "setup-change");

  const snapshot = store.getSnapshot();
  assert.equal(snapshot.status, "unavailable");
  assert.equal(snapshot.outcome?.outcome, "environment-unsupported");
});
