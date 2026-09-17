import assert from "node:assert/strict";
import test from "node:test";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import {
  createDedicatedScheduler,
  type HostProtocol,
  type WorkerChannel,
} from "../workers/scheduler/scheduler.ts";
import { shouldInitializeWorker } from "../workers/scheduler/loadOnDemand.ts";

const SOURCE_DIGEST = "bm06-source-digest-test";

function mockProtocol(): HostProtocol {
  return {
    version: "bm06-host-v1",
    decodeHello: () => ({ messageKind: "hello" }),
    decodeResponse: (msg, token) => {
      const typed = msg as {
        token?: typeof token;
        result?: {
          kind: "accepted" | "refused" | "failed";
          data?: unknown;
          refusal?: unknown;
          outcome?: unknown;
        };
      } | null;
      if (typed && typed.result) {
        return {
          token: typed.token ?? token,
          result: typed.result as any,
        };
      }
      return {
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
      };
    },
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

test("Face & 2D/3D Switches: switching between 2D and 3D or changing faces mid-run keeps runId, continues stepIndex, and sends zero worker messages / zero extra draws", () => {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "inst-view-switch-1",
    initialParameters: { diffusivity: 1.0, viewMode: "2d", face: "reading" },
    parameterClasses: { diffusivity: "input", viewMode: "presentation", face: "presentation" },
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

  // 1. Initial physical setup-change
  const token1 = store.issue("setup-change", { diffusivity: 2.0 });
  scheduler.request(token1, "setup-change");
  assert.equal(sentMessageCount, 1);

  assert.ok(workerListener !== null);
  (workerListener as (msg: unknown) => void)({
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
  assert.equal(snapshot1.status, "accepted");
  const initialRunId = snapshot1.accepted?.runId;
  assert.ok(initialRunId);
  assert.equal(snapshot1.accepted?.stepIndex, 10);
  assert.equal(snapshot1.accepted?.simulationTime, 1.0);
  assert.equal(snapshot1.accepted?.parameters.viewMode, "2d");
  assert.equal(snapshot1.accepted?.parameters.face, "reading");

  // 2. Switch 2D to 3D via presentation-change
  const token2 = store.issue("presentation-change", { viewMode: "3d" });
  scheduler.request(token2, "presentation-change");

  // Zero extra worker messages / zero extra draws
  assert.equal(sentMessageCount, 1, "Switching 2D to 3D must send 0 worker messages");
  assert.equal(scheduler.getWorkerMessageCount(), 1);

  const snapshot2 = store.getSnapshot();
  assert.equal(snapshot2.status, "accepted");
  assert.equal(snapshot2.accepted?.runId, initialRunId, "runId must be preserved across 2D/3D switch");
  assert.equal(snapshot2.accepted?.stepIndex, 10, "stepIndex must continue unchanged across 2D/3D switch");
  assert.equal(snapshot2.accepted?.simulationTime, 1.0, "simulationTime must continue unchanged across 2D/3D switch");
  assert.equal(snapshot2.accepted?.parameters.viewMode, "3d");
  assert.equal(snapshot2.accepted?.parameters.face, "reading");

  // 3. Switch face from reading to source via presentation-change
  const token3 = store.issue("presentation-change", { face: "source" });
  scheduler.request(token3, "presentation-change");

  assert.equal(sentMessageCount, 1, "Switching face must send 0 worker messages");
  assert.equal(scheduler.getWorkerMessageCount(), 1);

  const snapshot3 = store.getSnapshot();
  assert.equal(snapshot3.status, "accepted");
  assert.equal(snapshot3.accepted?.runId, initialRunId, "runId must be preserved across face change");
  assert.equal(snapshot3.accepted?.stepIndex, 10, "stepIndex must continue unchanged across face change");
  assert.equal(snapshot3.accepted?.simulationTime, 1.0, "simulationTime must continue unchanged across face change");
  assert.equal(snapshot3.accepted?.parameters.viewMode, "3d");
  assert.equal(snapshot3.accepted?.parameters.face, "source");

  // 4. Continuing simulation continues on the same runId with next stepIndex
  const token4 = store.issue("continue", {});
  scheduler.request(token4);
  assert.equal(sentMessageCount, 2);

  (workerListener as (msg: unknown) => void)({
    messageKind: "result",
    protocolVersion: "bm06-host-v1",
    sourceDigest: SOURCE_DIGEST,
    token: token4,
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
            value: 2.5,
          },
        ],
      },
    },
  });

  const snapshot4 = store.getSnapshot();
  assert.equal(snapshot4.status, "accepted");
  assert.equal(snapshot4.accepted?.runId, initialRunId, "runId continues on same run");
  assert.equal(snapshot4.accepted?.stepIndex, 20);
  assert.equal(snapshot4.accepted?.simulationTime, 2.0);
});

test("Refused Update: a refused update preserves the previous accepted snapshot and shows the refusal against the requested settings", () => {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "inst-refusal-1",
    initialParameters: { diffusivity: 1.0, interval: 1 },
    parameterClasses: { diffusivity: "input", interval: "input" },
    outputs: {
      concentration: {
        statuses: ["value"],
        unit: "mol/m^3",
        semanticKind: "scalar",
        ownerId: "bm-06",
      },
    },
  });

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
  });

  // Step 1: Valid setup-change accepted
  const token1 = store.issue("setup-change", { diffusivity: 2.0 });
  scheduler.request(token1, "setup-change");

  assert.ok(workerListener !== null);
  (workerListener as (msg: unknown) => void)({
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
  assert.equal(snapshot1.status, "accepted");
  assert.equal(snapshot1.accepted?.actionIndex, 1);
  assert.equal(snapshot1.accepted?.parameters.diffusivity, 2.0);
  assert.equal(snapshot1.accepted?.parameters.interval, 1);

  // Step 2: Setup change requesting an off-grid interval
  const token2 = store.issue("setup-change", { interval: 99 });
  scheduler.request(token2, "setup-change");

  const snapshotPending = store.getSnapshot();
  assert.equal(snapshotPending.status, "pending");
  assert.equal(snapshotPending.requested?.parameters.interval, 99);
  assert.equal(snapshotPending.accepted?.parameters.interval, 1);

  // Worker returns a registered refusal
  (workerListener as (msg: unknown) => void)({
    messageKind: "result",
    protocolVersion: "bm06-host-v1",
    sourceDigest: SOURCE_DIGEST,
    token: token2,
    result: {
      kind: "refused",
      refusal: {
        code: "off-replay-grid",
        domainKind: "numerical",
        affected: { parameterIds: ["interval"] },
        message: "This interval is not on the recorded time grid.",
        rankedRepairs: [
          { label: "Choose a recorded interval, or start a new run with a different grid." },
        ],
      },
    },
  });

  const snapshotRefused = store.getSnapshot();
  assert.equal(snapshotRefused.status, "refused");
  assert.equal(snapshotRefused.pending, false);
  assert.ok(snapshotRefused.refusal);
  assert.equal(snapshotRefused.refusal?.code, "off-replay-grid");

  // Invariant from AGENTS.md:
  // "a refused update preserves the previous accepted snapshot while clearly distinguishing it from the requested settings; never display old numbers beneath new labels"
  assert.equal(snapshotRefused.requested?.actionIndex, 2);
  assert.equal(snapshotRefused.requested?.parameters.interval, 99, "Requested settings preserved in requested");
  assert.equal(snapshotRefused.accepted?.actionIndex, 1, "Previous accepted actionIndex preserved");
  assert.equal(snapshotRefused.accepted?.parameters.interval, 1, "Previous accepted parameters preserved");
  assert.equal(snapshotRefused.accepted?.parameters.diffusivity, 2.0);
  const acceptedOutput = snapshotRefused.accepted?.outputs[0];
  assert.ok(acceptedOutput && acceptedOutput.status === "value");
  assert.equal((acceptedOutput as { value: number }).value, 2.0, "Accepted output values preserved without corruption");
});

test("On-Demand Loading: with reading-only on, no worker loads until an explicit action", () => {
  // Reading-only: true suppresses worker initialization on route entry / viewport / intent
  assert.equal(
    shouldInitializeWorker({ readingOnly: true, autoload: true }),
    false,
    "With reading-only on, autoload does not initialize worker",
  );
  assert.equal(
    shouldInitializeWorker({ readingOnly: true, viewportTrigger: true, intentTrigger: true }),
    false,
    "With reading-only on, viewport/intent does not initialize worker",
  );

  // Only an explicit action initializes the worker when reading-only is true
  assert.equal(
    shouldInitializeWorker({ readingOnly: true }, true),
    true,
    "Explicit user interaction initializes worker even when reading-only is on",
  );

  // When reading-only is false/omitted, standard triggers work
  assert.equal(
    shouldInitializeWorker({ autoload: true }, false),
    true,
    "Autoload initializes worker when reading-only is off",
  );
  assert.equal(
    shouldInitializeWorker({ viewportTrigger: true }, false),
    true,
    "Viewport trigger initializes worker when reading-only is off",
  );
  assert.equal(
    shouldInitializeWorker({ intentTrigger: true }, false),
    true,
    "Intent trigger initializes worker when reading-only is off",
  );
  assert.equal(
    shouldInitializeWorker({}, false),
    false,
    "No trigger and no action keeps worker uninitialized",
  );
});
