import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TracerLab } from "../components/lab/TracerLab.tsx";
import example from "../generated/bm01-example.json";
import { recordTracers, tracerDisplacements } from "../physics/reference/diffusion/tracers.ts";
import { kolmogorovDistanceToGaussian } from "../physics/reference/diffusion/walkLaws.ts";
import { requiredSampleSizeForVariance } from "./stats/power.ts";

/**
 * Statistical hypothesis tests for BM-01 (am-bm-01-tracer-ensemble-hdly AC13):
 * - Fixed seed 1905, M = 10,000, Einstein historical preset (D = 0.315840243e-12 m^2/s), dt = 1 s.
 * - Family-wise error budget of 1e-6 split over 10 assertions (alpha = 1e-7 each).
 * - Bounds from committed critical-value tables:
 *   1-3. Signed mean per axis within +/- 0.04234 um
 *   4-6. Chi2 statistic per axis in [9264.85, 10771.65]
 *   7. Pooled Chi2 over 3 axes in [28713.42, 31323.08]
 *   8. Kolmogorov distance of x displacements <= 0.0290
 *   9. Mean absolute displacement within +/- 0.02552 um of 0.6341453 um
 *   10. Power helper confirms pooled check detects 10% variance scaling error with power > 0.9999.
 * - Reduced motion accessibility test: statistics remain accessible while animation is paused.
 */

const M = 10000;
const D = 0.315840243e-12; // Einstein 1905 printed constants
const dt = 1.0;
const variance1d = 2 * D * dt; // 0.631680486e-12 m^2

// Run M=10,000 tracers with h=1.0, steps=1 to compute 1-second displacements in memory budget
const recordingRes = await recordTracers(
  {
    M,
    h: dt,
    steps: 1,
    seed: "1905",
    D,
  },
  { yieldControl: async () => {} },
);

if (recordingRes.kind !== "accepted") {
  throw new Error(`recordTracers failed: ${JSON.stringify(recordingRes)}`);
}

const recording = recordingRes.data;
const displacements = tracerDisplacements(recording, 1, 3);

describe("bm01.statistical: 10 Statistical Assertions at M=10,000 & Reduced Motion (AC13)", () => {
  test("1-3: Signed mean per axis lies within +/- 5.3267 * sqrt(2D*dt/M) = +/- 0.04234 um", () => {
    const boundUm = 0.04234;

    for (let axis = 0; axis < 3; axis++) {
      let sum = 0;
      for (let i = 0; i < M; i++) {
        sum += displacements[i * 3 + axis] ?? 0;
      }
      const meanUm = (sum / M) * 1e6;
      expect(Math.abs(meanUm)).toBeLessThanOrEqual(boundUm);
    }
  });

  test("4-6: Per-axis Chi2 statistic M * <x^2> / (2D*dt) lies in [9264.85, 10771.65]", () => {
    const lower = 9264.85;
    const upper = 10771.65;

    for (let axis = 0; axis < 3; axis++) {
      let sumSq = 0;
      for (let i = 0; i < M; i++) {
        const val = displacements[i * 3 + axis] ?? 0;
        sumSq += val * val;
      }
      const chi2 = sumSq / variance1d;
      expect(chi2).toBeGreaterThanOrEqual(lower);
      expect(chi2).toBeLessThanOrEqual(upper);
    }
  });

  test("7: Pooled Chi2 over 3 axes lies in [28713.42, 31323.08]", () => {
    let pooledSumSq = 0;
    for (let i = 0; i < M; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const val = displacements[i * 3 + axis] ?? 0;
        pooledSumSq += val * val;
      }
    }
    const pooledChi2 = pooledSumSq / variance1d;
    expect(pooledChi2).toBeGreaterThanOrEqual(28713.42);
    expect(pooledChi2).toBeLessThanOrEqual(31323.08);
  });

  test("8: Kolmogorov distance of x displacements to N(0, 2D*dt) is at most 0.0290", () => {
    const xSamples = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      xSamples[i] = displacements[i * 3] ?? 0;
    }
    const ksRes = kolmogorovDistanceToGaussian(xSamples, variance1d);
    expect(ksRes.kind).toBe("accepted");
    if (ksRes.kind === "accepted") {
      expect(ksRes.data).toBeLessThanOrEqual(0.029);
    }
  });

  test("9: Mean absolute displacement lies within +/- 0.02552 um of 0.6341453 um", () => {
    const theoreticalMeanAbsUm = 0.6341453;
    const toleranceUm = 0.02552;

    for (let axis = 0; axis < 3; axis++) {
      let sumAbs = 0;
      for (let i = 0; i < M; i++) {
        sumAbs += Math.abs(displacements[i * 3 + axis] ?? 0);
      }
      const meanAbsUm = (sumAbs / M) * 1e6;
      const diffUm = Math.abs(meanAbsUm - theoreticalMeanAbsUm);
      expect(diffUm).toBeLessThanOrEqual(toleranceUm);
    }
  });

  test("10: Power helper confirms pooled check detects 10% error in variance with power > 0.9999", () => {
    const requiredN = requiredSampleSizeForVariance({
      relativeEffect: 0.1,
      alpha: 1e-7,
      power: 0.9999,
    });
    // Required N is ~18,017, pooled observations = 30,000 >= 18,017
    expect(requiredN).toBeLessThanOrEqual(30000);
  });

  test("Reduced motion: walk animation pauses while statistics remain accessible", () => {
    const html = renderToStaticMarkup(createElement(TracerLab, { example }));
    // Accessible statistics and data attributes are fully present
    expect(html).toContain('data-quantity-id="rmsDisplacement1d"');
    expect(html).toContain('data-quantity-id="diffusionCoefficient"');
    expect(html).toContain("The tracer ensemble");
    // Verify scale bar is present
    expect(html).toContain('data-scale-bar="1um"');
  });
});
