/**
 * LQ-08's Millikan 1916 panel: what his Fig. 6 shows, on his own scale, beside the model
 * (am-lq-08-photoelectric-va5a, am-data-millikan-1916-zh2q, dispatch 249).
 *
 * The points come only from a HistoricalDataset record through datasetPlotVerdict, which the page
 * runs on the server (millikanRecord.ts). A withheld record arrives here as a reason and a citation,
 * never as values.
 *
 * WHAT THE POINTS ARE. Millikan prints no table of sodium stopping potentials. Fig. 6 (Phys. Rev. 7,
 * p. 373) plots "the intercepts on the potential axis against the frequencies": the potential
 * applied to the sodium at which each line's photocurrent vanishes, signed, and uncorrected for the
 * contact E.M.F. between sodium and collector. They are not the model's stopping potentials and are
 * never drawn on its axis or shifted onto it. What the two share is the slope, so that is what the
 * panel compares.
 *
 * Epistemic separation:
 * 1. Inspecting the recorded points, on the figure's own scale.
 * 2. Fitting a line to the points the record says fixed Millikan's slope (the shared OLS owner).
 * 3. Setting that slope beside the slopes he printed, and beside h/e from the laboratory's constant
 *    set, whose source is "owner" and which is NEVER derived from the fit.
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
/** The record's fit that names the points Millikan says fixed his slope (p. 374). */
export const MILLIKAN_1916_FIT_ID = "millikan-1916-fig6-five-lines";

/** The two columns Fig. 6 plots, by canonical quantity id and unit. */
export const MILLIKAN_FIG6_AXES: Readonly<{ x: PlotAxis; y: PlotAxis }> = Object.freeze({
  x: Object.freeze({ quantityId: "frequency", unit: "Hz" }),
  y: Object.freeze({ quantityId: "photoelectricInterceptPotential", unit: "V" }),
});

export interface MeasuredInterceptPoint {
  readonly frequencyHz: number;
  /** The intercept on the potential axis, signed, as the figure plots it. */
  readonly interceptVolts: number;
  /** Whether this is one of the points the record says fixed the slope. */
  readonly usedForSlope: boolean;
}

/** A slope the source prints, carried as printed with where it is printed. */
export type PrintedSlope = Readonly<{ label: string; slopeVs: number; citation: string }>;

/** Which of the record's rows fixed the slope, and the slopes the source prints for them. */
export type MillikanSlopeFit = Readonly<{
  rowsUsed: readonly number[];
  printedSlopes: readonly PrintedSlope[];
}>;

/** Fits a line to intercept potentials against frequency. */
export function fitInterceptPoints(
  points: readonly Pick<MeasuredInterceptPoint, "frequencyHz" | "interceptVolts">[],
): OlsLinearFit {
  return fitOls(points.map((p) => ({ x: p.frequencyHz, y: p.interceptVolts })));
}

export type ModelLineSource = "owner" | "fit";

/** h/e from the reference constant set: the model's slope for every metal, never a fit. */
export function ownerSlopeVs(set?: ConstantSet): number {
  const activeSet = set ?? getConstantSet("modern-si-2019");
  const h = constantValue(activeSet, "planckConstant").value;
  const e = constantValue(activeSet, "elementaryCharge").value;
  return h / e;
}

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
  return Object.freeze({
    slope: ownerSlopeVs(set),
    intercept: -workFunctionEv,
    source: "owner" as const,
    description:
      "Theoretical line: slope is exact h/e from reference physics owner, not derived from empirical fit.",
  });
}

export type MillikanOverlayResult =
  | Readonly<{
      kind: "plottable";
      citation: string;
      /** "later evidence, published 1916": from the record's publication date, never the shelf. */
      evidenceLabel: string;
      points: readonly MeasuredInterceptPoint[];
      /** The line fitted to the points used for the slope, drawn across all the points. */
      fittedLine: Readonly<{
        startHz: number;
        startVolts: number;
        endHz: number;
        endVolts: number;
      }>;
      fittedSlopeVs: number;
      fittedSlopeStdErr: number;
      printedSlopes: readonly PrintedSlope[];
      modelLineSlopeVs: number;
      modelLineSource: ModelLineSource;
    }>
  | Readonly<{ kind: "withheld"; citation: string; reason: string }>;

/**
 * What the panel shows. A withheld verdict stays withheld; so does a record that does not say which
 * points fixed the slope, one whose used points are fewer than three, and one with no later-evidence
 * label, since only later evidence belongs beside the model and never on the 1904 shelf.
 */
export function evaluateMillikanOverlay(
  verdict: DatasetPlotVerdict,
  fit: MillikanSlopeFit | undefined,
  evidenceLabel: string | undefined,
  set?: ConstantSet,
): MillikanOverlayResult {
  const withheld = (reason: string) =>
    Object.freeze({ kind: "withheld" as const, citation: verdict.citation, reason });
  if (verdict.kind === "withheld") return withheld(verdict.reason);
  if (!evidenceLabel) {
    return withheld(
      "The record is not marked as later evidence, so it is not set beside the model.",
    );
  }
  if (!fit) return withheld("The record does not say which of its points fixed the slope.");
  const used = new Set(fit.rowsUsed);
  const points = verdict.points.map((p) =>
    Object.freeze({
      frequencyHz: p.x,
      interceptVolts: p.y,
      usedForSlope: used.has(p.rowIndex),
    }),
  );
  const slopePoints = points.filter((p) => p.usedForSlope);
  if (slopePoints.length < 3) {
    return withheld(
      `Only ${slopePoints.length} of the points that fixed the slope give both a frequency and a potential, and a line needs three.`,
    );
  }
  const line = fitInterceptPoints(slopePoints);
  const frequencies = points.map((p) => p.frequencyHz);
  const startHz = Math.min(...frequencies);
  const endHz = Math.max(...frequencies);
  return Object.freeze({
    kind: "plottable",
    citation: verdict.citation,
    evidenceLabel,
    points: Object.freeze(points),
    fittedLine: Object.freeze({
      startHz,
      startVolts: line.intercept + line.slope * startHz,
      endHz,
      endVolts: line.intercept + line.slope * endHz,
    }),
    fittedSlopeVs: line.slope,
    fittedSlopeStdErr: line.slopeStandardError,
    printedSlopes: Object.freeze([...fit.printedSlopes]),
    modelLineSlopeVs: ownerSlopeVs(set),
    modelLineSource: "owner",
  });
}
