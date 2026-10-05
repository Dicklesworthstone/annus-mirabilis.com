import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WeaveCondition, WeaveFlag, WeavePredicate } from "../../experiments/weave/types.ts";

export function conditionOutputs(condition: WeaveCondition): readonly string[] {
  switch (condition.kind) {
    case "threshold":
    case "status":
      return [condition.quantityId];
    case "regime":
      return condition.on === "constantSet" ? [] : [condition.on];
    case "agreement":
      return [
        condition.statisticQuantityId,
        condition.sampleCountQuantityId,
        condition.offsetQuantityId,
        condition.lowerBoundQuantityId,
        condition.upperBoundQuantityId,
      ].filter((id): id is string => id !== undefined);
  }
}

/**
 * Raw owner values with their own units: no formatted reading is used as input to a predicate.
 *
 * THE NUMBER IS RETURNED, NOT A STRING OF IT. This interpolated `${output.value}` straight into the
 * row, so a reader of bm-01 was shown `9.722317299024293e-13` and eight more like it -- the
 * serialization format of a double, which AGENTS.md's precision rule forbids on a reading surface and
 * which src/units/scientific.ts was written to replace after 202 such tokens reached 22 of the 38
 * laboratory pages. The caller draws `numeric` with `Sci`, which renders a power of ten the way a
 * printed page does and carries a spoken form, so a reader who cannot see the screen is not told
 * "10 minus 13".
 *
 * `value` stays a string for every case that is NOT a scalar -- an absent output, a typed status, a
 * nonfinite value -- because those are words rather than numbers, and collapsing them into a number
 * would be the opposite error. A row carries exactly one of the two.
 */
export function weaveEvidence(predicate: WeavePredicate, accepted: AcceptedSnapshot) {
  const ids = [...new Set(predicate.conditions.flatMap(conditionOutputs))];
  return ids.map((id) => {
    const found = accepted.outputs.filter((output) => output.quantityId === id);
    const output = found.length === 1 ? found[0] : undefined;
    const scalar =
      output !== undefined &&
      output.status === "value" &&
      typeof output.value === "number" &&
      Number.isFinite(output.value);
    return {
      id,
      value: !output
        ? "Unavailable"
        : output.status !== "value"
          ? output.status
          : scalar
            ? ""
            : "No scalar value",
      ...(scalar ? { numeric: output.value as number, unit: output.unit } : {}),
      owner: output?.ownerId,
    };
  });
}

export function unlitExplanation(flag: WeaveFlag): string {
  if (flag.state === "not-evaluable") {
    return "This comparison cannot be evaluated from the current accepted outputs. This is not evidence of disagreement.";
  }
  if (flag.meaning === "assumption-active")
    return "These assumptions or numerical conditions are not selected.";
  if (flag.meaning === "outside-selected-domain")
    return "This domain warning is not active for these outputs.";
  if (flag.meaning === "agreement-within-stated-bound") {
    return "The conditions for this agreement pointer are not met. A finite synthetic sample is not a test of nature.";
  }
  return "This comparison is not active for these outputs.";
}
