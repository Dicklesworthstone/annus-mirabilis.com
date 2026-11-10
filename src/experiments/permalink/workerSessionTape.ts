import type {
  PublicationVerifier,
  VerifiablePublication,
} from "../../workers/scheduler/verifiedChannel.ts";
import {
  inheritSchedulingPause,
  type SchedulingPauseSource,
} from "../lifecycle/schedulingPause.ts";
import type { ExperimentView, RequestToken } from "../store/instanceStore.ts";
import { checkTapeCompatibility } from "./compatibility.ts";
import { type DraftTapeBinding, environmentForSettings } from "./draftTape.ts";
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
export type WorkerTapeSession = SchedulingPauseSource &
  Readonly<{
    apply(input: unknown): Readonly<{ kind: string; data?: unknown }>;
    /** A scientific replay must check the worker result before it can replace accepted state. */
    applyVerified?(
      input: unknown,
      verify: PublicationVerifier,
    ): Readonly<{ kind: string; data?: unknown }>;
    startNewRun?(input: unknown): Readonly<{ kind: string; data?: unknown }>;
    getSnapshot(): ExperimentView;
    subscribe(listener: () => void): () => void;
    acceptedParameters(): object;
    stop(): void;
    disconnect(): void;
  }>;

export type WorkerTapeBinding = DraftTapeBinding &
  Readonly<{
    createSession(instanceId: string): WorkerTapeSession;
    scientificReplay?: Readonly<{
      validate(tape: TapeV2, states: readonly Readonly<Record<string, unknown>>[]): string | null;
      verify(tape: TapeV2, publication: VerifiablePublication): Promise<string | null>;
    }>;
  }>;

export type WorkerTapeRestore =
  | Readonly<{ kind: "restored" }>
  | Readonly<{ kind: "not-restored"; notice: string }>;

export type WorkerReplayOptions = Readonly<{
  signal?: AbortSignal | undefined;
  /** Active scheduling budget; hidden time cannot turn a paused checkpoint into a failure. */
  timeoutMs?: number | undefined;
}>;

type WorkerCalculationOptions = WorkerReplayOptions &
  Readonly<{
    newRun?: boolean;
    verifyPublication?: PublicationVerifier;
  }>;

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

/** Structural planning only: a scientific digest is checked against the eventual owner result. */
function scientificReplayPlan(binding: WorkerTapeBinding, tape: TapeV2) {
  const states: Readonly<Record<string, unknown>>[] = [];
  const invalid = (notice: string) => ({ kind: "not-restored" as const, notice });
  if (
    tape.experimentId !== binding.environment.experimentId ||
    tape.mode !== binding.environment.mode
  )
    return invalid("This checkpoint belongs to another laboratory or model mode.");
  let settings: Readonly<Record<string, unknown>> = binding.defaults;
  const apply = (input: object) => {
    const checked = binding.validate(input);
    if (checked.kind !== "accepted")
      return requirementsOf(checked) || "The laboratory refuses a recorded intermediate setting.";
    settings =
      checked.data && typeof checked.data === "object" ? { ...checked.data } : { ...input };
    states.push(settings);
    return null;
  };
  const initialError = apply({
    ...binding.defaults,
    ...settingsFromTape(tape.initialConditions, binding.defaults),
  });
  if (initialError) return invalid(initialError);
  const compatibility = checkTapeCompatibility(tape, environmentForSettings(binding, settings));
  if (!compatibility.compatible) return invalid(`${compatibility.notice} ${compatibility.repair}`);
  let lastAction = 0;
  for (const event of tape.events) {
    if (event.actionIndex <= 0 || event.actionIndex > tape.acceptedCheckpoint.acceptedActionIndex)
      return invalid("The checkpoint does not identify a complete recorded event prefix.");
    if (!Object.hasOwn(binding.defaults, event.paramId))
      return invalid(`The checkpoint names an unknown setting: ${event.paramId}.`);
    if (
      event.previousValue !== undefined &&
      !Object.is(
        settingsFromTape({ [event.paramId]: event.previousValue }, binding.defaults)[event.paramId],
        settings[event.paramId],
      )
    )
      return invalid("A recorded change does not begin at its stated previous value.");
    const error = apply({
      ...settings,
      ...settingsFromTape({ [event.paramId]: event.value }, binding.defaults),
    });
    if (error) return invalid(error);
    lastAction = event.actionIndex;
  }
  if (lastAction !== tape.acceptedCheckpoint.acceptedActionIndex)
    return invalid("The checkpoint's action was not reached by its recorded controls.");
  const error = binding.scientificReplay?.validate(tape, states);
  return error ? invalid(error) : { kind: "planned" as const, states };
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
    let unsubscribePause = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    let remaining = options.timeoutMs ?? 15_000;
    let activeSince: number | null = null;
    const suspendTimer = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (activeSince !== null)
        remaining = Math.max(0, remaining - (performance.now() - activeSince));
      activeSince = null;
    };
    const finish = (outcome: WorkerTapeRestore, stop = false) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      unsubscribePause();
      suspendTimer();
      options.signal?.removeEventListener("abort", abort);
      if (stop && requested && session.getSnapshot().requested === requested) session.stop();
      resolve(outcome);
    };
    const abort = () => finish(refuse("The checkpoint restoration was cancelled."), true);
    const updateTimer = () => {
      suspendTimer();
      if (settled || session.getSchedulingPaused()) return;
      activeSince = performance.now();
      timer = setTimeout(
        () =>
          finish(
            refuse(
              "The calculation took too long. The previous accepted result is still available; retry the checkpoint.",
            ),
            true,
          ),
        remaining,
      );
    };
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
        const checkpointNotice = view.outcome?.details?.checkpointNotice;
        finish(
          refuse(
            (typeof checkpointNotice === "string" ? checkpointNotice : undefined) ??
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
      unsubscribePause = session.subscribeSchedulingPause(updateTimer);
      updateTimer();
      const previous = session.getSnapshot().requested;
      const outcome = options.newRun
        ? session.startNewRun?.(settings)
        : options.verifyPublication
          ? session.applyVerified?.(settings, options.verifyPublication)
          : session.apply(settings);
      if (!outcome) {
        finish(
          refuse(
            options.verifyPublication
              ? "This laboratory cannot verify a scientific checkpoint before publication."
              : "This laboratory cannot begin an explicitly new run.",
          ),
        );
        return;
      }
      if (outcome.kind !== "accepted") {
        finish(
          refuse(requirementsOf(outcome) || "The laboratory refuses these recorded settings."),
        );
        return;
      }
      requested = outcome.data as RequestToken | null;
      // Store subscribers may synchronously cancel while apply() is still issuing this token.
      // The abort handler cannot stop an unassigned token; close it now, but never a newer edit.
      if (settled || options.signal?.aborted) {
        if (requested && session.getSnapshot().requested === requested) session.stop();
        return;
      }
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
 * Deterministic bindings retain their settings checks. Stochastic bindings must supply a scientific
 * owner policy and a guarded publication seam; both the isolated result and the live result are
 * verified before acceptance. A settings checksum never stands in for a trajectory digest.
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
    !binding.scientificReplay &&
    (binding.environment.allocationId !== "deterministic" ||
      binding.environment.streamVersion !== "deterministic")
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
  let detachPause = () => {};
  try {
    const checked = validateTapeV2(tape);
    const scientific = binding.scientificReplay;
    if (scientific) {
      const plan = scientificReplayPlan(binding, checked);
      if (plan.kind !== "planned") return plan;
      if (!session.applyVerified)
        return refuse("This laboratory cannot verify a scientific checkpoint before publication.");
      trial = binding.createSession(
        `${binding.environment.experimentId}-replay-${++preflightNumber}`,
      );
      detachPause = inheritSchedulingPause(session, trial);
      const verifyPublication: PublicationVerifier = (publication) =>
        scientific.verify(checked, publication);
      for (let i = 0; i < plan.states.length; i++) {
        const settings = plan.states[i];
        if (!settings) continue;
        const outcome = await applyWorkerSettings(trial, settings, {
          ...options,
          ...(i === plan.states.length - 1 ? { verifyPublication } : {}),
        });
        if (outcome.kind !== "restored") return outcome;
      }
      if (session.getSnapshot() !== before)
        return refuse(
          "The laboratory changed while the checkpoint was checked. Your newer work has been kept; restore again if intended.",
        );
      if (options.signal?.aborted) return refuse("The checkpoint restoration was cancelled.");
      return await applyWorkerSettings(session, trial.acceptedParameters(), {
        ...options,
        verifyPublication,
      });
    }
    const plan = replayPlan(binding, checked);
    if (plan.result.kind !== "success") return refuse(plan.result.notice);
    trial = binding.createSession(
      `${binding.environment.experimentId}-replay-${++preflightNumber}`,
    );
    detachPause = inheritSchedulingPause(session, trial);
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
    detachPause();
    trial?.disconnect();
    activeRestores.delete(session);
  }
}
