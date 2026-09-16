import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InvalidQuantizationPolicyError,
  type ParameterQuantizationPolicies,
  quantizeBySignificantFigures,
  quantizeByStep,
  quantizeParameter,
  quantizeValue,
  UnregisteredQuantizationPolicyError,
} from "../experiments/tapes/quantize.ts";

describe("tapes.quantize: Per-Parameter Quantization and Donor Defect Regression (am-rt-control-tapes-0gc)", () => {
  it("preserves declared precision across extreme SI magnitudes", () => {
    // 1.35e-3 Pa*s (Einstein's printed suspension viscosity) at 3 significant figures
    assert.equal(quantizeBySignificantFigures(1.35e-3, 3), 0.00135);

    // 5e-7 m (a Brownian tracer radius) at 1 significant figure
    assert.equal(quantizeBySignificantFigures(5e-7, 1), 5e-7);

    // 4.2944e-13 m^2/s (a diffusivity) at 5 significant figures
    assert.equal(quantizeBySignificantFigures(4.2944e-13, 5), 4.2944e-13);

    // Exactly zero remains zero
    assert.equal(quantizeBySignificantFigures(0, 3), 0);
  });

  it("proves the donor's blanket 6-decimal quantization destroyed small values", () => {
    const donorSixDecimal = (v: number) => Math.round(v * 1e6) / 1e6;

    // 5e-7 m rounded to 1e-6 (a 100% error) under donor's quantizeFloat
    assert.equal(donorSixDecimal(5e-7), 1e-6);
    assert.notEqual(donorSixDecimal(5e-7), 5e-7);

    // This module's declared-precision quantization does not have that defect
    assert.equal(quantizeBySignificantFigures(5e-7, 1), 5e-7);
  });

  it("quantizes by fixed step policy", () => {
    assert.ok(Math.abs(quantizeByStep(1.23, 0.1) - 1.2) < 1e-10);
    assert.ok(Math.abs(quantizeByStep(1.27, 0.1) - 1.3) < 1e-10);
    assert.equal(quantizeByStep(0, 0.1), 0);
  });

  it("quantizeValue validates policy kinds and values", () => {
    assert.ok(Math.abs(quantizeValue(1.27, { kind: "step", step: 0.1 }) - 1.3) < 1e-10);
    assert.equal(quantizeValue(1.35e-3, { kind: "significant-figures", digits: 3 }), 0.00135);

    assert.throws(
      () => quantizeValue(1, { kind: "step", step: 0 }),
      InvalidQuantizationPolicyError,
    );
    assert.throws(
      () => quantizeValue(1, { kind: "step", step: -1 }),
      InvalidQuantizationPolicyError,
    );
    assert.throws(
      () => quantizeValue(1, { kind: "significant-figures", digits: 0 }),
      InvalidQuantizationPolicyError,
    );
  });

  it("quantizeParameter refuses unregistered parameters rather than guessing a precision", () => {
    const policies: ParameterQuantizationPolicies = {
      viscosity: { kind: "significant-figures", digits: 3 },
      particleRadius: { kind: "significant-figures", digits: 1 },
    };

    assert.equal(quantizeParameter("viscosity", 1.35e-3, policies), 0.00135);
    assert.equal(quantizeParameter("particleRadius", 5e-7, policies), 5e-7);
    assert.throws(
      () => quantizeParameter("unknownParam", 123.45, policies),
      UnregisteredQuantizationPolicyError,
    );
  });
});
