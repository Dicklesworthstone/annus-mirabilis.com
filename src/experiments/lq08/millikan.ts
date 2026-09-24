/**
 * LQ-08's measured-points overlay: the points it may draw and the line fitted to them
 * (am-lq-08-photoelectric-va5a, am-data-millikan-1916-zh2q).
 *
 * The points come only from a HistoricalDataset record through datasetPlotVerdict, which the page
 * runs on the server (millikanRecord.ts). A withheld record arrives here as a reason and a citation,
 * never as values. Until 2026-09-24 the points were a copy typed into this file, so the record's
 * evidence status could change and the plot would not have noticed.
 *
 * Epistemic separation:
 * 1. Inspecting the recorded points.
 * 2. Fitting an empirical OLS regression line (yielding experimental slope and standard error).
 * 3. Overlaying the theoretical model line (where the slope comes STRICTLY from the reference
 *    physics owner h/e, with modelLineSource === "owner", NEVER derived from the fit).
 */

import type { DatasetPlotVerdict, PlotAxis } from "../../content/datasets/plotVerdict.ts";
import {
  type ConstantSet,
  constantValue,
  getConstantSet,
} from "../../physics/reference/constants.ts";
// Shared numerical owner; preserve the public OLS imports used by the existing laboratory.
import { fitOls, type OlsLinearFit } from "../../physics/reference/inference/lineFit.ts";

export { fitOls, type OlsLinearFit } from "../../physics/reference/inference/lineFit.ts";

export const MILLIKAN_1916_DATASET_ID = "millikan-1916-sodium";

/** The two columns the stopping-potential plot reads, by canonical quantity id and unit. */
export const STOPPING_LINE_AXES: Readonly<{ x: PlotAxis; y: PlotAxis }> = Object.freeze({
  x: Object.freeze({ quantityId: "frequency", unit: "Hz" }),
  y: Object.freeze({ quantityId: "stoppingPotentialMagnitude", unit: "V" }),
});

export interface MeasuredStoppingPoint {
  readonly frequencyHz: number;
  readonly stoppingPotentialVolts: number;
}

/** Fits recorded stopping potentials against frequency. */
export function fitStoppingPoints(points: readonly MeasuredStoppingPoint[]): OlsLinearFit {
  return fitOls(points.map((p) => ({ x: p.frequencyHz, y: p.stoppingPotentialVolts })));
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

export type MillikanOverlayResult =
  | Readonly<{
      kind: "plottable";
      citation: string;
      points: readonly MeasuredStoppingPoint[];
      fittedSlopeVs: number;
      fittedSlopeStdErr: number;
      modelLineSlopeVs: number;
      modelLineSource: ModelLineSource;
    }>
  | Readonly<{ kind: "withheld"; citation: string; reason: string }>;

/**
 * What the stopping-potential plot shows beside the model line. A withheld verdict stays withheld,
 * and so does a record with fewer than three usable rows, since no line can be fitted to it.
 */
export function evaluateMillikanOverlay(
  verdict: DatasetPlotVerdict,
  workFunctionEv = 2.2,
  set?: ConstantSet,
): MillikanOverlayResult {
  if (verdict.kind === "withheld") {
    return Object.freeze({ kind: "withheld", citation: verdict.citation, reason: verdict.reason });
  }
  const points = verdict.points.map((p) =>
    Object.freeze({ frequencyHz: p.x, stoppingPotentialVolts: p.y }),
  );
  if (points.length < 3) {
    return Object.freeze({
      kind: "withheld",
      citation: verdict.citation,
      reason: `Only ${points.length} of its rows give both a frequency and a stopping potential, and a line needs three.`,
    });
  }
  const fit = fitStoppingPoints(points);
  const theoretical = getOwnerTheoreticalLine(workFunctionEv, set);
  return Object.freeze({
    kind: "plottable",
    citation: verdict.citation,
    points: Object.freeze(points),
    fittedSlopeVs: fit.slope,
    fittedSlopeStdErr: fit.slopeStandardError,
    modelLineSlopeVs: theoretical.slope,
    modelLineSource: theoretical.source,
  });
}
