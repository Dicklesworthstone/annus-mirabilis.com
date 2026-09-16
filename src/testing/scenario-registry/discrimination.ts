import { type ToleranceSpec, withinTolerance } from "../../units/tolerance.ts";

export type DiscriminationOutcome = "indistinguishable" | "discriminates" | "indeterminate";

/**
 * Observational comparison of two hypothesis outputs. A result inside the
 * tolerance module's invalid-spec or nonfinite path is indeterminate; a
 * difference inside the observational tolerance is indistinguishable. The
 * observational spec is not reused as classifyWithTolerance's cancellation
 * band: that would turn every agreement into "indeterminate".
 */
export function compareHypotheses(
  a: number,
  b: number,
  spec: ToleranceSpec,
): { outcome: DiscriminationOutcome; difference: number; verdictKind: string } {
  const verdict = withinTolerance(a, b, { ...spec, relativeTo: spec.relativeTo ?? "larger" });
  if (
    verdict.kind === "invalid-spec" ||
    verdict.kind === "nonfinite-actual" ||
    verdict.kind === "nonfinite-reference"
  ) {
    return { outcome: "indeterminate", difference: verdict.diff, verdictKind: verdict.kind };
  }
  return {
    outcome: verdict.ok ? "indistinguishable" : "discriminates",
    difference: verdict.diff,
    verdictKind: verdict.kind,
  };
}
