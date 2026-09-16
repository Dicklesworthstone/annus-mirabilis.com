import { describe, expect, it } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  cathodeLuminescenceMinimumPotential,
  collectorSweep,
  einsteinPrintedStoppingCheck,
  emissionRate,
  kMax,
  kMaxEv,
  photocurrent,
  quantumEnergy,
  quantumEnergyEv,
  quantumRate,
  stoppingLine,
  stoppingPotentialFromEv,
  thresholdFrequencyFromEv,
  visibleColor,
} from "../physics/reference/photoelectric.ts";

describe("Photoelectric Reference Evaluator (am-lq-08-photoelectric-va5a)", () => {
  const set = getConstantSet("modern-si-2019");

  it("calculates quantum energy correctly in Joules and eV", () => {
    const nu = 6.0e14; // 600 THz (green/cyan)
    const eqJ = quantumEnergy(nu, set);
    expect(eqJ.status).toBe("value");
    if (eqJ.status === "value") {
      // h = 6.62607015e-34 J s -> E = 3.97564209e-19 J
      expect(eqJ.value).toBeCloseTo(3.97564209e-19, 25);
      expect(eqJ.unit).toBe("J");
    }

    const eqEv = quantumEnergyEv(nu, set);
    expect(eqEv.status).toBe("value");
    if (eqEv.status === "value") {
      // 3.97564209e-19 / 1.602176634e-19 ≈ 2.4814006 eV
      expect(eqEv.value).toBeCloseTo(2.4814006, 6);
      expect(eqEv.unit).toBe("eV");
    }
  });

  it("calculates threshold frequency for a given work function", () => {
    const workFunctionEv = 2.2; // Sodium ~ 2.2 eV
    const tfRes = thresholdFrequencyFromEv(workFunctionEv, set);
    expect(tfRes.status).toBe("value");
    if (tfRes.status === "value") {
      // nu_0 = 2.2 * 1.602176634e-19 / 6.62607015e-34 ≈ 5.31957633e14 Hz
      expect(tfRes.value).toBeCloseTo(5.31957633e14, -8);
      expect(tfRes.unit).toBe("Hz");
    }
  });

  it("returns not-applicable for K_max and V_s when frequency is below threshold", () => {
    const subThresholdNu = 4.0e14; // 400 THz -> E_q ≈ 1.654 eV
    const workFunctionEv = 2.2; // 2.2 eV

    const kRes = kMaxEv(subThresholdNu, workFunctionEv, set);
    expect(kRes.status).toBe("not-applicable");
    if (kRes.status === "not-applicable") {
      expect(kRes.reason).toBe("no emitted electron in this model");
    }

    const vsRes = stoppingPotentialFromEv(subThresholdNu, workFunctionEv, set);
    expect(vsRes.status).toBe("not-applicable");
    if (vsRes.status === "not-applicable") {
      expect(vsRes.reason).toBe("no emitted electron in this model");
    }
  });

  it("returns positive K_max and stopping potential when frequency is above threshold", () => {
    const supraThresholdNu = 6.0e14; // E_q ≈ 2.4814 eV
    const workFunctionEv = 2.2; // 2.2 eV

    const kRes = kMaxEv(supraThresholdNu, workFunctionEv, set);
    expect(kRes.status).toBe("value");
    if (kRes.status === "value") {
      expect(kRes.value).toBeCloseTo(2.4814006 - 2.2, 5); // ~0.2814 eV
    }

    const vsRes = stoppingPotentialFromEv(supraThresholdNu, workFunctionEv, set);
    expect(vsRes.status).toBe("value");
    if (vsRes.status === "value") {
      expect(vsRes.value).toBeCloseTo(0.2814006, 5); // 0.2814 V
    }
  });

  it("enforces bitwise energy invariance under power changes (Rate vs Energy Distinction)", () => {
    const nu = 7.0e14;
    const workFunctionJ = 2.0 * 1.602176634e-19;
    const eta = 0.1;

    const power1 = 0.001; // 1 mW
    const power2 = 0.01; // 10 mW (10x power)

    const k1 = kMax(nu, workFunctionJ, set);
    const k2 = kMax(nu, workFunctionJ, set);

    expect(k1.status).toBe("value");
    expect(k2.status).toBe("value");
    if (k1.status === "value" && k2.status === "value") {
      // Bitwise exact identity
      expect(Object.is(k1.value, k2.value)).toBe(true);
    }

    const rate1 = quantumRate(power1, nu, set);
    const rate2 = quantumRate(power2, nu, set);
    expect(rate1.status).toBe("value");
    expect(rate2.status).toBe("value");
    if (rate1.status === "value" && rate2.status === "value") {
      expect(rate2.value / rate1.value).toBeCloseTo(10.0, 10);
    }

    const emission1 = emissionRate(power1, nu, workFunctionJ, eta, set);
    const emission2 = emissionRate(power2, nu, workFunctionJ, eta, set);
    expect(emission1.status).toBe("value");
    expect(emission2.status).toBe("value");
    if (emission1.status === "value" && emission2.status === "value") {
      expect(emission2.value / emission1.value).toBeCloseTo(10.0, 10);
    }
  });

  it("evaluates collector photocurrent across saturation, cutoff, and underdetermined regimes", () => {
    const nu = 6.0e14; // E_q ≈ 2.4814 eV
    const workFunctionJ = 2.0 * 1.602176634e-19; // 2.0 eV -> V_s ≈ 0.4814 V
    const eta = 0.1;
    const power = 0.001; // 1 mW

    // 1. Accelerating bias (U_c >= 0): saturation current
    const pcSat = photocurrent(power, nu, workFunctionJ, eta, 1.5, set);
    expect(pcSat.status).toBe("value");
    if (pcSat.status === "value") {
      expect(pcSat.value).toBeGreaterThan(0);
    }

    // 2. Full retarding bias (U_c <= -V_s): zero current
    const pcCutoff = photocurrent(power, nu, workFunctionJ, eta, -1.0, set);
    expect(pcCutoff.status).toBe("value");
    if (pcCutoff.status === "value") {
      expect(pcCutoff.value).toBe(0);
    }

    // 3. Partial retarding bias (-V_s < U_c < 0): underdetermined
    const pcBetween = photocurrent(power, nu, workFunctionJ, eta, -0.2, set);
    expect(pcBetween.status).toBe("underdetermined");
    if (pcBetween.status === "underdetermined") {
      expect(pcBetween.compatibleFamily).toBe("retarded-photoelectron-current");
      expect(pcBetween.neededInformation).toContain("electron-energy-distribution-in-emitter");
    }

    // 4. Subthreshold frequency: zero current everywhere
    const subNu = 3.0e14;
    const pcSub = photocurrent(power, subNu, workFunctionJ, eta, 2.0, set);
    expect(pcSub.status).toBe("value");
    if (pcSub.status === "value") {
      expect(pcSub.value).toBe(0);
    }
  });

  it("computes collector sweep points across the declared range", () => {
    const nu = 6.0e14;
    const workFunctionJ = 2.0 * 1.602176634e-19;
    const sweep = collectorSweep(
      0.001,
      nu,
      workFunctionJ,
      0.1,
      {
        min: -2.0,
        max: 2.0,
        steps: 5,
      },
      set,
    );
    expect(sweep.length).toBe(5);
    const firstPoint = sweep[0];
    const lastPoint = sweep[4];
    expect(firstPoint?.collectorPotential).toBe(-2.0);
    expect(lastPoint?.collectorPotential).toBe(2.0);
  });

  it("generates theoretical stopping lines with constant slope h/e", () => {
    const workFunctionJ = 2.0 * 1.602176634e-19;
    const lines = stoppingLine(workFunctionJ, { min: 4e14, max: 1e15, steps: 11 }, set);
    expect(lines.length).toBeGreaterThan(0);

    // Verify slope between points is h/e
    const hOverE = 6.62607015e-34 / 1.602176634e-19;
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1];
      const curr = lines[i];
      if (!prev || !curr) continue;
      const dV = curr.stoppingPotential - prev.stoppingPotential;
      const dNu = curr.frequency - prev.frequency;
      expect(dV / dNu).toBeCloseTo(hOverE, 10);
    }
  });

  it("computes cathode luminescence minimum potential", () => {
    const nu = 1.0e15;
    const workFunctionJ = 2.0 * 1.602176634e-19;
    const clRes = cathodeLuminescenceMinimumPotential(nu, workFunctionJ, set);
    expect(clRes.status).toBe("value");
    if (clRes.status === "value") {
      // (h*nu - Phi) / e ≈ 4.13567 - 2.0 = 2.13567 V
      expect(clRes.value).toBeCloseTo(2.13567, 4);
      expect(clRes.unit).toBe("V");
    }
  });

  it("evaluates Einstein 1905 §8 historical check (ca. 4.3 Volt)", () => {
    const check = einsteinPrintedStoppingCheck();
    expect(check.representationA.printedText).toBe("ca. 4,3 Volt");
    // Pi = 4.33852025 V
    expect(check.representationA.stoppingPotentialVolts).toBeCloseTo(4.33852, 4);
    // Rounds to 4.3 V
    expect(Math.round(check.representationA.stoppingPotentialVolts * 10) / 10).toBe(4.3);
    expect(check.representationA.slopeVsPerHz).toBeCloseTo(4.21215e-15, 18);
    expect(check.representationB.stoppingPotentialVolts).toBeCloseTo(4.3057, 4);
    expect(check.historicalNote).toContain("P' = 0");
  });

  it("maps visible optical frequencies to color bands", () => {
    expect(visibleColor(7.0e14).band).toBe("violet");
    expect(visibleColor(5.5e14).band).toBe("green");
    expect(visibleColor(4.5e14).band).toBe("red");
    expect(visibleColor(1.2e15).band).toBe("ultraviolet");
    expect(visibleColor(3.0e14).band).toBe("infrared");
  });
});
