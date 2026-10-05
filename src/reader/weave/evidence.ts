import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WeaveCondition, WeaveFlag, WeavePredicate } from "../../experiments/weave/types.ts";

export function conditionOutputs(condition: WeaveCondition): readonly string[] {
  switch (condition.kind) {
    case "threshold":
    case "status": return [condition.quantityId];
    case "regime": return condition.on === "constantSet" ? [] : [condition.on];
    case "agreement": return [condition.statisticQuantityId, condition.sampleCountQuantityId,
      condition.offsetQuantityId, condition.lowerBoundQuantityId, condition.upperBoundQuantityId]
      .filter((id): id is string => id !== undefined);
  }
}

/** Raw owner values with their own units: no formatted reading is used as input to a predicate. */
export function weaveEvidence(predicate: WeavePredicate, accepted: AcceptedSnapshot) {
  const ids = [...new Set(predicate.conditions.flatMap(conditionOutputs))];
  return ids.map((id) => {
    const found = accepted.outputs.filter((output) => output.quantityId === id);
    const output = found.length === 1 ? found[0] : undefined;
    return {
      id,
      value: !output ? "Unavailable" : output.status !== "value" ? output.status :
        typeof output.value !== "number" || !Number.isFinite(output.value) ? "No scalar value" :
        `${output.value} ${output.unit}`,
      owner: output?.ownerId,
    };
  });
}

export function unlitExplanation(flag: WeaveFlag): string {
  if (flag.state === "not-evaluable") {
    return "This comparison cannot be evaluated from the current accepted outputs. This is not evidence of disagreement.";
  }
  if (flag.meaning === "assumption-active") return "These assumptions or numerical conditions are not selected.";
  if (flag.meaning === "outside-selected-domain") return "This domain warning is not active for these outputs.";
  if (flag.meaning === "agreement-within-stated-bound") {
    return "The conditions for this agreement pointer are not met. A finite synthetic sample is not a test of nature.";
  }
  return "This comparison is not active for these outputs.";
}
