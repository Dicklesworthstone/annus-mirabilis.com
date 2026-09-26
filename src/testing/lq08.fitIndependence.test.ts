import { describe, expect, it } from "bun:test";
import type { DatasetPlotVerdict } from "../content/datasets/plotVerdict.ts";
import {
  evaluateMillikanOverlay,
  fitInterceptPoints,
  getOwnerTheoreticalLine,
  type MeasuredInterceptPoint,
  type MillikanOverlayResult,
  type MillikanSlopeFit,
} from "../experiments/lq08/millikan.ts";
import { stoppingLine } from "../physics/reference/photoelectric.ts";

/**
 * Constructed rows, not Millikan's observations: fit independence is a property of the plumbing and
 * needs no historical data. Until 2026-09-24 these tests used the Millikan 1916 record's rows, which
 * were withdrawn (am-data-millikan-1916-zh2q). The slope is near h/e and deliberately not equal to it.
 */
const CONSTRUCTED: DatasetPlotVerdict = Object.freeze({
  kind: "plottable",
  datasetId: "constructed-stopping-line",
  citation: "Constructed for this test",
  points: [
    [5.0e14, 0.3],
    [6.0e14, 0.71],
    [7.0e14, 1.13],
    [8.0e14, 1.52],
    [9.0e14, 1.95],
  ].map(([x, y], rowIndex) => Object.freeze({ rowIndex, x: x as number, y: y as number })),
});
const CONSTRUCTED_POINTS: readonly MeasuredInterceptPoint[] =
  CONSTRUCTED.kind === "plottable"
    ? CONSTRUCTED.points.map((p) => ({ frequencyHz: p.x, interceptVolts: p.y, usedForSlope: true }))
    : [];
/** Every constructed row fixes the slope; no slope is printed for constructed rows. */
const ALL_ROWS: MillikanSlopeFit = { rowsUsed: [0, 1, 2, 3, 4], printedSlopes: [] };
const LABEL = "later evidence, published 1916";

function plotted(result: MillikanOverlayResult) {
  if (result.kind !== "plottable") throw new TypeError(`overlay withheld: ${result.reason}`);
  return result;
}

describe("LQ-08 Millikan Fit Independence & Epistemic Separation (am-lq-08-photoelectric-va5a)", () => {
  it("rendered model line slope equals stoppingLine(Phi).slope bitwise (h/e) and is independent of fit", () => {
    const workFunctionEv = 2.2;
    const workFunctionJ = workFunctionEv * 1.602176634e-19;

    const refStoppingLine = stoppingLine(workFunctionJ, {
      min: 5.0e14,
      max: 1.2e15,
      steps: 10,
    });
    const theoreticalLine = getOwnerTheoreticalLine(workFunctionEv);

    // Exact bitwise equality: theoretical line slope === stoppingLine slope === h/e
    expect(theoreticalLine.slope).toBe(refStoppingLine.slope);
    expect(Object.is(theoreticalLine.slope, refStoppingLine.slope)).toBe(true);

    const overlay = plotted(evaluateMillikanOverlay(CONSTRUCTED, ALL_ROWS, LABEL));
    expect(overlay.modelLineSource).toBe("owner");
    expect(overlay.modelLineSlopeVs).toBe(theoreticalLine.slope);
    expect(overlay.modelLineSlopeVs).toBe(refStoppingLine.slope);

    // The empirical fitted slope is different from the exact theoretical slope
    expect(overlay.fittedSlopeVs).not.toBe(overlay.modelLineSlopeVs);
    expect(overlay.fittedSlopeStdErr).toBeGreaterThan(0);
  });

  it("shifting experimental dataset by 20% changes fitted slope while leaving model line slope invariant", () => {
    const baselineFit = fitInterceptPoints(CONSTRUCTED_POINTS);
    const baselineTheory = getOwnerTheoreticalLine(2.2);

    // Shift dataset potentials by +20%
    const shiftedPoints: readonly MeasuredInterceptPoint[] = CONSTRUCTED_POINTS.map((p) => ({
      ...p,
      interceptVolts: p.interceptVolts * 1.2,
    }));

    const shiftedFit = fitInterceptPoints(shiftedPoints);

    // Fitted slope must change by ~20%
    expect(shiftedFit.slope).toBeCloseTo(baselineFit.slope * 1.2, 5);
    expect(shiftedFit.slope).not.toBe(baselineFit.slope);

    // Model line slope must be strictly invariant (not affected by data shift)
    const afterTheory = getOwnerTheoreticalLine(2.2);
    expect(afterTheory.slope).toBe(baselineTheory.slope);
    expect(Object.is(afterTheory.slope, baselineTheory.slope)).toBe(true);

    // The discrepancy between fit and model changes
    const baselineDiff = Math.abs(baselineFit.slope - baselineTheory.slope);
    const shiftedDiff = Math.abs(shiftedFit.slope - afterTheory.slope);
    expect(shiftedDiff).toBeGreaterThan(baselineDiff);
  });

  it("negative invariant: sourcing model line from empirical fit fails verification check", () => {
    function assertModelLineIndependence(result: {
      modelLineSource: string;
      modelLineSlopeVs: number;
      fittedSlopeVs: number;
    }): void {
      if (result.modelLineSource === "fit") {
        throw new Error(
          "Epistemic separation failure: model line source cannot be 'fit'; it must be 'owner'",
        );
      }
      if (Object.is(result.modelLineSlopeVs, result.fittedSlopeVs)) {
        throw new Error(
          "Epistemic circularity failure: theoretical model line slope equals empirical fit slope",
        );
      }
    }

    const validOverlay = plotted(evaluateMillikanOverlay(CONSTRUCTED, ALL_ROWS, LABEL));
    expect(() => assertModelLineIndependence(validOverlay)).not.toThrow();

    // Sourcing from fit must throw
    expect(() =>
      assertModelLineIndependence({
        modelLineSource: "fit",
        modelLineSlopeVs: validOverlay.fittedSlopeVs,
        fittedSlopeVs: validOverlay.fittedSlopeVs,
      }),
    ).toThrow("Epistemic separation failure: model line source cannot be 'fit'");

    // Circularity where model slope is identical to fit slope must throw
    expect(() =>
      assertModelLineIndependence({
        modelLineSource: "owner",
        modelLineSlopeVs: validOverlay.fittedSlopeVs,
        fittedSlopeVs: validOverlay.fittedSlopeVs,
      }),
    ).toThrow("Epistemic circularity failure");
  });

  it("the overlay carries the verdict's citation and points in row order, with a standard error", () => {
    const overlay = plotted(evaluateMillikanOverlay(CONSTRUCTED, ALL_ROWS, LABEL));
    expect(overlay.citation).toBe("Constructed for this test");
    expect(overlay.points).toEqual(CONSTRUCTED_POINTS);
    expect(overlay.fittedSlopeStdErr).toBeGreaterThan(0);
    const fit = fitInterceptPoints(CONSTRUCTED_POINTS);
    expect(fit.sampleCount).toBe(CONSTRUCTED_POINTS.length);
    expect(overlay.fittedSlopeVs).toBe(fit.slope);
  });
});
