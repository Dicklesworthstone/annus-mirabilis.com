import { describe, expect, test } from "bun:test";
import { gamma } from "../physics/reference/kinematics.ts";
import {
  dopplerFactor,
  evaluateSr10,
  lightComplexFactors,
  lightComplexMaterialContractionCountermodel,
  lightComplexVolumeNumeric,
} from "../physics/reference/waves.ts";

describe("SR-10: The Finite Light Complex (Einstein 1905 §8)", () => {
  test("exact identity E'/E = nu'/nu = A'/A across 500 pseudo-random pairs", () => {
    let seed = 123456789;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 500; i++) {
      const beta = -0.9 + lcg() * 1.8; // range (-0.9, 0.9)
      const phiDeg = lcg() * 360;
      const phiRad = (phiDeg * Math.PI) / 180;

      const evalRes = evaluateSr10({
        beta,
        propagationAngleDeg: phiDeg,
        initialEnergyJ: 10 + lcg() * 50,
        initialVolumeM3: 5 + lcg() * 20,
        initialAmplitude: 2 + lcg() * 10,
      });

      expect(evalRes.status).toBe("value");

      const doppler = dopplerFactor(beta, phiRad);
      const energyRatio = evalRes.transformedEnergyJ / evalRes.initialEnergyJ;
      const amplitudeRatio = evalRes.transformedAmplitude / evalRes.initialAmplitude;

      expect(energyRatio).toBeCloseTo(doppler, 10);
      expect(amplitudeRatio).toBeCloseTo(doppler, 10);
      expect(evalRes.energyFactor).toBeCloseTo(doppler, 10);
    }
  });

  test("independent Jacobian determinant volume check matches 1/q across 500 pseudo-random pairs", () => {
    let seed = 987654321;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 500; i++) {
      const beta = -0.9 + lcg() * 1.8;
      const phiDeg = lcg() * 360;
      const phiRad = (phiDeg * Math.PI) / 180;

      const factors = lightComplexFactors(beta, phiRad);
      const numericVolRatio = lightComplexVolumeNumeric(beta, phiRad);

      expect(factors.volumeFactor).toBeCloseTo(1 / factors.energyFactor, 12);
      expect(numericVolRatio).toBeCloseTo(factors.volumeFactor, 10);
    }
  });

  test("longitudinal receding ray (phi = 0 deg, beta = 0.6): volume doubles, energy halves", () => {
    const res = evaluateSr10({
      beta: 0.6,
      propagationAngleDeg: 0,
      initialEnergyJ: 1.0,
      initialVolumeM3: 1.0,
      initialAmplitude: 1.0,
    });

    expect(res.status).toBe("value");
    expect(res.gamma).toBeCloseTo(1.25, 12);
    expect(res.energyFactor).toBeCloseTo(0.5, 12);
    expect(res.volumeFactor).toBeCloseTo(2.0, 12);
    expect(res.transformedEnergyJ).toBeCloseTo(0.5, 12);
    expect(res.transformedVolumeM3).toBeCloseTo(2.0, 12);

    // Countermodel check:
    // Naive rod contraction: V_rod'/V = 1/gamma = 0.8
    // Naive energy: E_wrong' = q^2 / gamma = 0.25 / 1.25 = 0.20
    expect(res.countermodelEnergyFactor).toBeCloseTo(0.2, 12);
    expect(res.countermodelVolumeFactor).toBeCloseTo(0.8, 12);
    expect(res.countermodelEnergyJ).toBeCloseTo(0.2, 12);
    expect(res.countermodelVolumeM3).toBeCloseTo(0.8, 12);
  });

  test("longitudinal approaching ray (phi = 180 deg, beta = 0.6): volume halves, energy doubles", () => {
    const res = evaluateSr10({
      beta: 0.6,
      propagationAngleDeg: 180,
      initialEnergyJ: 1.0,
      initialVolumeM3: 1.0,
      initialAmplitude: 1.0,
    });

    expect(res.status).toBe("value");
    expect(res.gamma).toBeCloseTo(1.25, 12);
    expect(res.energyFactor).toBeCloseTo(2.0, 12);
    expect(res.volumeFactor).toBeCloseTo(0.5, 12);
    expect(res.transformedEnergyJ).toBeCloseTo(2.0, 12);
    expect(res.transformedVolumeM3).toBeCloseTo(0.5, 12);

    // Countermodel check:
    // Naive energy: q^2 / gamma = 4.0 / 1.25 = 3.20
    expect(res.countermodelEnergyFactor).toBeCloseTo(3.2, 12);
    expect(res.countermodelVolumeFactor).toBeCloseTo(0.8, 12);
    expect(res.countermodelEnergyJ).toBeCloseTo(3.2, 12);
  });

  test("unprimed transverse ray in K (phi = 90 deg, beta = 0.6): energy factor is gamma", () => {
    const res = evaluateSr10({
      beta: 0.6,
      propagationAngleDeg: 90,
      initialEnergyJ: 1.0,
      initialVolumeM3: 1.0,
    });

    expect(res.status).toBe("value");
    expect(res.energyFactor).toBeCloseTo(1.25, 12);
    expect(res.volumeFactor).toBeCloseTo(0.8, 12);
    expect(res.transformedEnergyJ).toBeCloseTo(1.25, 12);
    expect(res.transformedVolumeM3).toBeCloseTo(0.8, 12);
  });

  test("moving-frame transverse ray (cos phi = beta = 0.6, phi ≈ 53.13 deg): light volume expands (1.25) vs rod contracts (0.8)", () => {
    const phiDeg = (Math.acos(0.6) * 180) / Math.PI;
    const res = evaluateSr10({
      beta: 0.6,
      propagationAngleDeg: phiDeg,
      initialEnergyJ: 1.0,
      initialVolumeM3: 1.0,
    });

    expect(res.status).toBe("value");
    // q = gamma * (1 - beta^2) = 1 / gamma = 0.8
    expect(res.energyFactor).toBeCloseTo(0.8, 10);
    // V'/V = 1 / q = gamma = 1.25 (Light packet volume expands!)
    expect(res.volumeFactor).toBeCloseTo(1.25, 10);

    // Material rod contraction: 1 / gamma = 0.8 (contracts!)
    expect(res.countermodelVolumeFactor).toBeCloseTo(0.8, 10);
    // Ratio of light volume to rod volume is gamma^2 = 1.25 / 0.8 = 1.5625
    expect(res.volumeFactor / res.countermodelVolumeFactor).toBeCloseTo(1.25 * 1.25, 10);

    // Countermodel energy: q^2 / gamma = 0.64 / 1.25 = 0.512 != 0.8
    expect(res.countermodelEnergyFactor).toBeCloseTo(0.512, 10);
  });

  test("energy density balance u' = E'/V' = u * q^2 holds universally", () => {
    const res = evaluateSr10({
      beta: 0.5,
      propagationAngleDeg: 45,
      initialEnergyJ: 2.0,
      initialVolumeM3: 3.0,
    });

    const uInitial = res.initialEnergyJ / res.initialVolumeM3;
    const uTransformed = res.transformedEnergyJ / res.transformedVolumeM3;
    expect(uTransformed / uInitial).toBeCloseTo(res.energyDensityFactor, 12);
    expect(res.transformedEnergyJ).toBeCloseTo(uTransformed * res.transformedVolumeM3, 12);
  });

  test("superluminal and infinite inputs return outside-domain status", () => {
    const resSuper = evaluateSr10({
      beta: 1.0,
      propagationAngleDeg: 0,
    });
    expect(resSuper.status).toBe("outside-domain");

    const resNegSuper = evaluateSr10({
      beta: -1.05,
      propagationAngleDeg: 0,
    });
    expect(resNegSuper.status).toBe("outside-domain");
  });
});
