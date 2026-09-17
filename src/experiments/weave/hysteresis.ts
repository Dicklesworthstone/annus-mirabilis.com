/**
 * Hysteresis for one predicate (am-read-result-weave-jex): "the predicate enters when all enter
 * settings hold, and exits when any exit setting fails." A pure function of the previous lit
 * state and this tick's enter/exit condition results, so the same sequence of accepted
 * snapshots always replays to the same flags.
 */
import { type ConditionCheckResult, checkAllOf } from "./conditions.ts";
import type { ConditionState, WeaveCondition, WeaveSnapshotView } from "./types.ts";

export type HysteresisResult = Readonly<{
  lit: boolean;
  state: ConditionState;
}>;

function nextFromResults(
  previousLit: boolean,
  enterResult: ConditionCheckResult,
  exitResult: ConditionCheckResult,
): HysteresisResult {
  if (enterResult === "not-evaluable" || exitResult === "not-evaluable") {
    return { lit: false, state: "not-evaluable" };
  }
  if (!previousLit) {
    const lit = enterResult === "hold";
    return { lit, state: lit ? "enter" : "hold" };
  }
  // Currently lit: stays lit unless an exit condition fails.
  const stillLit = exitResult === "hold";
  return { lit: stillLit, state: stillLit ? "hold" : "exit" };
}

/** Evaluates one predicate's conditions for this tick and advances its hysteresis state. */
export function advanceHysteresis(
  conditions: readonly WeaveCondition[],
  snapshot: WeaveSnapshotView,
  previousLit: boolean,
): HysteresisResult {
  const enterResult = checkAllOf(conditions, snapshot, "enter");
  const exitResult = checkAllOf(conditions, snapshot, "exit");
  return nextFromResults(previousLit, enterResult, exitResult);
}

/** Per-instance hysteresis state, one boolean per predicate id. Resets when `runId` changes
 * (am-read-result-weave-jex: "State is kept per instance and resets when runId changes"). */
export function createHysteresisTracker() {
  let currentRunId: string | undefined;
  let litByPredicateId = new Map<string, boolean>();

  return {
    /** Advances every predicate's state for this snapshot, resetting first if runId changed. */
    advance(
      predicates: ReadonlyMap<string, readonly WeaveCondition[]>,
      snapshot: WeaveSnapshotView,
    ): ReadonlyMap<string, HysteresisResult> {
      if (snapshot.runId !== currentRunId) {
        currentRunId = snapshot.runId;
        litByPredicateId = new Map();
      }
      const results = new Map<string, HysteresisResult>();
      for (const [predicateId, conditions] of predicates) {
        const previousLit = litByPredicateId.get(predicateId) ?? false;
        const result = advanceHysteresis(conditions, snapshot, previousLit);
        litByPredicateId.set(predicateId, result.lit);
        results.set(predicateId, result);
      }
      return results;
    },
    reset(): void {
      currentRunId = undefined;
      litByPredicateId = new Map();
    },
  };
}
