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
 * Replays a TapeV2 against a ReplayRunner, verifying compatibility and checkpoint invariants.
 */
export function replayTape(
  tape: TapeV2,
  runner: ReplayRunner,
  options?: ReplayOptions,
): TapeReplayResult {
  const isForceNewRun = Boolean(options?.forceNewRun);

  // 1. Compatibility Check (unless forced as a new run)
  if (!isForceNewRun) {
    const comp = checkTapeCompatibility(tape, runner.environment);
    if (!comp.compatible) {
      return {
        kind: "refusal",
        refusalCode: comp.refusalCode,
        notice: comp.notice,
        repair: comp.repair,
        tapeIdentity: comp.tapeIdentity,
        currentIdentity: comp.currentIdentity,
        offerNewRun: true,
      };
    }
  }

  // 2. Resolve teaching tape if referenced
  let eventsToReplay = tape.events;
  let initialConditionsToApply = tape.initialConditions;

  if (tape.teachingTapeRef) {
    if (typeof runner.resolveTeachingTape === "function") {
      const teachingTape = runner.resolveTeachingTape(tape.teachingTapeRef.tapeId);
      if (teachingTape) {
        initialConditionsToApply = teachingTape.initialConditions;
        eventsToReplay = teachingTape.events.slice(0, tape.teachingTapeRef.stepIndex + 1);
      }
    }
  }

  // 3. Apply Initial Conditions at actionIndex 0
  try {
    runner.applyInitialConditions(initialConditionsToApply);
  } catch (err: unknown) {
    return {
      kind: "invalid",
      notice: `Failed to apply initial conditions: ${String(err)}`,
      reason: "initial-conditions-failed",
    };
  }

  // 4. Apply Control Events in Strict Chronological Order
  let executedCount = 0;
  try {
    for (const evt of eventsToReplay) {
      runner.applyEvent(evt);
      executedCount++;
    }
  } catch (err: unknown) {
    return {
      kind: "invalid",
      notice: `Failed to replay event at actionIndex ${eventsToReplay[executedCount]?.actionIndex}: ${String(err)}`,
      reason: "event-replay-failed",
    };
  }

  // 5. Verify Checkpoint Invariant
  const replayedCheckpoint = runner.getAcceptedCheckpoint();
  const state = runner.getCurrentState();

  if (!isForceNewRun) {
    if (replayedCheckpoint.digest !== tape.acceptedCheckpoint.digest) {
      return {
        kind: "invariant-violation",
        notice:
          "The calculation did not satisfy its required consistency checks. Checkpoint digest mismatch during replay.",
        storedDigest: tape.acceptedCheckpoint.digest,
        replayedDigest: replayedCheckpoint.digest,
      };
    }
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
