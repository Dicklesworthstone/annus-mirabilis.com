import { describe, expect, test } from "bun:test";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  entropyWithUnfixedConstant,
  wienSpectralEntropyDensity,
} from "../../physics/reference/radiation.ts";
import { type ToleranceSpec, withinTolerance } from "../../units/tolerance.ts";
import { LQ04_DEFAULTS, type Lq04Parameters } from "./definition.ts";
import { evaluateLq04 } from "./session.ts";

const RELATIVE: ToleranceSpec = { relative: 1e-6 };

function withRatio(ratio: number): Lq04Parameters {
  return { ...LQ04_DEFAULTS, volumeRatio: ratio };
}

function assertClose(actual: number, expected: number, tolerance: ToleranceSpec = RELATIVE): void {
  const outcome = withinTolerance(actual, expected, tolerance);
  expect(outcome.ok).toBe(true);
}

describe("LQ-04 modern golden scenario (am-lq-04-entropy-workbench-senj)", () => {
  test("the reference state (V/V0 = 1) matches the bead's printed values", () => {
    const evaluation = evaluateLq04(withRatio(1));
    if (evaluation.status !== "value") throw new Error("expected a value, got a refusal");

    assertClose(evaluation.energy, 9.055615e-9, { relative: 1e-5 });
    assertClose(evaluation.initialX, 9.598486, { relative: 1e-5 });
    assertClose(evaluation.finalX, 9.598486, { relative: 1e-5 });
    assertClose(evaluation.effectiveIndependentCount, 2.277774e10, { relative: 1e-5 });
    assertClose(evaluation.radiationEntropy, 0, { absolute: 1e-20 });
  });

  test("halving the volume matches the bead's golden state exactly", () => {
    const evaluation = evaluateLq04(withRatio(0.5));
    if (evaluation.status !== "value") throw new Error("expected a value, got a refusal");

    assertClose(evaluation.finalX, 8.905339, { relative: 1e-5 });
    assertClose(evaluation.finalTemperature, 3233.505, { relative: 1e-5 });
    assertClose(evaluation.radiationEntropy, -2.179814e-13, { relative: 1e-5 });
  });

  test("doubling the volume matches the bead's golden state exactly", () => {
    const evaluation = evaluateLq04(withRatio(2));
    if (evaluation.status !== "value") throw new Error("expected a value, got a refusal");

    assertClose(evaluation.finalX, 10.291633, { relative: 1e-5 });
    assertClose(evaluation.finalTemperature, 2797.948, { relative: 1e-5 });
    assertClose(evaluation.radiationEntropy, 2.179814e-13, { relative: 1e-5 });
  });

  test("a 100x compression stays inside the dilute domain at 1% tolerance", () => {
    const evaluation = evaluateLq04(withRatio(1e-2));
    if (evaluation.status !== "value") throw new Error("expected a value, got a refusal");

    assertClose(evaluation.finalX, 4.993316, { relative: 1e-5 });
    assertClose(evaluation.radiationEntropy, -1.448237e-12, { relative: 1e-5 });
    expect(evaluation.finalDilute).toBe(true);
  });

  test("a 10000x compression is refused as outside the Wien domain, not silently computed", () => {
    const evaluation = evaluateLq04(withRatio(1e-4));
    expect(evaluation.status).toBe("outside-domain");
    if (evaluation.status !== "outside-domain") return;
    expect(evaluation.reason).toMatch(/wien/i);
  });

  test("the closed form and the numerical S(V) - S(V0) difference agree", () => {
    for (const ratio of [0.5, 1, 2, 1e-2]) {
      const evaluation = evaluateLq04(withRatio(ratio));
      if (evaluation.status !== "value") throw new Error("expected a value, got a refusal");
      // At ratio = 1 both sides are exactly zero; a relative-only tolerance is undefined against
      // a true-zero reference (src/units/tolerance.ts's own "relative-only-at-zero" rule), so this
      // needs an absolute component too.
      assertClose(evaluation.radiationEntropyNumeric, evaluation.radiationEntropy, {
        relative: 1e-6,
        absolute: 1e-20,
      });
    }
  });

  test("the owner's field currently labeled effectiveIndependentCount is really the entropy-volume coefficient (kB times the true count), not the dimensionless count", () => {
    const evaluation = evaluateLq04(withRatio(0.5));
    if (evaluation.status !== "value") throw new Error("expected a value, got a refusal");
    const set = getConstantSet("modern-si-2019");
    const kB = constantValue(set, "boltzmannConstant").value;
    assertClose(evaluation.entropyVolumeCoefficient, kB * evaluation.effectiveIndependentCount, {
      relative: 1e-9,
    });
    // The two are separate outputs with different dimensions; neither should be mistaken for the other.
    expect(evaluation.entropyVolumeCoefficient).not.toBeCloseTo(evaluation.effectiveIndependentCount);
  });
});

describe("LQ-04 identity: the owner's derivative d(s_nu)/d(rho_nu) equals 1/T", () => {
  test("finite-difference derivative of wienSpectralEntropyDensity at rho0 matches 1/T0", () => {
    const set = getConstantSet("modern-si-2019");
    const { frequency, referenceTemperature } = LQ04_DEFAULTS;
    const evaluation = evaluateLq04(LQ04_DEFAULTS);
    if (evaluation.status !== "value") throw new Error("expected a value, got a refusal");

    const rho0Value =
      evaluation.energy / (LQ04_DEFAULTS.referenceVolume * LQ04_DEFAULTS.bandwidth);
    const h = rho0Value * 1e-6;
    const sPlus = wienSpectralEntropyDensity(rho0Value + h, frequency, set);
    const sMinus = wienSpectralEntropyDensity(rho0Value - h, frequency, set);
    if (sPlus.status !== "value" || sMinus.status !== "value") {
      throw new Error("expected finite entropy densities near rho0");
    }
    const derivative = (sPlus.value - sMinus.value) / (2 * h);
    assertClose(derivative, 1 / referenceTemperature, { relative: 1e-4 });
  });

  test("s_nu(rho) tends to 0 as rho tends to 0+", () => {
    const set = getConstantSet("modern-si-2019");
    const result = wienSpectralEntropyDensity(0, LQ04_DEFAULTS.frequency, set);
    expect(result.status).toBe("analytic-limit");
    if (result.status === "analytic-limit") {
      expect(result.value).toBe(0);
    }
  });
});

describe("LQ-04 adversarial fixture: an arbitrary entropy-density constant must not cancel (plan §13.5)", () => {
  test("a nonzero illustrative C(nu) breaks the volume law, and only the zero-density condition fixes C = 0", () => {
    const set = getConstantSet("modern-si-2019");
    const evaluation = evaluateLq04(withRatio(0.5));
    if (evaluation.status !== "value") throw new Error("expected a value, got a refusal");

    const C = 1.0e-15;
    const withC = entropyWithUnfixedConstant(
      {
        E: evaluation.energy,
        nu: LQ04_DEFAULTS.frequency,
        dNu: LQ04_DEFAULTS.bandwidth,
        V: evaluation.volume,
        V0: LQ04_DEFAULTS.referenceVolume,
        C,
      },
      set,
    );

    assertClose(withC.extraTerm, -5.0e-7, { relative: 1e-6 });
    // The extra term dwarfs the true Delta S; retaining C does not reproduce the volume law.
    // (toBeCloseTo is an absolute-difference matcher and both values are far below its
    // precision floor, so the disagreement is asserted directly as a relative magnitude check.)
    expect(Math.abs(withC.extraTerm)).toBeGreaterThan(Math.abs(evaluation.radiationEntropy) * 1000);
    const relativeDisagreement =
      Math.abs(withC.deltaSWithC - evaluation.radiationEntropy) /
      Math.abs(evaluation.radiationEntropy);
    expect(relativeDisagreement).toBeGreaterThan(100);
    expect(withC.historicalStatus).toBe("adversarial-derivation-variant");

    // C = 0 (the true derivation) reproduces the closed-form Delta S exactly.
    const withZeroC = entropyWithUnfixedConstant(
      {
        E: evaluation.energy,
        nu: LQ04_DEFAULTS.frequency,
        dNu: LQ04_DEFAULTS.bandwidth,
        V: evaluation.volume,
        V0: LQ04_DEFAULTS.referenceVolume,
        C: 0,
      },
      set,
    );
    assertClose(withZeroC.deltaSWithC, evaluation.radiationEntropy, { relative: 1e-9 });
  });

  test("the session's own C(nu) panel surfaces the same non-cancellation when enabled", () => {
    const evaluation = evaluateLq04({
      ...LQ04_DEFAULTS,
      volumeRatio: 0.5,
      showUnfixedConstantPanel: true,
      illustrativeC: 1.0e-15,
    });
    if (evaluation.status !== "value") throw new Error("expected a value, got a refusal");
    expect(evaluation.unfixedConstant.shown).toBe(true);
    expect(evaluation.unfixedConstant.extraTerm).not.toBeNull();
    assertClose(evaluation.unfixedConstant.extraTerm ?? Number.NaN, -5.0e-7, { relative: 1e-6 });
  });
});

describe("LQ-04 command-class invariance: a volume change never moves E, nu, or dNu", () => {
  test("only volumeRatio differs between two evaluations at different ratios", () => {
    const before = { ...LQ04_DEFAULTS, volumeRatio: 1 };
    const after = { ...LQ04_DEFAULTS, volumeRatio: 2 };
    const evalBefore = evaluateLq04(before);
    const evalAfter = evaluateLq04(after);
    if (evalBefore.status !== "value" || evalAfter.status !== "value") {
      throw new Error("expected values, got refusals");
    }
    // The fixed energy is a function of frequency, reference volume, and reference temperature
    // only; it must be identical before and after a pure volume-ratio change.
    expect(evalAfter.energy).toBe(evalBefore.energy);
  });
});

describe("LQ-04 historical constant set (scope note)", () => {
  test("einstein-1905-light-quanta-printed is not yet a registered constant set", () => {
    expect(() => getConstantSet("einstein-1905-light-quanta-printed")).toThrow(
      /not verified and registered/,
    );
  });
});
