import { describe, expect, it } from "bun:test";
import {
  evaluateMillikanOverlay,
  fitMillikanSodiumData,
  fitOls,
  getOwnerTheoreticalLine,
  MILLIKAN_1916_SODIUM_POINTS,
  type MillikanDataPoint,
} from "../experiments/lq08/millikan.ts";
import { stoppingLine } from "../physics/reference/photoelectric.ts";

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

    const overlay = evaluateMillikanOverlay(workFunctionEv);
    expect(overlay.modelLineSource).toBe("owner");
    expect(overlay.modelLineSlopeVs).toBe(theoreticalLine.slope);
    expect(overlay.modelLineSlopeVs).toBe(refStoppingLine.slope);

    // The empirical fitted slope is different from the exact theoretical slope
    expect(overlay.fittedSlopeVs).not.toBe(overlay.modelLineSlopeVs);
    expect(overlay.fittedSlopeStdErr).toBeGreaterThan(0);
  });

  it("shifting experimental dataset by 20% changes fitted slope while leaving model line slope invariant", () => {
    const baselineFit = fitMillikanSodiumData();
    const baselineTheory = getOwnerTheoreticalLine(2.2);

    // Shift dataset stopping potentials by +20%
    const shiftedPoints: readonly MillikanDataPoint[] = MILLIKAN_1916_SODIUM_POINTS.map((p) => ({
      ...p,
      stoppingPotentialVolts: p.stoppingPotentialVolts * 1.2,
    }));

    const shiftedFit = fitMillikanSodiumData(shiftedPoints);

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

    const validOverlay = evaluateMillikanOverlay(2.2);
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

  it("Millikan 1916 dataset presents cited source and documented points with standard error", () => {
    const overlay = evaluateMillikanOverlay(2.2);
    expect(overlay.dataset.citation).toContain("Millikan, R. A. (1916)");
    expect(overlay.dataset.citation).toContain("Physical Review 7, 355–389");
    expect(overlay.dataset.points.length).toBe(6);

    // Verify sodium mercury line frequencies and potentials
    const p546 = overlay.dataset.points.find((p) => p.originalTokenWavelength === "546.1");
    expect(p546).toBeDefined();
    expect(p546?.frequencyHz).toBe(5.489e14);
    expect(p546?.stoppingPotentialVolts).toBe(0.475);

    const fit = fitMillikanSodiumData();
    expect(fit.rSquared).toBeGreaterThan(0.99); // Millikan's line is famously straight (R^2 > 0.999)
    expect(fit.slopeStandardError).toBeGreaterThan(0);
    expect(fit.sampleCount).toBe(6);
  });
});
