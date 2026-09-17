import type { Scenario } from "../../content/schemas/experiment.ts";
import {
  classifyWithTolerance,
  type ToleranceBand,
  type ToleranceSpec,
  withinTolerance,
} from "../../units/tolerance.ts";

export type DiscriminationOutcome = "indistinguishable" | "discriminates" | "indeterminate";

/**
 * Observational comparison of two hypothesis outputs. A result inside the
 * tolerance module's invalid-spec or nonfinite path is indeterminate.
 * When the difference sits inside classifyWithTolerance's boundary band
 * around the tolerance threshold, reports "indeterminate".
 * Otherwise reports "indistinguishable" or "discriminates".
 */
export function compareHypotheses(
  a: number,
  b: number,
  spec: ToleranceSpec & { boundaryBand?: ToleranceBand | number },
): { outcome: DiscriminationOutcome; difference: number; verdictKind: string } {
  const verdict = withinTolerance(a, b, { ...spec, relativeTo: spec.relativeTo ?? "larger" });
  if (
    verdict.kind === "invalid-spec" ||
    verdict.kind === "nonfinite-actual" ||
    verdict.kind === "nonfinite-reference"
  ) {
    return { outcome: "indeterminate", difference: verdict.diff, verdictKind: verdict.kind };
  }

  // AC 29: Boundary band handling using classifyWithTolerance.
  // When diff is within the boundary band of allowed, report indeterminate.
  const boundaryBandConfig: ToleranceBand =
    typeof spec.boundaryBand === "number"
      ? { absolute: spec.boundaryBand, scale: verdict.allowed }
      : typeof spec.boundaryBand === "object" && spec.boundaryBand !== null
        ? spec.boundaryBand
        : {
            absolute: Math.max(
              (spec.absolute ?? 0) * 1e-4,
              (spec.relative ?? 0) * verdict.allowed * 1e-4,
              50 * Number.EPSILON * Math.max(verdict.allowed, 1e-15),
            ),
            scale: verdict.allowed,
          };

  const boundaryCheck = classifyWithTolerance(verdict.diff - verdict.allowed, boundaryBandConfig);
  if (boundaryCheck.sign === "indeterminate") {
    return {
      outcome: "indeterminate",
      difference: verdict.diff,
      verdictKind: "boundary-band-indeterminate",
    };
  }

  return {
    outcome: verdict.ok ? "indistinguishable" : "discriminates",
    difference: verdict.diff,
    verdictKind: verdict.kind,
  };
}

/**
 * 1904 shelf guard (AC 30): A hypothesis whose status is `later-development`
 * cited by an instrument's 1904-mode acceptance case fails.
 */
export function guard1904Shelf(
  scenario: Scenario,
  is1904Mode: boolean,
): { ok: boolean; reason?: string } {
  if (!is1904Mode || scenario.kind !== "discrimination") {
    return { ok: true };
  }
  for (const hyp of scenario.hypotheses ?? []) {
    if (hyp.historicalStatus === "later-development") {
      return {
        ok: false,
        reason: `Hypothesis "${hyp.id}" has historicalStatus "later-development" and cannot be cited in 1904 mode.`,
      };
    }
  }
  return { ok: true };
}

/**
 * Rendered sentence for discrimination outcome (AC 32).
 * Ordinary-language sentence describing the outcome with next actions,
 * containing NO status identifiers, NO kind names, and NO hypothesis IDs.
 */
export function renderDiscriminationSentence(
  _scenario: Scenario,
  outcome: DiscriminationOutcome,
  diff?: number,
): string {
  if (outcome === "indeterminate") {
    return (
      "At this observation, the difference between the two accounts sits within the measurement boundary band. " +
      "To resolve them, refine the detector resolution or select an observation with greater separation."
    );
  }
  if (outcome === "discriminates") {
    const diffText =
      diff !== undefined && Number.isFinite(diff)
        ? ` (relative difference about ${diff.toExponential(2)})`
        : "";
    return (
      `The two accounts diverge under this observation${diffText}. ` +
      "The physical data separates them, and the transformation law relates their descriptions rather than simple equality."
    );
  }
  return (
    "At this speed the two accounts differ by less than the apparatus could resolve. " +
    "To tell them apart you would need a measurement sensitive to about one part in 10^8, or a speed high enough for the second-order term to show."
  );
}
