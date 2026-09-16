import { describe, expect, test } from "bun:test";
import { tracerDisplacements } from "../../physics/reference/diffusion/tracers.ts";
import {
  assertCommonRandomNumbers,
  COMPARISON_KIND,
  COMPARISON_LABEL,
  computeViscosityComparison,
} from "./viscosityComparison.ts";

describe("bm01 viscosity comparison: common random numbers (am-bm-01-tracer-ensemble-hdly)", () => {
  test("every position scales by exactly sqrt(eta1/eta2), the preset's 1/sqrt(2) case", async () => {
    const outcome = await computeViscosityComparison({
      T: 290.15,
      a: 5e-7,
      eta1: 0.00135,
      eta2: 0.0027,
      M: 20,
      steps: 30,
      h: 0.02,
      seed: "1905",
    });
    expect(outcome.kind).toBe("accepted");
    if (outcome.kind !== "accepted") return;

    expect(outcome.data.comparisonKind).toBe("common-random-numbers");
    expect(outcome.data.expectedRatio).toBeCloseTo(1 / Math.SQRT2, 12);

    const p1 = tracerDisplacements(outcome.data.recording1, 30, 3);
    const p2 = tracerDisplacements(outcome.data.recording2, 30, 3);
    for (let i = 0; i < p1.length; i++) {
      const x1 = p1[i];
      const x2 = p2[i];
      if (x1 === undefined || x2 === undefined) {
        throw new Error("unreachable: index is within both recordings' shared length.");
      }
      const predicted = x1 * outcome.data.expectedRatio;
      const tolerance = Math.max(1e-18, 1e-10 * Math.abs(x1));
      expect(Math.abs(x2 - predicted)).toBeLessThanOrEqual(tolerance);
    }
  });

  test("a new seed does NOT reproduce the common-random-numbers scaling", async () => {
    const shared = { T: 290.15, a: 5e-7, eta1: 0.00135, eta2: 0.0027, M: 20, steps: 30, h: 0.02 };
    const a = await computeViscosityComparison({ ...shared, seed: "1905" });
    const b = await computeViscosityComparison({ ...shared, seed: "1906" });
    expect(a.kind).toBe("accepted");
    expect(b.kind).toBe("accepted");
    if (a.kind !== "accepted" || b.kind !== "accepted") return;

    const p1a = tracerDisplacements(a.data.recording1, 30, 1);
    const p1b = tracerDisplacements(b.data.recording1, 30, 1);
    // Different seeds draw different raw normals: recording1 (same eta1 in both runs) should
    // differ between seeds, unlike the same-seed eta1-vs-eta2 comparison above.
    let anyDifferent = false;
    for (let i = 0; i < p1a.length; i++) {
      const xa = p1a[i];
      const xb = p1b[i];
      if (xa === undefined || xb === undefined) {
        throw new Error("unreachable: index is within both recordings' shared length.");
      }
      if (Math.abs(xa - xb) > 1e-15) anyDifferent = true;
    }
    expect(anyDifferent).toBe(true);
  });

  test("the label always names common random numbers and never an independent trial", async () => {
    const outcome = await computeViscosityComparison({
      T: 290.15,
      a: 5e-7,
      eta1: 0.00135,
      eta2: 0.0027,
      M: 5,
      steps: 5,
      h: 0.02,
      seed: "1905",
    });
    expect(outcome.kind).toBe("accepted");
    if (outcome.kind !== "accepted") return;
    expect(outcome.data.label).toBe(COMPARISON_LABEL);
    expect(outcome.data.comparisonKind).toBe(COMPARISON_KIND);
    expect(outcome.data.label).not.toMatch(/\bis an independent trial\b/i);
  });

  test("assertCommonRandomNumbers throws if a caller affirmatively calls it an independent trial", () => {
    expect(() => assertCommonRandomNumbers("This is an independent trial.")).toThrow();
    expect(() => assertCommonRandomNumbers(COMPARISON_LABEL)).not.toThrow();
  });
});
