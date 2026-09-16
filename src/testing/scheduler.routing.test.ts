import assert from "node:assert/strict";
import test from "node:test";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import {
  createDedicatedScheduler,
  type HostProtocol,
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

test("Command Routing: presentation-change sends ZERO worker messages and updates snapshot directly", () => {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "inst-routing-1",
    initialParameters: { diffusivity: 1.0, viewMode: "contour" },
    parameterClasses: { diffusivity: "input", viewMode: "presentation" },
    outputs: {
      concentration: {
        statuses: ["value"],
        unit: "mol/m^3",
        semanticKind: "scalar",
        ownerId: "bm-06",
      },
    },
  });

  let sentMessageCount = 0;
  let workerListener: ((msg: unknown) => void) | null = null;

  const mockChannel: WorkerChannel = {
    send() {
      sentMessageCount++;
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
  });

  // 1. Initial physical setup-change: dispatches to worker
  const token1 = store.issue("setup-change", { diffusivity: 2.0 });
  scheduler.request(token1, "setup-change");

  assert.equal(sentMessageCount, 1, "Physical setup-change sent 1 message to worker");
  assert.equal(scheduler.getWorkerMessageCount(), 1);

  // Complete token 1
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

  const snapshotBefore = store.getSnapshot();
  assert.equal(snapshotBefore.accepted?.actionIndex, 1);
  assert.equal(snapshotBefore.accepted?.parameters.viewMode, "contour");

  // 2. Presentation change (e.g. viewMode: "particles")
  const token2 = store.issue("presentation-change", { viewMode: "particles" });
  scheduler.request(token2, "presentation-change");

  // Worker message count MUST NOT increase!
  assert.equal(sentMessageCount, 1, "presentation-change MUST NOT send any worker messages");
  assert.equal(scheduler.getWorkerMessageCount(), 1);

  // Store snapshot must update directly with presentation change
  const snapshotAfter = store.getSnapshot();
  assert.equal(snapshotAfter.accepted?.actionIndex, 2);
  assert.equal(snapshotAfter.accepted?.parameters.viewMode, "particles");
  assert.equal(snapshotAfter.status, "accepted");
});

test("Instance Isolation: Two instances on one page never share queues, runs, or snapshots", () => {
  const storeA = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "inst-iso-A",
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

  const storeB = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "inst-iso-B",
    initialParameters: { diffusivity: 10.0 },
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

  const tokenA = storeA.issue("setup-change", { diffusivity: 2.0 });
  const tokenB = storeB.issue("setup-change", { diffusivity: 20.0 });

  assert.notEqual(tokenA.instanceId, tokenB.instanceId);
  assert.notEqual(tokenA.runId, tokenB.runId);
  assert.notEqual(
    storeA.getSnapshot().requested?.parameters.diffusivity,
    storeB.getSnapshot().requested?.parameters.diffusivity,
  );
});
