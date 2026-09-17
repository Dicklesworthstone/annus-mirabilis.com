/**
 * Weave condition evaluation (am-read-result-weave-jex). Pure functions of accepted snapshot
 * outputs; the weave never recomputes a sample statistic and never imports src/testing/.
 *
 * Not-evaluable: a named output is absent, or the output is not a `value` and the condition
 * needs its number (threshold or agreement). A `status` condition reads the status itself, so
 * it is evaluable whatever that status is -- exactly what makes `outside-selected-domain`
 * expressible: the condition's own "success" criterion is the domain failure.
 */
import { dkwBound, dkwBoundWithOffset } from "./bounds.ts";
import type {
  AgreementCondition,
  RegimeCondition,
  StatusCondition,
  ThresholdCondition,
  WeaveCondition,
  WeaveSnapshotView,
} from "./types.ts";

export type ConditionPhase = "enter" | "exit";
export type ConditionCheckResult = "hold" | "fail" | "not-evaluable";

function numericValue(snapshot: WeaveSnapshotView, quantityId: string): number | "not-evaluable" {
  const output = snapshot.outputs[quantityId];
  if (output?.status !== "value" || typeof output.value !== "number") {
    return "not-evaluable";
  }
  return output.value;
}

function checkThreshold(
  condition: ThresholdCondition,
  snapshot: WeaveSnapshotView,
  phase: ConditionPhase,
): ConditionCheckResult {
  const value = numericValue(snapshot, condition.quantityId);
  if (value === "not-evaluable") return "not-evaluable";
  const bound = phase === "enter" ? condition.enter : condition.exit;
  const holds = condition.direction === "at-least" ? value >= bound : value <= bound;
  return holds ? "hold" : "fail";
}

function checkRegime(
  condition: RegimeCondition,
  snapshot: WeaveSnapshotView,
): ConditionCheckResult {
  const actual =
    condition.on === "constantSet" ? snapshot.constantSetId : snapshot.outputs[condition.on]?.value;
  if (actual === undefined) return "not-evaluable";
  return String(actual) === condition.equals ? "hold" : "fail";
}

function checkStatus(
  condition: StatusCondition,
  snapshot: WeaveSnapshotView,
): ConditionCheckResult {
  const output = snapshot.outputs[condition.quantityId];
  if (!output) return "not-evaluable";
  return output.status === condition.equals ? "hold" : "fail";
}

function checkAgreement(
  condition: AgreementCondition,
  snapshot: WeaveSnapshotView,
  phase: ConditionPhase,
): ConditionCheckResult {
  const statistic = numericValue(snapshot, condition.statisticQuantityId);
  if (statistic === "not-evaluable") return "not-evaluable";
  const sampleCount = numericValue(snapshot, condition.sampleCountQuantityId);
  if (sampleCount === "not-evaluable") return "not-evaluable";
  if (sampleCount < condition.minimumSampleSize) return "not-evaluable";

  const alpha = phase === "enter" ? condition.enterAlpha : condition.exitAlpha;

  if (condition.boundFamily === "dkw") {
    const offset =
      condition.offsetQuantityId === undefined
        ? 0
        : numericValue(snapshot, condition.offsetQuantityId);
    if (offset === "not-evaluable") return "not-evaluable";
    const bound = dkwBoundWithOffset(alpha, sampleCount, offset);
    return statistic <= bound ? "hold" : "fail";
  }

  // owner-band: published lower/upper bounds, or band membership.
  if (!condition.lowerBoundQuantityId || !condition.upperBoundQuantityId) return "not-evaluable";
  const lower = numericValue(snapshot, condition.lowerBoundQuantityId);
  const upper = numericValue(snapshot, condition.upperBoundQuantityId);
  if (lower === "not-evaluable" || upper === "not-evaluable") return "not-evaluable";
  return statistic >= lower && statistic <= upper ? "hold" : "fail";
}

export function checkCondition(
  condition: WeaveCondition,
  snapshot: WeaveSnapshotView,
  phase: ConditionPhase,
): ConditionCheckResult {
  switch (condition.kind) {
    case "threshold":
      return checkThreshold(condition, snapshot, phase);
    case "regime":
      return checkRegime(condition, snapshot);
    case "status":
      return checkStatus(condition, snapshot);
    case "agreement":
      return checkAgreement(condition, snapshot, phase);
    default: {
      const exhaustive: never = condition;
      throw new Error(`Unhandled condition kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** All-of composition for one phase. Any not-evaluable condition makes the whole predicate
 * not-evaluable for this phase; a predicate that cannot be evaluated stays unlit -- no pointer
 * suggests disagreement. */
export function checkAllOf(
  conditions: readonly WeaveCondition[],
  snapshot: WeaveSnapshotView,
  phase: ConditionPhase,
): ConditionCheckResult {
  let anyFail = false;
  for (const condition of conditions) {
    const result = checkCondition(condition, snapshot, phase);
    if (result === "not-evaluable") return "not-evaluable";
    if (result === "fail") anyFail = true;
  }
  return anyFail ? "fail" : "hold";
}

export { dkwBound };
