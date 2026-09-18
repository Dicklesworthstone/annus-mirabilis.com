import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import { logWaves } from "./waves.log.ts";
import { secondOrderShift } from "./waves.ts";

/**
 * High-precision Taylor expansion reference for gamma - 1.
 * For beta in [1e-6, 0.1], 5 terms provide >14 digits of precision:
 * gamma - 1 = (1/2)*b^2 + (3/8)*b^4 + (5/16)*b^6 + (35/128)*b^8 + (63/256)*b^10 + O(b^12)
 */
function highPrecisionGammaMinusOneRef(beta: number): number {
  const b2 = beta * beta;
  const t1 = 0.5 * b2;
  const t2 = (3 / 8) * b2 * b2;
  const t3 = (5 / 16) * b2 ** 3;
  const t4 = (35 / 128) * b2 ** 4;
  const t5 = (63 / 256) * b2 ** 5;
  const t6 = (231 / 1024) * b2 ** 6;
  const t7 = (429 / 2048) * b2 ** 7;
  return t1 + t2 + t3 + t4 + t5 + t6 + t7;
}

describe("am-ref-waves-r53: waves.secondOrder.test.ts", () => {
  test("secondOrderShift(0.005) gives 1.25002e-5", () => {
    const t0 = performance.now();
    const beta = 0.005;
    const shift = secondOrderShift(beta);

    expect(shift).toBeCloseTo(1.250023438e-5, 12);
    expect(Number(shift.toExponential(5))).toBeCloseTo(1.25002e-5, 10);

    const ref = highPrecisionGammaMinusOneRef(beta);
    const verdict = withinTolerance(shift, ref, { relative: 1e-12 });
    expect(verdict.ok).toBe(true);

    logWaves({
      testId: "second-order-shift-0.005-fixture",
      beta,
      resultStatus: "value",
      expected: 1.250023438e-5,
      actual: shift,
      tolerance: 1e-12,
      comparisonKind: "relative",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "secondOrderShift(0.005) gives 1.25002e-5 and matches high-precision reference within 1e-12.",
    });
  });

  test("secondOrderShift matches high-precision reference within 1e-12 relative across beta in [1e-6, 0.1]", () => {
    const t0 = performance.now();
    const testBetas = [
      1e-6, 2.5e-6, 1e-5, 5e-5, 1e-4, 5e-4, 1e-3, 0.005, 0.01, 0.03, 0.05, 0.08, 0.1,
    ];

    for (const beta of testBetas) {
      const shift = secondOrderShift(beta);
      const ref = highPrecisionGammaMinusOneRef(beta);

      const verdict = withinTolerance(shift, ref, { relative: 1e-12 });
      expect(verdict.ok).toBe(true);
    }

    logWaves({
      testId: "second-order-shift-high-precision-sweep",
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "relative",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "secondOrderShift matches 10th-order reference within 1e-12 relative for beta in [1e-6, 0.1].",
    });
  });

  test("Contrast with naive formula: catastrophic floating point cancellation is avoided", () => {
    const t0 = performance.now();
    const tinyBeta = 1e-6; // beta^2 = 1e-12

    // Naive formula: 1 / sqrt(1 - beta^2) - 1
    const naive = 1 / Math.sqrt(1 - tinyBeta * tinyBeta) - 1;
    const stable = secondOrderShift(tinyBeta);
    const ref = highPrecisionGammaMinusOneRef(tinyBeta);

    // Stable form matches reference to 1e-12 relative
    const stableVerdict = withinTolerance(stable, ref, { relative: 1e-12 });
    expect(stableVerdict.ok).toBe(true);

    // In double precision, 1 - 1e-12 loses digits: naive formula fails 1e-12 tolerance
    const naiveVerdict = withinTolerance(naive, ref, { relative: 1e-12 });
    expect(naiveVerdict.ok).toBe(false);
    expect(naiveVerdict.kind).toBe("outside");
    // The naive relative error is non-zero and worse than machine precision
    expect(stable).toBeCloseTo(0.5e-12, 16);

    logWaves({
      testId: "second-order-shift-cancellation-contrast",
      beta: tinyBeta,
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "relative",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Cancellation-free secondOrderShift preserves precision where naive form loses digits.",
    });
  });
});
