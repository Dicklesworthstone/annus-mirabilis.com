/**
 * Millikan 1916 Sodium Dataset and OLS Linear Regression (am-lq-08-photoelectric-va5a).
 *
 * Epistemic separation:
 * 1. Inspecting raw experimental data points (Millikan 1916 Table IV / Figure 3).
 * 2. Fitting an empirical OLS regression line (yielding experimental slope and standard error).
 * 3. Overlaying the theoretical model line (where the slope comes STRICTLY from the reference
 *    physics owner h/e, with modelLineSource === "owner", NEVER derived from the fit).
 */

import {
  type ConstantSet,
  constantValue,
  getConstantSet,
} from "../../physics/reference/constants.ts";

export interface MillikanDataPoint {
  readonly wavelengthNm: number;
  readonly frequencyHz: number;
  readonly stoppingPotentialVolts: number;
  readonly originalTokenWavelength?: string;
  readonly originalTokenFrequency?: string;
  readonly originalTokenPotential?: string;
}

/**
 * Historical Millikan 1916 sodium data points transcribed from Physical Review 7, 355-389.
 */
export const MILLIKAN_1916_SODIUM_POINTS: readonly MillikanDataPoint[] = Object.freeze([
  Object.freeze({
    wavelengthNm: 546.1,
    frequencyHz: 5.489e14,
    stoppingPotentialVolts: 0.475,
    originalTokenWavelength: "546.1",
    originalTokenFrequency: "5.489",
    originalTokenPotential: "0.475",
  }),
  Object.freeze({
    wavelengthNm: 435.8,
    frequencyHz: 6.879e14,
    stoppingPotentialVolts: 1.049,
    originalTokenWavelength: "435.8",
    originalTokenFrequency: "6.879",
    originalTokenPotential: "1.049",
  }),
  Object.freeze({
    wavelengthNm: 404.7,
    frequencyHz: 7.408e14,
    stoppingPotentialVolts: 1.267,
    originalTokenWavelength: "404.7",
    originalTokenFrequency: "7.408",
    originalTokenPotential: "1.267",
  }),
  Object.freeze({
    wavelengthNm: 365.0,
    frequencyHz: 8.214e14,
    stoppingPotentialVolts: 1.6,
    originalTokenWavelength: "365.0",
    originalTokenFrequency: "8.214",
    originalTokenPotential: "1.600",
  }),
  Object.freeze({
    wavelengthNm: 312.6,
    frequencyHz: 9.329e14,
    stoppingPotentialVolts: 2.06,
    originalTokenWavelength: "312.6",
    originalTokenFrequency: "9.329",
    originalTokenPotential: "2.060",
  }),
  Object.freeze({
    wavelengthNm: 253.5,
    frequencyHz: 1.183e15,
    stoppingPotentialVolts: 3.092,
    originalTokenWavelength: "253.5",
    originalTokenFrequency: "11.83",
    originalTokenPotential: "3.092",
  }),
]);

// Shared numerical owner; preserve the public OLS imports used by the existing laboratory.
import { fitOls, type OlsLinearFit } from "../../physics/reference/inference/lineFit.ts";
export { fitOls, type OlsLinearFit } from "../../physics/reference/inference/lineFit.ts";

/**
 * Fits the Millikan 1916 Sodium stopping potentials against frequency.
 */
export function fitMillikanSodiumData(
  points: readonly MillikanDataPoint[] = MILLIKAN_1916_SODIUM_POINTS,
): OlsLinearFit {
  const pairs = points.map((p) => ({
    x: p.frequencyHz,
    y: p.stoppingPotentialVolts,
  }));
  return fitOls(pairs);
}

export type ModelLineSource = "owner" | "fit";

export interface ComparisonLine {
  readonly slope: number;
  readonly intercept: number;
  readonly source: ModelLineSource;
  readonly description: string;
}

/**
 * Returns the theoretical model line whose slope is STRICTLY taken from the reference
 * physics owner h/e (am-lq-08-photoelectric-va5a epistemic rule).
 */
export function getOwnerTheoreticalLine(workFunctionEv: number, set?: ConstantSet): ComparisonLine {
  const activeSet = set ?? getConstantSet("modern-si-2019");
  const h = constantValue(activeSet, "planckConstant").value;
  const e = constantValue(activeSet, "elementaryCharge").value;
  const slope = h / e;
  const intercept = -workFunctionEv;

  return Object.freeze({
    slope,
    intercept,
    source: "owner" as const,
    description:
      "Theoretical line: slope is exact h/e from reference physics owner, not derived from empirical fit.",
  });
}

export function evaluateMillikanOverlay(workFunctionEv = 2.2, set?: ConstantSet) {
  const fit = fitMillikanSodiumData();
  const theoretical = getOwnerTheoreticalLine(workFunctionEv, set);
  return Object.freeze({
    fittedSlopeVs: fit.slope,
    fittedSlopeStdErr: fit.slopeStandardError,
    modelLineSlopeVs: theoretical.slope,
    modelLineSource: theoretical.source,
    dataset: Object.freeze({
      citation:
        'Millikan, R. A. (1916). A Direct Photoelectric Determination of Planck\'s "h". Physical Review 7, 355–389.',
      points: MILLIKAN_1916_SODIUM_POINTS,
    }),
  });
}

export type MillikanOverlayResult = ReturnType<typeof evaluateMillikanOverlay>;
