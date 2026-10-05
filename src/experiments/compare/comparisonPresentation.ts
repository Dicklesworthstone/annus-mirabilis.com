import { statusMessage } from "../results/explanations.ts";
import type { ComparisonValue } from "./Baseline.ts";
import { comparisonDisplay } from "./comparisonStatement.ts";
import type { ComparisonCommand } from "./singleVariationLock.ts";

export const COMPARISON_UNCERTAINTY_NOTE =
  "Readout uncertainties are shown separately. Ratios and differences use point estimates; no uncertainty propagation or statistical significance is claimed.";

/** Reader text, not raw status identifiers; the full evidence remains available for inspection. */
export function comparisonReadoutText(result: ComparisonValue, factor = 1): string {
  return result.status === "value" && result.value !== null
    ? comparisonDisplay(result.value, factor)
    : result.reason || statusMessage(result.status);
}

/** Unit conversion only, never a new uncertainty model or an assumption of independent trials. */
export function comparisonUncertaintyText(
  result: ComparisonValue,
  factor: number,
  unit: string,
): string | null {
  const evidence = result.evidence;
  if (evidence?.status !== "value" || !evidence.uncertainty) return null;
  const uncertainty = evidence.uncertainty;
  const measure = (value: number) => `${comparisonDisplay(value, Math.abs(factor))} ${unit}`.trim();
  const interval = (lower: number, upper: number) => {
    const first = factor < 0 ? upper : lower;
    const last = factor < 0 ? lower : upper;
    return `[${comparisonDisplay(first, factor)}, ${comparisonDisplay(last, factor)}] ${unit}`.trim();
  };
  switch (uncertainty.kind) {
    case "statistical-interval":
      return `${comparisonDisplay(uncertainty.coverage, 100)}% statistical interval: ${interval(uncertainty.lower, uncertainty.upper)}; sample size ${uncertainty.sampleSize}; ${uncertainty.method}.`;
    case "enclosure":
      return `Enclosure: ${interval(uncertainty.lower, uncertainty.upper)}; ${uncertainty.method}.`;
    case "numerical-error-estimate":
      return `Numerical error ${uncertainty.guarantee === "bound" ? "bound" : "estimate"}: ${measure(uncertainty.magnitude)}; ${uncertainty.method}.`;
    case "input-precision":
      return `Input precision: ${uncertainty.significantFigures} significant figures; ${uncertainty.source}.`;
    case "measurement-uncertainty":
      return `Measurement uncertainty: ${measure(uncertainty.magnitude)}; ${uncertainty.uncertaintyType}; dataset ${uncertainty.datasetId}.`;
  }
}

const roles: Readonly<Record<ComparisonCommand, string>> = Object.freeze({
  "setup-change": "Physically changed",
  "measurement-change": "Measurement changed",
  "observer-change": "Re-described",
  "estimator-change": "Estimator changed",
  "presentation-change": "View changed only",
});

export function comparisonInputRole(fixed: boolean, command: ComparisonCommand): string {
  return fixed ? "Held fixed (locked)" : roles[command];
}
