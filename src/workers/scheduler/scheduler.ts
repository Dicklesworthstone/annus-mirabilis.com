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
  type ExecutionOutcome,
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
  /** Validated, request-bound progress; stale packets never renew a deadline. */
  decodeProgress?(
    message: unknown,
    token: RequestToken,
    digest: string,
  ): Readonly<{ current: boolean; completed: number }> | null;
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
  /** Visible, unpaused time allowed to load and validate a worker. */
  readonly handshakeTimeoutMs?: number | undefined;
  /** Visible, unpaused inactivity allowed between validated progress or a final response. */
  readonly responseTimeoutMs?: number | undefined;
}

export class SchedulerConfigurationError extends RangeError {
  readonly code = "invalid-worker-deadline";
}

export interface DedicatedScheduler {
  request(token: RequestToken, commandClass?: CommandClass): void;
  setSchedulingPaused(paused: boolean): void;
  cancel(): void;
  dispose(): void;
  getWorkerMessageCount(): number;
  getRestartCount(): number;
}

export function createDedicatedScheduler(options: DedicatedSchedulerOptions): DedicatedScheduler {
  const {
    store,
    factory,
    sourceDigest,
    protocol,
    report = () => {},
    maxRestarts = 3,
    handshakeTimeoutMs = 30_000,
    responseTimeoutMs = 30_000,
  } = options;
  for (const timeout of [handshakeTimeoutMs, responseTimeoutMs]) {
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2_147_483_647)
      throw new SchedulerConfigurationError(
        "Worker deadlines must be positive, finite timer durations.",
      );
  }

  let channel: WorkerChannel | null = null;
  let unsubscribe: (() => void) | null = null;
  let active: RequestToken | null = null;
  let pending: RequestToken | null = null;
  let ready = false;
  let disposed = false;
  let schedulingPaused = false;
  let cancelSent = false;
  let epoch = 0;
  let failures = 0;
  let workerMessageCount = 0;
  let activeProgress = 0;
  let deadline: {
    phase: "handshake" | "response";
    timeoutMs: number;
    remainingMs: number;
    startedAt: number;
    generation: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null = null;

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

  function clearDeadline(): void {
    if (deadline && deadline.timer !== null) clearTimeout(deadline.timer);
    deadline = null;
  }

  function pauseDeadline(): void {
    if (!deadline || deadline.timer === null) return;
    clearTimeout(deadline.timer);
    deadline.timer = null;
    deadline.remainingMs = Math.max(
      0,
      deadline.remainingMs - (performance.now() - deadline.startedAt),
    );
  }

  function resumeDeadline(): void {
    const waiting = deadline;
    if (!waiting || waiting.timer !== null || schedulingPaused || disposed) return;
    waiting.startedAt = performance.now();
    const timer = setTimeout(() => {
      if (
        deadline !== waiting ||
        waiting.timer !== timer ||
        waiting.generation !== epoch ||
        schedulingPaused ||
        disposed
      )
        return;
      fail("worker-timeout", { phase: waiting.phase, timeoutMs: waiting.timeoutMs });
    }, waiting.remainingMs);
    waiting.timer = timer;
    // Node-side consumers must not be kept alive solely by an idle worker watchdog.
    timer.unref?.();
  }

  function startDeadline(phase: "handshake" | "response", timeoutMs: number): void {
    clearDeadline();
    deadline = {
      phase,
      timeoutMs,
      remainingMs: timeoutMs,
      startedAt: 0,
      generation: epoch,
      timer: null,
    };
    resumeDeadline();
  }

  function close(): void {
    epoch++;
    clearDeadline();
    const previousUnsubscribe = unsubscribe;
    const previousChannel = channel;
    unsubscribe = null;
    channel = null;
    active = null;
    activeProgress = 0;
    ready = false;
    cancelSent = false;
    try {
      previousUnsubscribe?.();
    } catch {
      /* A failed listener teardown cannot retain ownership of this request. */
    }
    try {
      previousChannel?.dispose();
    } catch {
      /* Late events are already fenced by the connection generation. */
    }
  }

  function fail(
    id: Exclude<ExecutionOutcomeId, "budget-exhausted">,
    details?: ExecutionOutcome["details"],
  ): void {
    const token = pending ?? active;
    pending = null;
    failures++;
    // Release the old worker before publication: a store subscriber may immediately retry.
    close();
    if (token) {
      store.fail(token, {
        outcome: id,
        ...executionOutcomeRegistry[id],
        ...(details ? { details } : {}),
      });
      notify("failed", token);
    }
  }

  function dispatch(): void {
    if (!ready || !channel || active || !pending || disposed || schedulingPaused) return;
    const token = pending;
    const generation = epoch;
    active = token;
    activeProgress = 0;
    pending = null;
    cancelSent = false;
    startDeadline("response", responseTimeoutMs);

    try {
      channel.send({
        messageKind: "request",
        protocolVersion: protocol.version,
        sourceDigest,
        token,
      });
      workerMessageCount++;
      notify("dispatched", token);
    } catch {
      if (generation === epoch && active === token) fail("transport-error");
    }
  }

  function connect(): void {
    if (channel || disposed || schedulingPaused) return;
    if (failures >= maxRestarts) {
      fail("environment-unsupported");
      return;
    }

    const generation = ++epoch;
    try {
      const connected = factory();
      channel = connected;
      startDeadline("handshake", handshakeTimeoutMs);
      const stopListening = connected.listen(
        (message) => {
          if (generation !== epoch || disposed) return;
          try {
            if (!ready) {
              protocol.decodeHello(message, sourceDigest);
              clearDeadline();
              ready = true;
              dispatch();
              return;
            }

            if (!active) return;
            const token = active;
            const progress = protocol.decodeProgress?.(message, token, sourceDigest);
            if (progress) {
              if (progress.current && progress.completed > activeProgress) {
                activeProgress = progress.completed;
                startDeadline("response", responseTimeoutMs);
              }
              return;
            }
            const response = protocol.decodeResponse(message, token, sourceDigest);
            clearDeadline();
            active = null;
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
            if (generation === epoch) dispatch();
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
      if (generation === epoch && !disposed) unsubscribe = stopListening;
      else stopListening();
    } catch {
      if (generation === epoch && !disposed) fail("environment-unsupported");
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

      if (hadActive && active && !cancelSent && channel && !schedulingPaused) {
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

    /** Keep the worker, accepted state and newest queued token while an in-flight call finishes. */
    setSchedulingPaused(paused: boolean): void {
      if (disposed || schedulingPaused === paused) return;
      schedulingPaused = paused;
      if (paused) pauseDeadline();
      else {
        resumeDeadline();
        if (pending) {
          connect();
          dispatch();
        }
      }
    },

    cancel(): void {
      pending = null;
      close();
      store.pause();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      pending = null;
      close();
      store.pause();
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
