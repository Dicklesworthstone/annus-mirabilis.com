/**
 * Dedicated-Worker Scheduler with chunking, coalescing, supersession, crash recovery,
 * performance marks, and command-class routing.
 *
 * Requirements:
 * 1. Lazy worker creation: Connects on demand.
 * 2. Burst coalescing: With 1 request in flight, a burst of 50 further changes produces
 *    exactly two evaluations (in-flight + newest) and 48 superseded outcomes.
 * 3. Out-of-order rejection: Stale responses (older actionIndex or mismatched token) are
 *    rejected before store publication and never modify accepted snapshot.
 * 4. Command-class routing:
 *    - `presentation-change`: Sends ZERO worker messages.
 *    - `observer-change`: Produces no simulation draws.
 *    - `measurement-change`: Advances only the measurement noise stream.
 *    - `setup-change` / `physical-intervention`: Full worker dispatch.
 * 5. Crash recovery: Reconnects up to 3 times before cleanly failing to `environment-unsupported`.
 * 6. Performance marks: Emits `am:input`, `am:accepted`, `am:painted` with { instanceId, actionIndex, snapshotVersion }.
 * 7. Two instances on one page never share queues, runs, or snapshots.
 * 8. Shared-memory mode is unreachable; works with crossOriginIsolated === false.
 *
 * Spec: AGENTS.md §6.2, §15.4, §15.5, and am-rt-worker-scheduler-7tl
 */

import type { CommandClass } from "../../content/schemas/experiment.ts";
import {
  type ExecutionOutcomeId,
  executionOutcomeRegistry,
} from "../../experiments/results/outcomes.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import type {
  createInstanceStore,
  PublicationDecision,
  RequestToken,
} from "../../experiments/store/instanceStore.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { markAccepted, markInput } from "./marks.ts";

export type WorkerChannel = Readonly<{
  send(message: unknown): void;
  listen(onMessage: (message: unknown) => void, onError: () => void): () => void;
  dispose(): void;
}>;

export type HostProtocol = Readonly<{
  version: string;
  decodeHello(message: unknown, digest: string): unknown;
  decodeResponse(
    message: unknown,
    token: RequestToken,
    digest: string,
  ): Readonly<{
    token: RequestToken;
    result: Computation<{
      outputs: readonly ScientificResult[];
      stepIndex: number;
      simulationTime: number;
    }>;
  }>;
}>;

type Store = ReturnType<typeof createInstanceStore>;

export type SchedulerEvent = Readonly<{
  kind: "dispatched" | "superseded" | "stale" | "completed" | "failed";
  actionIndex: number;
  commandClass?: CommandClass | undefined;
  workerMessageCount?: number | undefined;
}>;

export interface DedicatedSchedulerOptions {
  readonly store: Store;
  readonly factory: () => WorkerChannel;
  readonly sourceDigest: string;
  readonly protocol: HostProtocol;
  readonly report?: ((event: SchedulerEvent) => void) | undefined;
  readonly maxRestarts?: number | undefined;
}

export interface DedicatedScheduler {
  request(token: RequestToken, commandClass?: CommandClass): void;
  cancel(): void;
  dispose(): void;
  getWorkerMessageCount(): number;
  getRestartCount(): number;
}

export function createDedicatedScheduler(options: DedicatedSchedulerOptions): DedicatedScheduler {
  const { store, factory, sourceDigest, protocol, report = () => {}, maxRestarts = 3 } = options;

  let channel: WorkerChannel | null = null;
  let unsubscribe: (() => void) | null = null;
  let active: RequestToken | null = null;
  let pending: RequestToken | null = null;
  let ready = false;
  let disposed = false;
  let cancelSent = false;
  let epoch = 0;
  let failures = 0;
  let workerMessageCount = 0;

  function notify(
    kind: SchedulerEvent["kind"],
    token: RequestToken,
    commandClass?: CommandClass,
  ): void {
    try {
      report({
        kind,
        actionIndex: token.actionIndex,
        ...(commandClass ? { commandClass } : {}),
        workerMessageCount,
      });
    } catch {
      /* Diagnostics cannot alter state */
    }
  }

  function close(): void {
    epoch++;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (channel) {
      channel.dispose();
      channel = null;
    }
    active = null;
    ready = false;
    cancelSent = false;
  }

  function fail(id: Exclude<ExecutionOutcomeId, "budget-exhausted">): void {
    const token = pending ?? active;
    pending = null;
    if (token) {
      store.fail(token, { outcome: id, ...executionOutcomeRegistry[id] });
      notify("failed", token);
    }
    failures++;
    close();
  }

  function dispatch(): void {
    if (!ready || !channel || active || !pending || disposed) return;
    active = pending;
    pending = null;
    cancelSent = false;

    try {
      channel.send({
        messageKind: "request",
        protocolVersion: protocol.version,
        sourceDigest,
        token: active,
      });
      workerMessageCount++;
      notify("dispatched", active);
    } catch {
      fail("transport-error");
    }
  }

  function connect(): void {
    if (channel || disposed) return;
    if (failures >= maxRestarts) {
      fail("environment-unsupported");
      return;
    }

    try {
      channel = factory();
      const generation = ++epoch;
      unsubscribe = channel.listen(
        (message) => {
          if (generation !== epoch || disposed) return;
          try {
            if (!ready) {
              protocol.decodeHello(message, sourceDigest);
              ready = true;
              dispatch();
              return;
            }

            if (!active) return;
            const response = protocol.decodeResponse(message, active, sourceDigest);
            const token = active;
            let decision: PublicationDecision;

            if (response.result.kind === "accepted") {
              decision = store.publish({
                ...response.token,
                ...response.result.data,
                final: true,
              });
              if (decision.accepted) {
                const snapshot = store.getSnapshot();
                const snapshotVersion = snapshot.accepted?.snapshotVersion ?? 0;
                markAccepted(token.instanceId, token.actionIndex, snapshotVersion);
              }
            } else if (response.result.kind === "refused") {
              decision = store.refuse(response.token, response.result.refusal);
            } else {
              decision = store.fail(response.token, response.result.outcome);
            }

            notify(decision.accepted ? "completed" : "stale", response.token ?? token);
            active = null;
            dispatch();
          } catch (err: unknown) {
            const code =
              err &&
              typeof err === "object" &&
              "code" in err &&
              typeof (err as { code: unknown }).code === "string"
                ? (err as { code: string }).code
                : undefined;
            if (
              code === "artifact-mismatch" ||
              code === "protocol-mismatch" ||
              code === "malformed-response"
            ) {
              fail(code);
            } else {
              fail("malformed-response");
            }
          }
        },
        () => {
          if (generation === epoch && !disposed) {
            fail("worker-crashed");
          }
        },
      );
    } catch {
      fail("environment-unsupported");
    }
  }

  return Object.freeze({
    request(token: RequestToken, commandClass?: CommandClass): void {
      if (disposed) throw new Error("The laboratory scheduler was disposed.");
      if (store.getSnapshot().requested !== token) {
        throw new TypeError("Only the store's currently issued token can be scheduled.");
      }

      markInput(token.instanceId, token.actionIndex);

      // Rule: presentation-change sends NO worker messages
      if (commandClass === "presentation-change") {
        const currentAccepted = store.getSnapshot().accepted;
        if (currentAccepted) {
          const outputs: ScientificResult[] = currentAccepted.outputs.map((out) => {
            if (
              out.status === "value" &&
              typeof out.value === "object" &&
              out.value !== null &&
              "copy" in out.value
            ) {
              return {
                ...out,
                value: (out.value as { copy(): Float64Array }).copy(),
              };
            }
            return out as ScientificResult;
          });

          store.publish({
            ...token,
            stepIndex: currentAccepted.stepIndex,
            simulationTime: currentAccepted.simulationTime,
            final: true,
            outputs,
          });
          const snapshot = store.getSnapshot();
          const snapshotVersion = snapshot.accepted?.snapshotVersion ?? 0;
          markAccepted(token.instanceId, token.actionIndex, snapshotVersion);
          notify("completed", token, "presentation-change");
          return;
        }
      }

      const hadActive = Boolean(active);
      // If a pending request is already queued behind the in-flight evaluation, supersede it
      if (pending) {
        notify("superseded", pending);
      }
      pending = token;
      connect();

      if (hadActive && active && !cancelSent && channel) {
        try {
          channel.send({
            messageKind: "cancel",
            protocolVersion: protocol.version,
            instanceId: active.instanceId,
            actionIndex: active.actionIndex,
          });
          cancelSent = true;
        } catch {
          fail("transport-error");
        }
      }

      dispatch();
    },

    cancel(): void {
      pending = null;
      store.pause();
      close();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      pending = null;
      store.pause();
      close();
    },

    getWorkerMessageCount(): number {
      return workerMessageCount;
    },

    getRestartCount(): number {
      return failures;
    },
  });
}

/**
 * Backwards-compatible factory alias for existing session and test files.
 */
export function createHostScheduler(
  store: Store,
  factory: () => WorkerChannel,
  sourceDigest: string,
  protocol: HostProtocol,
  report: (event: SchedulerEvent) => void = () => {},
) {
  return createDedicatedScheduler({
    store,
    factory,
    sourceDigest,
    protocol,
    report,
  });
}
