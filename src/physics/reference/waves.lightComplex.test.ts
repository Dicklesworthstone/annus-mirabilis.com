import { describe, expect, test } from "bun:test";
import { gamma } from "./kinematics.ts";
import { logWaves } from "./waves.log.ts";
import {
  dopplerFactor,
  lightComplexFactors,
  lightComplexMaterialContractionCountermodel,
  lightComplexVolumeNumeric,
} from "./waves.ts";

describe("am-ref-waves-r53: waves.lightComplex.test.ts", () => {
  test("four light-complex fixture rows at beta = 0.6 and countermodel comparison", () => {
    const t0 = performance.now();
    const beta = 0.6;
    const g = (gamma(beta) as { status: "value"; value: number }).value;
    expect(g).toBeCloseTo(1.25, 12);

    // Row 1: Longitudinal ray in K (theta = 0): q = 0.5, q^2 = 0.25, 1/q = 2, total 0.5
    const lc0 = lightComplexFactors(beta, 0);
    expect(lc0.amplitudeFactor).toBeCloseTo(0.5, 12);
    expect(lc0.energyDensityFactor).toBeCloseTo(0.25, 12);
    expect(lc0.volumeFactor).toBeCloseTo(2.0, 12);
    expect(lc0.energyFactor).toBeCloseTo(0.5, 12);

    const cm0 = lightComplexMaterialContractionCountermodel(beta, 0);
    expect(cm0.modelId).toBe("countermodel-material-contraction");
    expect(cm0.factor).toBeCloseTo(0.8, 12); // Material contraction 1/gamma = 0.8
    expect(cm0.volumeFactor).toBeCloseTo(0.8, 12);
    expect(Math.abs(lc0.energyFactor - cm0.factor)).toBeCloseTo(0.3, 12); // Fails countermodel (0.5 vs 0.8)

    // Row 2: Opposite ray in K (theta = pi): q = 2.0, q^2 = 4, 1/q = 0.5, total 2.0
    const lcPi = lightComplexFactors(beta, Math.PI);
    expect(lcPi.amplitudeFactor).toBeCloseTo(2.0, 12);
    expect(lcPi.energyDensityFactor).toBeCloseTo(4.0, 12);
    expect(lcPi.volumeFactor).toBeCloseTo(0.5, 12);
    expect(lcPi.energyFactor).toBeCloseTo(2.0, 12);

    const cmPi = lightComplexMaterialContractionCountermodel(beta, Math.PI);
    expect(cmPi.factor).toBeCloseTo(0.8, 12); // Material contraction 1/gamma = 0.8
    expect(cmPi.volumeFactor).toBeCloseTo(0.8, 12);
    expect(Math.abs(lcPi.energyFactor - cmPi.factor)).toBeCloseTo(1.2, 12); // Fails countermodel (2.0 vs 0.8)

    // Row 3: Ray transverse in moving frame k (cos theta = beta = 0.6): q = 1/gamma = 0.8, q^2 = 0.64, 1/q = 1.25, total 0.8
    const thetaTransversePrime = Math.acos(beta);
    const lcTP = lightComplexFactors(beta, thetaTransversePrime);
    expect(lcTP.amplitudeFactor).toBeCloseTo(0.8, 12);
    expect(lcTP.energyDensityFactor).toBeCloseTo(0.64, 12);
    expect(lcTP.volumeFactor).toBeCloseTo(1.25, 12);
    expect(lcTP.energyFactor).toBeCloseTo(0.8, 12);

    const cmTP = lightComplexMaterialContractionCountermodel(beta, thetaTransversePrime);
    expect(cmTP.factor).toBeCloseTo(0.8, 12); // Material contraction 1/gamma = 0.8
    expect(cmTP.volumeFactor).toBeCloseTo(0.8, 12);
    // Degenerate coincidence check: both physical light complex and material contraction give 0.8
    expect(lcTP.energyFactor).toBeCloseTo(cmTP.factor, 12);

    // Row 4: Ray transverse in stationary frame K (theta = 90 deg = pi/2): q = gamma = 1.25, q^2 = 1.5625, 1/q = 0.8, total 1.25
    const lc90 = lightComplexFactors(beta, Math.PI / 2);
    expect(lc90.amplitudeFactor).toBeCloseTo(1.25, 12);
    expect(lc90.energyDensityFactor).toBeCloseTo(1.5625, 12);
    expect(lc90.volumeFactor).toBeCloseTo(0.8, 12);
    expect(lc90.energyFactor).toBeCloseTo(1.25, 12);

    const cm90 = lightComplexMaterialContractionCountermodel(beta, Math.PI / 2);
    expect(cm90.factor).toBeCloseTo(0.8, 12); // Material contraction 1/gamma = 0.8
    expect(cm90.volumeFactor).toBeCloseTo(0.8, 12);
    // Discriminating case: physical light factor is gamma = 1.25, material contraction is 1/gamma = 0.8 (ratio gamma^2 = 1.5625)
    expect(lc90.energyFactor / cm90.factor).toBeCloseTo(1.5625, 12);

    logWaves({
      testId: "light-complex-four-fixture-rows",
      beta,
      resultStatus: "value",
      expected: 0.8,
      actual: cm90.factor,
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Four fixture rows pass: countermodel fails at theta=0 (0.8 vs 0.5), theta=pi (0.8 vs 2.0); cos theta=beta degenerately coincides at 0.8; 90 deg discriminates gamma=1.25 vs 1/gamma=0.8.",
    });
  });

  test("numerical volume calculation agrees with exact 1/q across sweep", () => {
    const t0 = performance.now();
    const testBetas = [0.1, 0.4, 0.6, 0.8, 0.9];
    const testAngles = [0, 0.3, Math.PI / 3, Math.PI / 2, 2.4, Math.PI];

    for (const beta of testBetas) {
      for (const theta of testAngles) {
        const exactVolume = lightComplexFactors(beta, theta).volumeFactor;
        const numVolume = lightComplexVolumeNumeric(beta, theta);
        expect(numVolume).toBeCloseTo(exactVolume, 12);
      }
    }

    logWaves({
      testId: "light-complex-volume-numerical-agreement",
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Numerical simultaneous-slice volume agrees with exact 1/q within 1e-12.",
    });
  });

  test("energy ratio identically equals Doppler ratio for 500 seeded parameters", () => {
    const t0 = performance.now();
    let seed = 19050927; // historical seed

    for (let i = 0; i < 500; i++) {
      // Linear congruential generator (deterministic pseudorandom)
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const beta = ((seed % 10000) / 10000) * 1.9 - 0.95; // beta in (-0.95, 0.95)

      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const theta = ((seed % 10000) / 10000) * Math.PI; // theta in (0, pi)

      const ef = lightComplexFactors(beta, theta).energyFactor;
      const df = dopplerFactor(beta, theta);

      expect(Math.abs(ef - df)).toBeLessThan(1e-12);
    }

    // Explicit boundary edge cases: near 0, near pi, near 0.95
    for (const nearTheta of [1e-6, Math.PI - 1e-6]) {
      for (const nearBeta of [-0.95, 0, 0.95]) {
        const ef = lightComplexFactors(nearBeta, nearTheta).energyFactor;
        const df = dopplerFactor(nearBeta, nearTheta);
        expect(Math.abs(ef - df)).toBeLessThan(1e-12);
      }
    }

    logWaves({
      testId: "energy-ratio-equals-doppler-ratio-500-sweep",
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Energy ratio identically equals Doppler factor within 1e-12 across 500 seeded parameters.",
    });
  });
});
