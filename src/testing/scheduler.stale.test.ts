import assert from "node:assert/strict";
import test from "node:test";
import type { RequestToken } from "../experiments/store/instanceStore.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import type { Computation } from "../physics/reference/diffusion/ftcs.ts";
import {
  createDedicatedScheduler,
  type HostProtocol,
  type SchedulerEvent,
  type WorkerChannel,
} from "../workers/scheduler/scheduler.ts";

const SOURCE_DIGEST = "bm06-source-digest-test";

interface TestResponsePayload {
  token: RequestToken;
  result: Computation<{
    outputs: readonly {
      status: "value";
      quantityId: string;
      unit: string;
      semanticKind: string;
      ownerId: string;
      value: number;
    }[];
    stepIndex: number;
    simulationTime: number;
  }>;
}

function mockProtocol(): HostProtocol {
  return {
    version: "bm06-host-v1",
    decodeHello: () => ({ messageKind: "hello" }),
    decodeResponse: (msg, _token) => {
      const typed = msg as TestResponsePayload;
      return {
        token: typed.token,
        result: typed.result,
      };
    },
  };
}

test("Scheduler Stale Rejection: Injected late responses for older actionIndex or mismatched runId are refused", () => {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "inst-stale-1",
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

  const mockChannel: WorkerChannel = {
    send() {},
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

  // Step 1: Issue and complete action 1
  const token1 = store.issue("setup-change", { diffusivity: 2.0 });
  scheduler.request(token1, "setup-change");

  assert.ok(workerListener !== null);
  const listener = workerListener as (msg: unknown) => void;
  listener({
    messageKind: "result",
    protocolVersion: "bm06-host-v1",
    sourceDigest: SOURCE_DIGEST,
    token: token1,
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

  const snapshot1 = store.getSnapshot();
  assert.equal(snapshot1.accepted?.actionIndex, 1);
  const firstOutput = snapshot1.accepted?.outputs[0];
  assert.ok(firstOutput && firstOutput.status === "value");
  assert.equal((firstOutput as { value: number }).value, 2.0);

  // Step 2: Issue action 2
  const token2 = store.issue("setup-change", { diffusivity: 3.0 });
  scheduler.request(token2, "setup-change");

  // Injected late/stale response for action 1 (while action 2 is active)
  listener({
    messageKind: "result",
    protocolVersion: "bm06-host-v1",
    sourceDigest: SOURCE_DIGEST,
    token: token1, // stale token 1 with different value
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
            value: 999.0,
          },
        ],
      },
    },
  });

  // The store must NOT publish the stale value; snapshot remains unchanged from action 1
  const snapshotAfterStale = store.getSnapshot();
  assert.equal(snapshotAfterStale.accepted?.actionIndex, 1);
  const outputAfterStale = snapshotAfterStale.accepted?.outputs[0];
  assert.ok(outputAfterStale && outputAfterStale.status === "value");
  assert.equal((outputAfterStale as { value: number }).value, 2.0);

  // Check that stale event was recorded
  const staleEvents = events.filter((e) => e.kind === "stale");
  assert.equal(staleEvents.length, 1);
  const staleEvent = staleEvents[0];
  assert.ok(staleEvent);
  assert.equal(staleEvent.actionIndex, token1.actionIndex);
});
