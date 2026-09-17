import { createInstanceStore } from "../../../experiments/store/instanceStore.ts";
import {
  createDedicatedScheduler,
  type DedicatedScheduler,
  type SchedulerEvent,
  type WorkerChannel,
} from "../../../workers/scheduler/scheduler.ts";
import { createEventLedgerDescription } from "../eventLedgerFixture.ts";
import { analyticProbe } from "../fixtureAnalytic.ts";
import { createRuntimeWorkerChannel, sendWorkerHook } from "./channel.ts";
import { runtimeHostProtocol } from "./hostProtocol.ts";
import { RUNTIME_FIXTURE_EXPERIMENT_ID, RUNTIME_FIXTURE_SOURCE_DIGEST } from "./protocol.ts";

export type ExecutionLabel = "static" | "host" | "frankensim" | "unavailable";

export interface PlacementDiagnostics {
  workerMessages: number;
  staleRejections: number;
  events: readonly SchedulerEvent[];
}

export interface RuntimePlacement {
  readonly instanceId: string;
  readonly store: ReturnType<typeof createInstanceStore>;
  readonly scheduler: DedicatedScheduler;
  issueSetup(seed: string, frameSpeed: number): void;
  observerChange(frameSpeed: number): void;
  measurementChange(interval: number): void;
  presentationChange(): void;
  injectStale(): void;
  crashWorker(): void;
  forceProtocolMismatch(): void;
  dispose(): void;
  diagnostics(): PlacementDiagnostics;
  ledger(): ReturnType<typeof createEventLedgerDescription>;
  hostProbe(seed: string, frameSpeed: number): number;
}

const OUTPUTS = {
  fixtureProbe: {
    statuses: ["value"] as const,
    unit: "1",
    semanticKind: "scalar",
    ownerId: "runtime-fixture-analytic",
  },
  latentDraws: {
    statuses: ["value"] as const,
    unit: "1",
    semanticKind: "count",
    ownerId: "runtime-fixture-analytic",
  },
  noiseDraws: {
    statuses: ["value"] as const,
    unit: "1",
    semanticKind: "count",
    ownerId: "runtime-fixture-analytic",
  },
};

export function createRuntimePlacement(
  instanceId: string,
  blockWorkers: boolean,
): RuntimePlacement {
  const store = createInstanceStore({
    experimentId: RUNTIME_FIXTURE_EXPERIMENT_ID,
    instanceId,
    initialParameters: {
      seed: "1",
      frameSpeed: 0,
      observationInterval: 0.1,
    },
    parameterClasses: {
      seed: "input",
      frameSpeed: "observer",
      observationInterval: "measurement",
    },
    outputs: OUTPUTS,
  });
  const events: SchedulerEvent[] = [];
  let staleRejections = 0;
  let channel: WorkerChannel | null = null;
  const scheduler = createDedicatedScheduler({
    store,
    factory: () => {
      if (blockWorkers) throw new Error("Worker construction blocked");
      channel = createRuntimeWorkerChannel();
      return channel;
    },
    sourceDigest: RUNTIME_FIXTURE_SOURCE_DIGEST,
    protocol: runtimeHostProtocol(),
    report: (event) => {
      events.push(event);
      if (event.kind === "stale") staleRejections += 1;
    },
  });

  function dispatch(
    command: "setup-change" | "observer-change" | "measurement-change" | "presentation-change",
    patch: Record<string, number | string | boolean>,
  ): void {
    const token = store.issue(command, patch);
    scheduler.request(token, command);
  }

  return {
    instanceId,
    store,
    scheduler,
    issueSetup(seed, _frameSpeed) {
      dispatch("setup-change", { seed });
    },
    observerChange(frameSpeed) {
      dispatch("observer-change", { frameSpeed });
    },
    measurementChange(interval) {
      dispatch("measurement-change", { observationInterval: interval });
    },
    presentationChange() {
      dispatch("presentation-change", {});
    },
    injectStale() {
      const snapshot = store.getSnapshot();
      const accepted = snapshot.accepted;
      if (!accepted) return;
      const decision = store.publish({
        experimentId: accepted.experimentId,
        instanceId: accepted.instanceId,
        runId: accepted.runId,
        parentRunId: accepted.parentRunId,
        actionIndex: Math.max(0, accepted.actionIndex - 1),
        revisions: accepted.revisions,
        parameters: accepted.parameters,
        stepIndex: accepted.stepIndex,
        simulationTime: accepted.simulationTime,
        final: true,
        outputs: [
          {
            status: "value",
            quantityId: "fixtureProbe",
            unit: "1",
            semanticKind: "scalar",
            ownerId: "runtime-fixture-analytic",
            value: 999,
          },
        ],
      });
      if (!decision.accepted) staleRejections += 1;
    },
    crashWorker() {
      if (channel) sendWorkerHook(channel, "crash");
    },
    forceProtocolMismatch() {
      if (channel) sendWorkerHook(channel, "protocol-mismatch");
      dispatch("setup-change", { seed: "2" });
    },
    dispose() {
      scheduler.dispose();
      channel = null;
    },
    diagnostics() {
      return {
        workerMessages: scheduler.getWorkerMessageCount(),
        staleRejections,
        events: events.slice(),
      };
    },
    ledger() {
      const speed = Number(store.getSnapshot().accepted?.parameters.frameSpeed ?? 0);
      return createEventLedgerDescription(speed);
    },
    hostProbe(seed, frameSpeed) {
      return analyticProbe(seed, frameSpeed);
    },
  };
}
