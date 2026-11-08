import type { ExperimentView, RequestToken } from "../store/instanceStore.ts";
import type { DraftTapeBinding } from "./draftTape.ts";
import { replayTape } from "./replay.ts";
import { validateTapeV2 } from "./schema.ts";
import {
  digestFormOf,
  requirementsOf,
  settingsFromTape,
  tapeStateDigestIn,
  tapeStateOf,
} from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";

/** A worker accepting a request has not yet accepted a result. */
export type WorkerTapeSession = Readonly<{
  apply(input: unknown): Readonly<{ kind: string; data?: unknown }>;
  startNewRun?(input: unknown): Readonly<{ kind: string; data?: unknown }>;
  getSnapshot(): ExperimentView;
  subscribe(listener: () => void): () => void;
  acceptedParameters(): object;
  stop(): void;
  disconnect(): void;
}>;

export type WorkerTapeBinding = DraftTapeBinding &
  Readonly<{ createSession(instanceId: string): WorkerTapeSession }>;

export type WorkerTapeRestore =
  | Readonly<{ kind: "restored" }>
  | Readonly<{ kind: "not-restored"; notice: string }>;

export type WorkerReplayOptions = Readonly<{
  signal?: AbortSignal | undefined;
  /** A stalled worker must not leave the player permanently busy. */
  timeoutMs?: number | undefined;
}>;

type WorkerCalculationOptions = WorkerReplayOptions & Readonly<{ newRun?: boolean }>;

const refuse = (notice: string): WorkerTapeRestore => ({ kind: "not-restored", notice });

function sameSettings(left: object, right: object): boolean {
  const other = right as Record<string, unknown>;
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.entries(left).every(
      ([key, value]) => Object.hasOwn(other, key) && Object.is(value, other[key]),
    )
  );
}

/** Resolve and verify settings without changing either a live session or a worker. */
function replayPlan(binding: WorkerTapeBinding, tape: TapeV2) {
  const states: object[] = [];
  let parameters: object = binding.defaults;
  let actionIndex = 0;
  let invalid: string | null = null;
  const form = digestFormOf(tape.acceptedCheckpoint.digest);
  const apply = (settings: object) => {
    if (invalid) return;
    const checked = binding.validate(settings);
    if (checked.kind !== "accepted") {
      invalid = requirementsOf(checked) || "The laboratory refuses these recorded settings.";
      return;
    }
    parameters =
      checked.data && typeof checked.data === "object" ? { ...checked.data } : { ...settings };
    states.push(parameters);
  };
  const result = replayTape(tape, {
    environment: binding.environment,
    applyInitialConditions(conditions) {
      apply({ ...binding.defaults, ...settingsFromTape(conditions, binding.defaults) });
      actionIndex = 0;
    },
    applyEvent(event) {
      apply({
        ...parameters,
        ...settingsFromTape({ [event.paramId]: event.value }, binding.defaults),
      });
      actionIndex = event.actionIndex;
    },
    getAcceptedCheckpoint() {
      return {
        acceptedActionIndex: actionIndex,
        acceptedInputRevision: 0,
        digest: tapeStateDigestIn(form, tapeStateOf(parameters) ?? {}, actionIndex),
      };
    },
    getCurrentState: () => tapeStateOf(parameters) ?? {},
  });
  return {
    result: invalid
      ? { kind: "invalid" as const, reason: "recorded-settings-refused", notice: invalid }
      : result,
    states,
    form,
  };
}

/**
 * Wait for THIS request's final accepted publication. The previous accepted snapshot, a partial
 * publication, and a newer user request cannot stand in for it. Cancellation only stops the request
 * this call still owns, never a later edit made while the worker was running.
 */
export function applyWorkerSettings(
  session: WorkerTapeSession,
  settings: object,
  options: WorkerCalculationOptions = {},
): Promise<WorkerTapeRestore> {
  if (options.signal?.aborted)
    return Promise.resolve(refuse("The checkpoint restoration was cancelled."));
  return new Promise((resolve) => {
    let requested: RequestToken | null = null;
    let settled = false;
    let unsubscribe = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (outcome: WorkerTapeRestore, stop = false) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (stop && requested && session.getSnapshot().requested === requested) session.stop();
      resolve(outcome);
    };
    const abort = () => finish(refuse("The checkpoint restoration was cancelled."), true);
    const inspect = () => {
      if (!requested || settled) return;
      const view = session.getSnapshot();
      if (view.requested !== requested) {
        finish(refuse("A newer laboratory change replaced this checkpoint restoration."));
        return;
      }
      const accepted = view.accepted;
      if (
        !view.pending &&
        accepted?.final &&
        accepted.instanceId === requested.instanceId &&
        accepted.runId === requested.runId &&
        accepted.actionIndex === requested.actionIndex
      ) {
        finish(
          sameSettings(accepted.parameters, settings)
            ? { kind: "restored" }
            : refuse("The accepted calculation does not contain the recorded settings."),
        );
      } else if (!view.pending) {
        finish(
          refuse(
            view.refusal?.message ??
              view.outcome?.message ??
              "The calculation stopped before accepting the checkpoint.",
          ),
        );
      }
    };
    try {
      unsubscribe = session.subscribe(inspect);
      options.signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(
        () =>
          finish(
            refuse(
              "The calculation took too long. The previous accepted result is still available; retry the checkpoint.",
            ),
            true,
          ),
        options.timeoutMs ?? 15_000,
      );
      const previous = session.getSnapshot().requested;
      const outcome = options.newRun ? session.startNewRun?.(settings) : session.apply(settings);
      if (!outcome) {
        finish(refuse("This laboratory cannot begin an explicitly new run."));
        return;
      }
      if (outcome.kind !== "accepted") {
        finish(
          refuse(requirementsOf(outcome) || "The laboratory refuses these recorded settings."),
        );
        return;
      }
      requested = outcome.data as RequestToken | null;
      if (!requested || requested === previous) {
        finish(refuse("The laboratory did not issue a calculation for this checkpoint."));
        return;
      }
      if (options.newRun && requested.runId === previous?.runId) {
        finish(refuse("The laboratory did not begin a new identified run."), true);
        return;
      }
      inspect();
    } catch (error) {
      finish(refuse(`The checkpoint calculation could not start: ${String(error)}`), true);
    }
  });
}

const activeRestores = new WeakSet<WorkerTapeSession>();
let preflightNumber = 0;

/**
 * Restore a settings checkpoint through a real worker. First check the wire identity, complete
 * parameter sequence and recorded digest. Then run each step in an isolated instance using the
 * same worker owner. Only after that succeeds is the final state submitted once to the live lab.
 * Thus an incompatible record, invalid intermediate step or failed preflight preserves the live
 * snapshot AND run identity. A live worker failure preserves its last accepted snapshot as usual.
 *
 * These are settings checkpoints, not recorded numerical observations or stochastic trajectory
 * states. The worker owns every displayed result and its execution label; no tape lends a label.
 */
export async function restoreWorkerTape(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  tape: TapeV2,
  options: WorkerReplayOptions = {},
): Promise<WorkerTapeRestore> {
  if (activeRestores.has(session))
    return refuse("Another checkpoint restoration is still running.");
  if (options.signal?.aborted) return refuse("The checkpoint restoration was cancelled.");
  if (
    binding.environment.allocationId !== "deterministic" ||
    binding.environment.streamVersion !== "deterministic"
  ) {
    return refuse(
      "This player restores deterministic settings checkpoints. This laboratory requires its random-stream replay owner.",
    );
  }
  const before = session.getSnapshot();
  if (before.pending)
    return refuse("Wait for the current calculation before restoring a checkpoint.");
  activeRestores.add(session);
  let trial: WorkerTapeSession | undefined;
  try {
    const checked = validateTapeV2(tape);
    const plan = replayPlan(binding, checked);
    if (plan.result.kind !== "success") return refuse(plan.result.notice);
    trial = binding.createSession(
      `${binding.environment.experimentId}-replay-${++preflightNumber}`,
    );
    for (const settings of plan.states) {
      const outcome = await applyWorkerSettings(trial, settings, options);
      if (outcome.kind !== "restored") return outcome;
    }
    const accepted = trial.acceptedParameters();
    if (
      tapeStateDigestIn(
        plan.form,
        tapeStateOf(accepted) ?? {},
        checked.acceptedCheckpoint.acceptedActionIndex,
      ) !== checked.acceptedCheckpoint.digest
    )
      return refuse("The worker's accepted settings do not match the recorded checkpoint.");
    if (session.getSnapshot() !== before)
      return refuse(
        "The laboratory changed while the checkpoint was checked. Your newer work has been kept; restore again if intended.",
      );
    if (options.signal?.aborted) return refuse("The checkpoint restoration was cancelled.");
    return await applyWorkerSettings(session, accepted, options);
  } catch (error) {
    return refuse(`The recorded checkpoint could not be checked: ${String(error)}`);
  } finally {
    trial?.disconnect();
    activeRestores.delete(session);
  }
}
