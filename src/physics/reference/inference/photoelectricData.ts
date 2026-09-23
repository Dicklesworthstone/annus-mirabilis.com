/** Inverse photoelectric calculation: fit measured endpoints, not simulated currents.
 * V_measured = (h/e) nu - Phi/e + offset. A common unknown offset is confounded
 * with Phi, but not the slope. Frequencies are treated as known without error.
 * No historical data, prior, p-value or automatic point rejection is supplied here.
 */
import { fitLine, type LineEstimate } from "./lineFit.ts";
import { withinTolerance } from "../../../units/tolerance.ts";

export type PhotoelectricReference = Readonly<{
  constantSetId: string;
  elementaryCharge: number;
  planckConstant: number;
  speedOfLight: number;
}>;
export type PhotoelectricObservation = Readonly<{ row: number; frequencyTHz: number; stoppingV: number; sigmaV?: number }>;
export type FitOptions = Readonly<{
  weighting: "equal" | "declared-sigma";
  offset: Readonly<{ kind: "unknown" }> | Readonly<{ kind: "known"; volts: number; sigmaV: number }>;
}>;
export type InferredQuantity =
  | Readonly<{ status: "value"; value: number; standardError: number; unit: string }>
  | Readonly<{ status: "underdetermined" | "outside-domain"; reason: string; unit: string }>;
export type PhotoelectricDataFit = Readonly<{
  status: "value";
  fit: LineEstimate;
  usedRows: readonly number[];
  planckEstimate: InferredQuantity;
  workFunction: InferredQuantity;
  threshold: InferredQuantity;
  referenceSlopeVPerTHz: number;
  relativeSlopeDifference: number;
  warnings: readonly string[];
}> | Readonly<{ status: "underdetermined"; reason: string; usedRows: readonly number[] }>;

/** A refusal from this owner. The kebab-case code comes first so the refusal scanner reads it at
 * the throw site; the message is unchanged, because the workbench shows it to a reader. */
export class PhotoelectricDataError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PhotoelectricDataError";
    this.code = code;
  }
}

function quantity(value: number, standardError: number, unit: string): InferredQuantity {
  return Object.freeze({ status: "value", value, standardError, unit });
}
function missing(reason: string, unit: string, status: "underdetermined" | "outside-domain" = "underdetermined"): InferredQuantity {
  return Object.freeze({ status, reason, unit });
}
export function analyzePhotoelectricData(
  rows: readonly PhotoelectricObservation[], options: FitOptions, reference: PhotoelectricReference,
): PhotoelectricDataFit {
  if (!reference.constantSetId || ![reference.elementaryCharge, reference.planckConstant, reference.speedOfLight].every((x) => Number.isFinite(x) && x > 0)) {
    throw new PhotoelectricDataError("photoelectric-reference-invalid", "The reference constants must come from a declared positive finite calibration.");
  }
  if (options.weighting !== "equal" && options.weighting !== "declared-sigma") throw new PhotoelectricDataError("photoelectric-weighting-unknown", "Unknown weighting model.");
  if (options.offset.kind !== "unknown" && options.offset.kind !== "known") throw new PhotoelectricDataError("photoelectric-offset-model-unknown", "Unknown offset model.");
  if (options.offset.kind === "known" && (!Number.isFinite(options.offset.volts) || Math.abs(options.offset.volts) > 1e4 ||
      !Number.isFinite(options.offset.sigmaV) || options.offset.sigmaV < 0 || options.offset.sigmaV > 1e4)) throw new PhotoelectricDataError("photoelectric-offset-out-of-range", "Use an offset within ±10000 V and a nonnegative standard uncertainty up to 10000 V.");
  if (rows.length < 3 || rows.length > 1000) throw new PhotoelectricDataError("photoelectric-row-count", "Select 3 to 1000 observations.");
  const seen = new Set<number>();
  for (const row of rows) {
    if (!Number.isInteger(row.row) || row.row < 1 || seen.has(row.row)) throw new PhotoelectricDataError("photoelectric-row-identity", "Each observation needs a unique positive row identity.");
    seen.add(row.row);
    if (!Number.isFinite(row.frequencyTHz) || row.frequencyTHz < 1e-6 || row.frequencyTHz > 1e6 || !Number.isFinite(row.stoppingV) || Math.abs(row.stoppingV) > 1e4) throw new PhotoelectricDataError("photoelectric-observation-out-of-range", "Observation outside the admitted frequency or voltage range.");
    if (row.sigmaV !== undefined && (!Number.isFinite(row.sigmaV) || row.sigmaV < 1e-9 || row.sigmaV > 1e4)) throw new PhotoelectricDataError("photoelectric-sigma-invalid", "Invalid voltage standard uncertainty.");
    if (options.weighting === "declared-sigma" && row.sigmaV === undefined) throw new PhotoelectricDataError("photoelectric-sigma-required", "Supply sigma_V for every row before selecting uncertainty weighting.");
  }
  const usedRows = Object.freeze(rows.map((r) => r.row));
  const lo = Math.min(...rows.map((r) => r.frequencyTHz));
  const hi = Math.max(...rows.map((r) => r.frequencyTHz));
  // Unresolved when hi - lo <= 64 eps * max(1, |lo|, |hi|): both bounds positive, relative to the larger.
  if (withinTolerance(hi, lo, { absolute: 64 * Number.EPSILON, relative: 64 * Number.EPSILON, relativeTo: "larger" }).ok) {
    return Object.freeze({ status: "underdetermined", reason: "The selected frequencies are identical or numerically unresolved. Repeated measurements at one frequency cannot separate slope from intercept.", usedRows });
  }
  const fit = fitLine(rows.map((r) => ({ x: r.frequencyTHz, y: r.stoppingV, ...(r.sigmaV === undefined ? {} : { sigma: r.sigmaV }) })), options.weighting === "declared-sigma");
  const slopeError = Math.sqrt(fit.slopeVariance);
  const warnings: string[] = [];
  if (options.weighting === "equal" && rows.some((r) => r.sigmaV !== undefined)) warnings.push("The sigma_V column is retained but ignored in the selected equal-weight fit.");
  if (fit.residualStandardDeviation === 0) warnings.push("The entered rows lie exactly on a line. Zero residual scatter is not evidence of exact measurement or absent systematic error.");
  if (fit.reducedChiSquare !== null) warnings.push("Reduced chi-square is a diagnostic under the declared independent errors, not a pass/fail threshold or a probability that the model is true. Covariance is not rescaled to force agreement.");
  if (hi - lo < 0.01 * Math.max(Math.abs(lo), Math.abs(hi))) warnings.push("The frequency span is narrow. The intercept and threshold are long extrapolations even when the fitted line looks precise.");
  let planckEstimate: InferredQuantity;
  let workFunction: InferredQuantity;
  let threshold: InferredQuantity;
  if (fit.slope <= 0) {
    const reason = "The fitted slope is not positive. These rows do not yield a physically positive h under this photoelectric model; the empirical line is still shown.";
    planckEstimate = missing(reason, "J s", "outside-domain");
    workFunction = missing(reason, "eV", "outside-domain");
    threshold = missing(reason, "THz", "outside-domain");
  } else {
    planckEstimate = quantity(reference.elementaryCharge * fit.slope / 1e12, reference.elementaryCharge * slopeError / 1e12, "J s");
    if (slopeError >= fit.slope) warnings.push("The slope is not separated from zero at the one-standard-error scale. A ratio-based threshold is unresolved here.");
    if (options.offset.kind === "unknown") {
      const reason = "An unknown common voltage offset and the surface escape work enter the same intercept. The frequency sweep alone cannot identify either the work function or its physical threshold.";
      workFunction = missing(reason, "eV");
      threshold = missing(reason, "THz");
    } else {
      const phi = options.offset.volts - fit.intercept;
      const phiError = Math.sqrt(fit.interceptVariance + options.offset.sigmaV ** 2);
      if (phi < 0) {
        const reason = "The calibrated intercept implies negative escape work. Check voltage sign, calibration and the applicability of the model instead of clamping it to zero.";
        workFunction = missing(reason, "eV", "outside-domain");
        threshold = missing(reason, "THz", "outside-domain");
      } else {
        workFunction = quantity(phi, phiError, "eV");
        const delta = options.offset.volts - fit.centerY;
        // Centered propagation includes slope/intercept covariance without cancellation.
        const thresholdError = Math.sqrt(fit.centerVariance + options.offset.sigmaV ** 2 + (delta / fit.slope) ** 2 * fit.slopeVariance) / fit.slope;
        threshold = slopeError >= fit.slope ? missing("The fitted slope is too close to zero for a stable linearized threshold uncertainty.", "THz") : quantity(phi / fit.slope, thresholdError, "THz");
        if (phiError >= phi) warnings.push("The work-function estimate is not separated from zero at one standard error; threshold uncertainty is a local linear approximation, not a confidence bound.");
      }
    }
  }
  const referenceSlopeVPerTHz = reference.planckConstant / reference.elementaryCharge * 1e12;
  const relativeSlopeDifference = fit.slope / referenceSlopeVPerTHz - 1;
  if (![referenceSlopeVPerTHz, relativeSlopeDifference].every(Number.isFinite)) throw new PhotoelectricDataError("photoelectric-reference-comparison-nonfinite", "Reference comparison is not numerically representable.");
  for (const q of [planckEstimate, workFunction, threshold]) if (q.status === "value" && ![q.value, q.standardError].every(Number.isFinite)) throw new PhotoelectricDataError("photoelectric-inferred-nonfinite", "An inferred quantity exceeds numerical precision.");
  return Object.freeze({ status: "value", fit, usedRows, planckEstimate, workFunction, threshold, referenceSlopeVPerTHz, relativeSlopeDifference, warnings: Object.freeze(warnings) });
}
