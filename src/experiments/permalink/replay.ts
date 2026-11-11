/**
 * Deterministic Tape Replayer and Invariant Verifier.
 * Specification: am-inst-permalink-tape-s677, am-rt-control-tapes-0gc
 */

import { checkTapeCompatibility } from "./compatibility.ts";
import type {
  ExperimentEnvironment,
  TapeAcceptedCheckpoint,
  TapeControlEvent,
  TapeReplayResult,
  TapeV2,
} from "./types.ts";

export interface ReplayRunner {
  readonly environment: ExperimentEnvironment;
  /** Resolve settings-dependent identities without applying any controls to the live owner. */
  environmentForReplay?(
    conditions: Readonly<Record<string, number | string>>,
    events: readonly TapeControlEvent[],
  ): ExperimentEnvironment;
  applyInitialConditions(conditions: Record<string, number | string>): void;
  /** Explicitly fork the real owner; ordinary replay must never call this. */
  startNewRun?(conditions: Record<string, number | string>): void;
  /** Null when this is only a settings planner and has no accepted scientific owner. */
  getAcceptedRunId?(): string | null;
  applyEvent(event: TapeControlEvent): void;
  getAcceptedCheckpoint(): TapeAcceptedCheckpoint;
  getCurrentState(): Record<string, number | string>;
  resolveTeachingTape?(tapeId: string): TapeV2 | null;
}

export type ReplayOptions = Readonly<{
  forceNewRun?: boolean | undefined;
  /** A new calculation of a shared checkpoint still stops at that checkpoint's controls. */
  stopAtCheckpoint?: boolean | undefined;
}>;

/**
 * Resolve a walkthrough and its endpoint before changing the laboratory. A missing reference must
 * never turn into an apparently successful replay of the enclosing link's unrelated settings.
 */
export function replayTape(
  tape: TapeV2,
  runner: ReplayRunner,
  options?: ReplayOptions,
): TapeReplayResult {
  const isForceNewRun = Boolean(options?.forceNewRun);
  const resolvesEnvironment = Boolean(runner.environmentForReplay);
  const invalid = (reason: string, notice: string): TapeReplayResult => ({
    kind: "invalid",
    reason,
    notice,
  });
  if (tape.experimentId !== runner.environment.experimentId) {
    return invalid(
      "tape-experiment-mismatch",
      `This tape belongs to ${tape.experimentId}, not ${runner.environment.experimentId}.`,
    );
  }
  if (!isForceNewRun) {
    if (tape.mode !== runner.environment.mode) {
      return invalid(
        "tape-mode-mismatch",
        "This tape was recorded in a different laboratory mode.",
      );
    }
    if (!resolvesEnvironment) {
      const comp = checkTapeCompatibility(tape, runner.environment);
      if (!comp.compatible) return { ...comp, kind: "refusal" };
    }
  }

  let eventsToReplay = tape.events;
  let initialConditionsToApply = tape.initialConditions;
  let resolvedTeachingTape: TapeV2 | null = null;
  const ref = tape.teachingTapeRef;
  if (ref) {
    if (!Number.isSafeInteger(ref.stepIndex) || ref.stepIndex < 0) {
      return invalid(
        "teaching-tape-step-invalid",
        "The walkthrough step must be a non-negative whole number.",
      );
    }
    if (!runner.resolveTeachingTape) {
      return invalid(
        "teaching-tape-unavailable",
        `This laboratory cannot resolve walkthrough ${ref.tapeId}.`,
      );
    }
    let teachingTape: TapeV2 | null;
    try {
      teachingTape = runner.resolveTeachingTape(ref.tapeId);
    } catch (err: unknown) {
      return invalid(
        "teaching-tape-resolution-failed",
        `Walkthrough ${ref.tapeId} could not be loaded: ${String(err)}`,
      );
    }
    if (!teachingTape) {
      return invalid(
        "teaching-tape-unavailable",
        `No published walkthrough is called ${ref.tapeId}.`,
      );
    }
    if (teachingTape.experimentId !== runner.environment.experimentId) {
      return invalid(
        "teaching-tape-experiment-mismatch",
        `Walkthrough ${ref.tapeId} belongs to ${teachingTape.experimentId}, not ${runner.environment.experimentId}.`,
      );
    }
    if (!isForceNewRun) {
      if (teachingTape.mode !== tape.mode) {
        return invalid(
          "teaching-tape-mode-mismatch",
          "The walkthrough and shared link name different laboratory modes.",
        );
      }
      if (!resolvesEnvironment) {
        const comp = checkTapeCompatibility(teachingTape, runner.environment);
        if (!comp.compatible) return { ...comp, kind: "refusal" };
      }
      if (teachingTape.seed !== tape.seed) {
        return invalid(
          "teaching-tape-seed-mismatch",
          "The walkthrough and shared link name different random seeds. Start an explicitly new run to change the seed.",
        );
      }
    }
    // An event-free walkthrough can name its opening settings with step zero.
    if (ref.stepIndex >= Math.max(1, teachingTape.events.length)) {
      return invalid(
        "teaching-tape-step-unavailable",
        `Walkthrough ${ref.tapeId} has no event at step ${ref.stepIndex}.`,
      );
    }
    initialConditionsToApply = teachingTape.initialConditions;
    eventsToReplay = teachingTape.events.slice(0, ref.stepIndex + 1);
    resolvedTeachingTape = teachingTape;
  }

  let previousAction = -1;
  for (const event of eventsToReplay) {
    if (
      !Number.isSafeInteger(event.actionIndex) ||
      event.actionIndex < 0 ||
      event.actionIndex < previousAction
    ) {
      return invalid(
        "tape-event-order-invalid",
        "Replay events must have non-decreasing non-negative whole-number action indices.",
      );
    }
    previousAction = event.actionIndex;
  }
  if (!isForceNewRun || options?.stopAtCheckpoint) {
    const accepted = tape.acceptedCheckpoint.acceptedActionIndex;
    if (!Number.isSafeInteger(accepted) || accepted < 0) {
      return invalid(
        "tape-checkpoint-action-invalid",
        "The accepted checkpoint must name a non-negative whole-number action index.",
      );
    }
    // Inline tapes may retain later controls. Restore the recorded checkpoint, not a later state.
    // A teaching reference already chooses its endpoint; conflicting endpoints are refused.
    if (!ref) eventsToReplay = eventsToReplay.filter((event) => event.actionIndex <= accepted);
    const endpoint = eventsToReplay.at(-1)?.actionIndex ?? 0;
    if (endpoint !== accepted) {
      return invalid(
        "tape-checkpoint-action-unreachable",
        `The requested replay ends at action ${endpoint}, but its checkpoint names action ${accepted}.`,
      );
    }
  }

  if (runner.environmentForReplay) {
    let environment: ExperimentEnvironment;
    try {
      environment = runner.environmentForReplay(initialConditionsToApply, eventsToReplay);
    } catch (error) {
      return invalid(
        "replay-settings-invalid",
        `The recorded settings could not be checked: ${String(error)}`,
      );
    }
    if (!isForceNewRun) {
      for (const recorded of resolvedTeachingTape ? [tape, resolvedTeachingTape] : [tape]) {
        const compatible = checkTapeCompatibility(recorded, environment);
        if (!compatible.compatible) return { ...compatible, kind: "refusal" };
      }
    }
  }

  const startNewRun = runner.startNewRun?.bind(runner);
  const acceptedRunId = runner.getAcceptedRunId?.bind(runner);
  if (isForceNewRun && (!startNewRun || !acceptedRunId)) {
    return invalid(
      "new-run-unsupported",
      "This laboratory cannot begin an explicitly new identified run.",
    );
  }
  let previousRunId: string | null = null;
  if (isForceNewRun && acceptedRunId) {
    try {
      previousRunId = acceptedRunId();
    } catch (error) {
      return invalid(
        "run-identity-read-failed",
        `The current run could not be read: ${String(error)}`,
      );
    }
  }

  try {
    if (isForceNewRun && startNewRun) startNewRun(initialConditionsToApply);
    else runner.applyInitialConditions(initialConditionsToApply);
  } catch (err: unknown) {
    return invalid(
      "initial-conditions-failed",
      `Failed to apply initial conditions: ${String(err)}`,
    );
  }

  if (isForceNewRun && acceptedRunId) {
    try {
      const started = acceptedRunId();
      if (!started?.trim() || started === previousRunId)
        return invalid("new-run-not-created", "The laboratory did not begin a new identified run.");
    } catch (error) {
      return invalid("run-identity-read-failed", `The new run could not be read: ${String(error)}`);
    }
  }

  let executedCount = 0;
  try {
    for (const evt of eventsToReplay) {
      runner.applyEvent(evt);
      executedCount++;
    }
  } catch (err: unknown) {
    return invalid(
      "event-replay-failed",
      `Failed to replay event at actionIndex ${eventsToReplay[executedCount]?.actionIndex}: ${String(err)}`,
    );
  }

  let replayedCheckpoint: TapeAcceptedCheckpoint;
  let state: Record<string, number | string>;
  let runId: string | null;
  try {
    replayedCheckpoint = runner.getAcceptedCheckpoint();
    state = runner.getCurrentState();
    runId = acceptedRunId?.() ?? null;
  } catch (err: unknown) {
    return invalid(
      "checkpoint-read-failed",
      `The replayed state could not be read: ${String(err)}`,
    );
  }
  if (
    !isForceNewRun &&
    (replayedCheckpoint.digest !== tape.acceptedCheckpoint.digest ||
      replayedCheckpoint.acceptedActionIndex !== tape.acceptedCheckpoint.acceptedActionIndex)
  ) {
    return {
      kind: "invariant-violation",
      notice: `The calculation did not satisfy its required consistency checks. Checkpoint mismatch during replay (recorded action ${tape.acceptedCheckpoint.acceptedActionIndex}, replayed action ${replayedCheckpoint.acceptedActionIndex}).`,
      storedDigest: tape.acceptedCheckpoint.digest,
      replayedDigest: replayedCheckpoint.digest,
    };
  }

  if (isForceNewRun && (!runId?.trim() || runId === previousRunId)) {
    return invalid(
      "new-run-not-created",
      "The laboratory did not accept a new identified run. The recorded result has not been reproduced.",
    );
  }

  return {
    kind: "success",
    runId,
    acceptedCheckpoint: replayedCheckpoint,
    state,
    isNewRun: isForceNewRun,
    executedEventCount: executedCount,
  };
}
