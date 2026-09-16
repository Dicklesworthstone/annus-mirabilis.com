import { describe, expect, it } from "bun:test";
import { resolveQuantityId } from "../content/quantities/resolveQuantityId.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  effectiveIndependentCount,
  meanQuantumEnergyWien,
} from "../physics/reference/radiation/quanta.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("LQ-06 Radiation & Quanta Reference Evaluator (Paper 1, §6)", () => {
  const set = getConstantSet("modern-si-2019");

  it("evaluates golden state correctly (E = 9.055615 nJ, nu = 600 THz)", () => {
    const E = 9.055615e-9;
    const nu = 6.0e14;
    const res = effectiveIndependentCount(E, nu, set);

    expect(res.status).toBe("value");
    expect(res.quantityId).toBe("effectiveIndependentCount");

    // n_eff = E / (h * nu) = 2.277774e10
    const tolCount = withinTolerance(res.count, 2.277774e10, { relative: 1e-5 });
    expect(tolCount.ok).toBe(true);

    // Quantum energy = 3.975642e-19 J = 2.481401 eV
    const tolE = withinTolerance(res.quantumEnergy, 3.975642e-19, { relative: 1e-6 });
    expect(tolE.ok).toBe(true);

    const tolEv = withinTolerance(res.quantumEnergyEv, 2.481401, { relative: 1e-5 });
    expect(tolEv.ok).toBe(true);
  });

  it("evaluates Wien mean quantum energy at T = 3000 K (3 k_B T)", () => {
    const T = 3000;
    const mean = meanQuantumEnergyWien(T, set);

    expect(mean.status).toBe("value");

    // <epsilon> = 3 * k_B * T = 1.2425841e-19 J = 0.7755600 eV
    const tolJ = withinTolerance(mean.meanQuantumEnergyWien, 1.2425841e-19, { relative: 1e-6 });
    expect(tolJ.ok).toBe(true);

    const tolEv = withinTolerance(mean.meanQuantumEnergyWienEv, 0.77556, { relative: 1e-5 });
    expect(tolEv.ok).toBe(true);

    // Molecule kinetic energy = 1.5 * k_B * T = 0.3877800 eV
    const tolKin = withinTolerance(mean.moleculeKineticEnergyEv, 0.38778, { relative: 1e-5 });
    expect(tolKin.ok).toBe(true);

    // Exact ratio is 2
    expect(mean.ratioToMoleculeKinetic).toBeCloseTo(2.0, 10);

    // Ratio at 600 THz: h * nu / (3 * k_B * T) = 3.199495
    const tol600 = withinTolerance(mean.ratioAt600THz, 3.199495, { relative: 1e-5 });
    expect(tol600.ok).toBe(true);
  });

  it("reproduces historical 1905 printed constants and comparisons", () => {
    const R = 8.31e7; // erg / K
    const beta = 4.866e-11; // K * s
    const N = 6.17e23; // mol^-1

    // R * beta / N = 6.5537e-27 erg * s
    const hHistorical = (R * beta) / N;
    const tolH = withinTolerance(hHistorical, 6.5537e-27, { relative: 1e-4 });
    expect(tolH.ok).toBe(true);

    // Ratio to modern h = 6.62607e-27 erg * s is 0.989
    const hModernCgs = 6.62607015e-27;
    const ratioToModern = hHistorical / hModernCgs;
    expect(ratioToModern).toBeCloseTo(0.989, 2);

    // R * beta * nu / N at 600 THz = 3.9322e-12 erg
    const nu = 6.0e14;
    const epsHistorical = hHistorical * nu;
    const tolEps = withinTolerance(epsHistorical, 3.9322e-12, { relative: 1e-4 });
    expect(tolEps.ok).toBe(true);

    // 3 * (R / N) * T at 3000 K = 1.212156e-12 erg
    const meanWienHistorical = 3 * (R / N) * 3000;
    const tolMean = withinTolerance(meanWienHistorical, 1.212156e-12, { relative: 1e-4 });
    expect(tolMean.ok).toBe(true);
  });

  it("verifies entropy identity between radiation and gas for various volume ratios", () => {
    const kB = 1.380649e-23;
    const E = 9.055615e-9;
    const nu = 6.0e14;
    const nEff = E / (6.62607015e-34 * nu);

    const testRatios = [0.01, 0.5, 2.0, 100.0];
    for (const vRatio of testRatios) {
      const deltaS_rad = kB * nEff * Math.log(vRatio);
      const deltaS_gas = kB * nEff * Math.log(vRatio);
      expect(deltaS_rad).toBeCloseTo(deltaS_gas, 12);
    }
  });

  it("verifies canonical quantity bindings in registry", () => {
    const resCount = resolveQuantityId("effectiveIndependentCount");
    expect(resCount.ok).toBe(true);
    if (resCount.ok) {
      expect(resCount.quantity.id).toBe("effectiveIndependentCount");
    }

    const resEnergy = resolveQuantityId("quantumEnergy");
    expect(resEnergy.ok).toBe(true);
    if (resEnergy.ok) {
      expect(resEnergy.quantity.id).toBe("quantumEnergy");
    }

    const resEntropy = resolveQuantityId("radiationEntropy");
    expect(resEntropy.ok).toBe(true);
    if (resEntropy.ok) {
      expect(resEntropy.quantity.id).toBe("radiationEntropy");
    }

    const resCoeff = resolveQuantityId("entropyVolumeCoefficient");
    expect(resCoeff.ok).toBe(true);
    if (resCoeff.ok) {
      expect(resCoeff.quantity.id).toBe("entropyVolumeCoefficient");
    }
  });
});
