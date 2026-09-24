import { describe, expect, test } from "bun:test";
import {
  dopplerFactor,
  evaluateSr10,
  lightComplexFactors,
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
    expect(res.materialVolumeFactor).toBeCloseTo(0.8, 12);
    expect(res.energyFactor).not.toBeCloseTo(res.materialVolumeFactor, 2);
    expect(res.volumeFactor).not.toBeCloseTo(res.materialVolumeFactor, 2);
    // The bead's rigid-body countermodel: density q^2 = 0.25 in a rod's volume 1/gamma = 0.8.
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

    expect(res.countermodelEnergyFactor).toBeCloseTo(3.2, 12);
    expect(res.countermodelVolumeFactor).toBeCloseTo(0.8, 12);
    expect(res.countermodelEnergyJ).toBeCloseTo(3.2, 12);
    expect(res.energyFactor).not.toBeCloseTo(res.materialVolumeFactor, 2);
  });

  test("unprimed transverse ray (cos phi = 0): light factor gamma vs material 1/gamma, and the rigid-body countermodel agrees", () => {
    const res = evaluateSr10({
      beta: 0.6,
      propagationAngleDeg: 90,
      initialEnergyJ: 1.0,
      initialVolumeM3: 1.0,
    });

    expect(res.status).toBe("value");
    expect(res.energyFactor).toBeCloseTo(1.25, 12);
    expect(res.materialVolumeFactor).toBeCloseTo(0.8, 12);
    expect(res.energyFactor / res.materialVolumeFactor).toBeCloseTo(1.25 * 1.25, 12);
    // q^2/gamma = gamma here, so this ray cannot tell the light complex from the countermodel.
    expect(res.countermodelEnergyFactor).toBeCloseTo(1.25, 12);
    expect(res.energyFactor).toBeCloseTo(res.countermodelEnergyFactor, 12);
    expect(res.volumeFactor).toBeCloseTo(0.8, 12);
    expect(res.transformedEnergyJ).toBeCloseTo(1.25, 12);
    expect(res.transformedVolumeM3).toBeCloseTo(0.8, 12);
  });

  test("moving-frame transverse ray (cos phi = beta): energy equals 1/gamma, and the countermodel's 0.512 differs", () => {
    const phiDeg = (Math.acos(0.6) * 180) / Math.PI;
    const res = evaluateSr10({
      beta: 0.6,
      propagationAngleDeg: phiDeg,
      initialEnergyJ: 1.0,
      initialVolumeM3: 1.0,
    });

    expect(res.status).toBe("value");
    expect(res.energyFactor).toBeCloseTo(0.8, 10);
    expect(res.materialVolumeFactor).toBeCloseTo(0.8, 10);
    expect(res.energyFactor).toBeCloseTo(res.materialVolumeFactor, 10);
    expect(res.countermodelEnergyFactor).toBeCloseTo(0.512, 10);
    expect(res.energyFactor).not.toBeCloseTo(res.countermodelEnergyFactor, 2);
    expect(res.volumeFactor).toBeCloseTo(1.25, 10);
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
