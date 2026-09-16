import { describe, expect, test } from "bun:test";
import {
  InvalidQuantizationPolicyError,
  type ParameterQuantizationPolicies,
  quantizeBySignificantFigures,
  quantizeByStep,
  quantizeParameter,
  quantizeValue,
  UnregisteredQuantizationPolicyError,
} from "./quantize.ts";

describe("quantizeBySignificantFigures preserves the three declared-precision SI examples", () => {
  test("1.35e-3 Pa*s (Einstein's printed suspension viscosity) at 3 significant figures", () => {
    expect(quantizeBySignificantFigures(1.35e-3, 3)).toBe(0.00135);
  });
  test("5e-7 m (a Brownian tracer radius) at 1 significant figure", () => {
    expect(quantizeBySignificantFigures(5e-7, 1)).toBe(5e-7);
  });
  test("4.2944e-13 m^2/s (a diffusivity) at 5 significant figures", () => {
    expect(quantizeBySignificantFigures(4.2944e-13, 5)).toBe(4.2944e-13);
  });
  test("exactly zero stays exactly zero", () => {
    expect(quantizeBySignificantFigures(0, 3)).toBe(0);
  });
  test("a nonfinite value passes through unchanged", () => {
    expect(Number.isNaN(quantizeBySignificantFigures(Number.NaN, 3))).toBe(true);
    expect(quantizeBySignificantFigures(Number.POSITIVE_INFINITY, 3)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("documenting the donor defect this module replaces", () => {
  test("a blanket 6-decimal-place round (the donor's quantizeFloat) corrupts a value below 1e-6", () => {
    const donorSixDecimal = (v: number) => Math.round(v * 1e6) / 1e6;
    // 5e-7 m rounds to 1e-6 under a blanket 6-decimal quantum: a 100% error, not a rounding nuance.
    expect(donorSixDecimal(5e-7)).toBe(1e-6);
    expect(donorSixDecimal(5e-7)).not.toBe(5e-7);
    // This module's declared-precision quantization does not have that defect.
    expect(quantizeBySignificantFigures(5e-7, 1)).toBe(5e-7);
  });
});

describe("quantizeByStep", () => {
  test("rounds to the nearest declared step", () => {
    expect(quantizeByStep(1.23, 0.1)).toBeCloseTo(1.2, 10);
    expect(quantizeByStep(1.27, 0.1)).toBeCloseTo(1.3, 10);
  });
  test("exactly zero stays exactly zero", () => {
    expect(quantizeByStep(0, 0.1)).toBe(0);
  });
});

describe("quantizeValue dispatches by policy kind", () => {
  test("step policy", () => {
    expect(quantizeValue(1.27, { kind: "step", step: 0.1 })).toBeCloseTo(1.3, 10);
  });
  test("significant-figures policy", () => {
    expect(quantizeValue(1.35e-3, { kind: "significant-figures", digits: 3 })).toBe(0.00135);
  });
  test("rejects an invalid step policy", () => {
    expect(() => quantizeValue(1, { kind: "step", step: 0 })).toThrow(
      InvalidQuantizationPolicyError,
    );
    expect(() => quantizeValue(1, { kind: "step", step: -1 })).toThrow(
      InvalidQuantizationPolicyError,
    );
    expect(() => quantizeValue(1, { kind: "step", step: Number.NaN })).toThrow(
      InvalidQuantizationPolicyError,
    );
  });
  test("rejects an invalid significant-figures policy", () => {
    expect(() => quantizeValue(1, { kind: "significant-figures", digits: 0 })).toThrow(
      InvalidQuantizationPolicyError,
    );
    expect(() => quantizeValue(1, { kind: "significant-figures", digits: 1.5 })).toThrow(
      InvalidQuantizationPolicyError,
    );
  });
});

describe("quantizeParameter refuses an unregistered parameter rather than guessing a precision", () => {
  const policies: ParameterQuantizationPolicies = {
    viscosity: { kind: "significant-figures", digits: 3 },
    radius: { kind: "significant-figures", digits: 1 },
  };
  test("quantizes a registered parameter by its declared policy", () => {
    expect(quantizeParameter("viscosity", 1.35e-3, policies)).toBe(0.00135);
    expect(quantizeParameter("radius", 5e-7, policies)).toBe(5e-7);
  });
  test("throws for an unregistered parameter instead of falling back to a blanket precision", () => {
    expect(() => quantizeParameter("temperature", 290.15, policies)).toThrow(
      UnregisteredQuantizationPolicyError,
    );
  });
});
