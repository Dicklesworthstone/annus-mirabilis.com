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
  applyInitialConditions(conditions: Record<string, number | string>): void;
  applyEvent(event: TapeControlEvent): void;
  getAcceptedCheckpoint(): TapeAcceptedCheckpoint;
  getCurrentState(): Record<string, number | string>;
  resolveTeachingTape?(tapeId: string): TapeV2 | null;
}

export type ReplayOptions = Readonly<{
  forceNewRun?: boolean | undefined;
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
    const comp = checkTapeCompatibility(tape, runner.environment);
    if (!comp.compatible) {
      return { ...comp, kind: "refusal" };
    }
  }

  let eventsToReplay = tape.events;
  let initialConditionsToApply = tape.initialConditions;
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
      const comp = checkTapeCompatibility(teachingTape, runner.environment);
      if (!comp.compatible) return { ...comp, kind: "refusal" };
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
  }

  let previousAction = -1;
  for (const event of eventsToReplay) {
    if (!Number.isSafeInteger(event.actionIndex) || event.actionIndex < 0 || event.actionIndex < previousAction) {
      return invalid(
        "tape-event-order-invalid",
        "Replay events must have non-decreasing non-negative whole-number action indices.",
      );
    }
    previousAction = event.actionIndex;
  }
  if (!isForceNewRun) {
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

  try {
    runner.applyInitialConditions(initialConditionsToApply);
  } catch (err: unknown) {
    return invalid(
      "initial-conditions-failed",
      `Failed to apply initial conditions: ${String(err)}`,
    );
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
  try {
    replayedCheckpoint = runner.getAcceptedCheckpoint();
    state = runner.getCurrentState();
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

  const runId = isForceNewRun
    ? `run-${runner.environment.experimentId}-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    : `run-${runner.environment.experimentId}-${tape.seed}`;

  return {
    kind: "success",
    runId,
    acceptedCheckpoint: replayedCheckpoint,
    state,
    isNewRun: isForceNewRun,
    executedEventCount: executedCount,
  };
}
