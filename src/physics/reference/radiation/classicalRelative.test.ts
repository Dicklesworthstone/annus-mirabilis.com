import { describe, expect, test } from "bun:test";
import {
  type ClassicalRelativeResult,
  classicalCutoffGrowth,
  classicalRelativeEnergy,
  classicalShareAboveProbe,
} from "./classicalRelative.ts";

function number(result: ClassicalRelativeResult): number {
  expect(result.status).toBe("value");
  if (result.status !== "value") throw new Error(result.reason);
  return result.value;
}

/** Simpson's rule integrates this quadratic exactly, independently of the owner's cube formula. */
function energyIntegral(T: number, low: number, high: number): number {
  const midpoint = (low + high) / 2;
  return ((high - low) / 6) * T * (low * low + 4 * midpoint * midpoint + high * high);
}

describe("classical relative allocation without a numeric coefficient", () => {
  test("cutoff and temperature comparisons agree with an independent integral", () => {
    for (const [T, cutoff] of [
      [2, 2],
      [0.5, 4],
      [3, 0.25],
    ] as const) {
      const expected = energyIntegral(T, 0, cutoff) / energyIntegral(1, 0, 1);
      expect(number(classicalRelativeEnergy(T, cutoff, 1, 1))).toBeCloseTo(expected, 12);
    }
    expect(number(classicalCutoffGrowth(10))).toBe(1000);
    expect(number(classicalCutoffGrowth(2))).toBe(8);
    expect(number(classicalRelativeEnergy(3000, 1e14, 1500, 1e14))).toBe(2);
  });

  test("shares agree with band integration, including the full endpoint", () => {
    for (const probe of [0.1, 0.5, 0.9, 1]) {
      const expected = energyIntegral(1, probe, 1) / energyIntegral(1, 0, 1);
      expect(number(classicalShareAboveProbe(1, probe))).toBeCloseTo(expected, 14);
    }
    expect(number(classicalShareAboveProbe(1e14, 5e13))).toBe(7 / 8);
    expect(number(classicalShareAboveProbe(1e14, 1e14))).toBe(0);
  });

  test("relative calculation survives frequencies whose absolute cube overflows", () => {
    expect(number(classicalRelativeEnergy(1500, 1e200, 1500, 1e199))).toBeCloseTo(1000, 10);
    expect(number(classicalRelativeEnergy(1e300, 1e-200, 1e-300, 1))).toBeCloseTo(1, 11);
    const nearCutoff = number(classicalShareAboveProbe(1, 1 - Number.EPSILON));
    expect(nearCutoff).toBeGreaterThan(0);
    expect(nearCutoff).toBeCloseTo(3 * Number.EPSILON, 28);
  });

  test("out-of-range ratios remain a numerical refusal, never infinity or a false zero", () => {
    for (const result of [
      classicalRelativeEnergy(1, 1e300, 1, 1),
      classicalRelativeEnergy(1, 1e-300, 1, 1),
    ]) {
      expect(result.status).toBe("outside-domain");
      if (result.status === "outside-domain") expect(result.domainKind).toBe("numerical");
    }
  });

  test("nonpositive, nonfinite and reversed inputs are refused without clamping", () => {
    for (const input of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(classicalRelativeEnergy(input, 1, 1, 1).status).toBe("outside-domain");
      expect(classicalRelativeEnergy(1, input, 1, 1).status).toBe("outside-domain");
      expect(classicalRelativeEnergy(1, 1, input, 1).status).toBe("outside-domain");
      expect(classicalRelativeEnergy(1, 1, 1, input).status).toBe("outside-domain");
      expect(classicalCutoffGrowth(input).status).toBe("outside-domain");
      expect(classicalShareAboveProbe(input, 1).status).toBe("outside-domain");
      expect(classicalShareAboveProbe(1, input).status).toBe("outside-domain");
    }
    const outside = classicalShareAboveProbe(1, 2);
    expect(outside.status).toBe("outside-domain");
    if (outside.status === "outside-domain") expect(outside.condition).toBe("probe-above-cutoff");
  });
});
