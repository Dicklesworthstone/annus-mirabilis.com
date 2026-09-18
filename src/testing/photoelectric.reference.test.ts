import { describe, expect, it } from "bun:test";
import { resolveQuantityId } from "../content/quantities/resolveQuantityId.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  cathodeLuminescenceMinimumPotential,
  collectorSweep,
  einsteinPrintedIonizationChecks,
  einsteinPrintedStoppingCheck,
  emissionRate,
  fluorescenceBudget,
  fluorescenceRates,
  gasCard,
  ionizationBounds,
  ionizationCount,
  kMax,
  kMaxEv,
  metalCard,
  photocurrent,
  quantumEnergy,
  quantumEnergyEv,
  quantumRate,
  signedEnergyBudget,
  stoppingLine,
  stoppingPotentialFromEv,
  stoppingPotentialMagnitude,
  thresholdFrequency,
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

  it("AC 2: asserts that the five rate quantity ids carry dimension T^-1, count their specific objects, and no per-gram-equivalent output binds a rate id", () => {
    const rateIds = [
      { id: "quantumRate", counted: "quanta" },
      { id: "absorbedQuantumRate", counted: "absorbed quanta" },
      { id: "emissionRate", counted: "electrons" },
      { id: "emittedQuantumRate", counted: "emitted quanta" },
      { id: "ionizationRate", counted: "ionization events" },
    ];

    for (const { id, counted } of rateIds) {
      const res = resolveQuantityId(id);
      expect(res.ok).toBe(true);
      if (res.ok && res.quantity.dimension) {
        expect(res.quantity.dimension.map((d) => d.num / d.den)).toEqual([0, 0, -1, 0, 0, 0]);
        expect(res.quantity.description.toLowerCase()).toContain(counted.toLowerCase());
      }
    }

    // Per-gram-equivalent quantities are amounts and energies, never rates:
    const workRes = resolveQuantityId("ionizationWorkPerGramEquivalent");
    expect(workRes.ok).toBe(true);
    if (workRes.ok && workRes.quantity.dimension) {
      expect(workRes.quantity.dimension.map((d) => d.num / d.den)).toEqual([2, 1, -2, 0, 0, -1]); // M L^2 T^-2 N^-1
      expect(workRes.quantity.dimension.map((d) => d.num / d.den)).not.toEqual([0, 0, -1, 0, 0, 0]);
    }

    const molRes = resolveQuantityId("ionizedGramMolecules");
    expect(molRes.ok).toBe(true);
    if (molRes.ok && molRes.quantity.dimension) {
      expect(molRes.quantity.dimension.map((d) => d.num / d.den)).toEqual([0, 0, 0, 0, 0, 1]); // amount
      expect(molRes.quantity.dimension.map((d) => d.num / d.den)).not.toEqual([0, 0, -1, 0, 0, 0]);
    }

    // Legacy spelling ionizationEnergy fails with canonical target ionizationEnergyPerMolecule
    const legacy = resolveQuantityId("ionizationEnergy");
    expect(legacy.ok).toBe(false);
    if (!legacy.ok) {
      expect(legacy.kind).toBe("legacy-spelling");
      if (legacy.kind === "legacy-spelling") {
        expect(legacy.canonicalIds).toContain("ionizationEnergyPerMolecule");
      }
    }
  });

  it("AC 3: modern golden fixture (Phi = 2 eV, nu = 600 THz) gives K_max = 0.4814006 eV, V_s = 0.4814006 V, nu_0 = 483.5978 THz (relative 10^-9)", () => {
    const phiEv = 2.0;
    const e = 1.602176634e-19;
    const h = 6.62607015e-34;
    const phiJ = phiEv * e;
    const nu = 600e12; // 600 THz

    // nu_0 = Phi / h
    const nu0Res = thresholdFrequency(phiJ, set);
    expect(nu0Res.status).toBe("value");
    if (nu0Res.status === "value") {
      const expectedNu0 = phiJ / h;
      expect(Math.abs(nu0Res.value - expectedNu0) / expectedNu0).toBeLessThan(1e-9);
      expect(nu0Res.value / 1e12).toBeCloseTo(483.5978, 4);
    }

    // K_max in eV
    const kRes = kMaxEv(nu, phiEv, set);
    expect(kRes.status).toBe("value");
    if (kRes.status === "value") {
      const expectedKev = (h * nu - phiJ) / e;
      expect(Math.abs(kRes.value - expectedKev) / expectedKev).toBeLessThan(1e-9);
      expect(kRes.value).toBeCloseTo(0.4814006, 6);
    }

    // V_s
    const vsRes = stoppingPotentialFromEv(nu, phiEv, set);
    expect(vsRes.status).toBe("value");
    if (vsRes.status === "value") {
      const expectedVs = (h * nu - phiJ) / e;
      expect(Math.abs(vsRes.value - expectedVs) / expectedVs).toBeLessThan(1e-9);
      expect(vsRes.value).toBeCloseTo(0.4814006, 6);
    }

    // Threshold edge: at exact threshold frequency, K_max = 0 and V_s = 0 carry threshold note
    const nu0 = phiJ / h;
    const kEdge = kMax(nu0, phiJ, set);
    expect(kEdge.status).toBe("value");
    if (kEdge.status === "value") {
      expect(kEdge.value).toBe(0);
      expect(kEdge.note).toBe("zero maximum kinetic energy does not guarantee a measurable current");
    }

    const vsEdge = stoppingPotentialMagnitude(nu0, phiJ, set);
    expect(vsEdge.status).toBe("value");
    if (vsEdge.status === "value") {
      expect(vsEdge.value).toBe(0);
      expect(vsEdge.note).toBe("zero maximum kinetic energy does not guarantee a measurable current");
    }
  });

  it("AC 4: below threshold (450 THz, Phi = 2 eV) gives not-applicable K_max/V_s, signed budget -0.1389495 eV, and emission rate 0 with reason", () => {
    const nu = 450e12; // 450 THz
    const phiEv = 2.0;
    const e = 1.602176634e-19;
    const phiJ = phiEv * e;

    const kRes = kMax(nu, phiJ, set);
    expect(kRes.status).toBe("not-applicable");
    if (kRes.status === "not-applicable") {
      expect(kRes.reason).toBe("no emitted electron in this model");
    }

    const vsRes = stoppingPotentialMagnitude(nu, phiJ, set);
    expect(vsRes.status).toBe("not-applicable");
    if (vsRes.status === "not-applicable") {
      expect(vsRes.reason).toBe("no emitted electron in this model");
    }

    const budget = signedEnergyBudget(nu, phiJ, set);
    expect(budget.excessEv).toBeCloseTo(-0.1389495, 6);
    expect(budget.emitted).toBe(false);

    const rateRes = emissionRate({ P: 1e-3, nu, Phi: phiJ, etaQ: 0.1 }, set);
    expect(rateRes.status).toBe("value");
    if (rateRes.status === "value") {
      expect(rateRes.value).toBe(0);
      expect(rateRes.reason).toBe("frequency is below threshold (single-quantum model forces zero emission)");
    }
  });

  it("AC 5: partial transfer at 600 THz / 2 eV gives underdetermined K_max/V_s bounded by 0.4814006, cathode luminescence minimum potential 0.4814006 V, and not-applicable below threshold", () => {
    const nu = 600e12;
    const phiEv = 2.0;
    const e = 1.602176634e-19;
    const phiJ = phiEv * e;

    const kPartial = kMaxEv(nu, phiEv, set, { transferModel: "partial" });
    expect(kPartial.status).toBe("underdetermined");
    if (kPartial.status === "underdetermined") {
      expect(kPartial.upperBound).toBeCloseTo(0.4814006, 6);
      expect(kPartial.bounds?.[0]).toBe(0);
      expect(kPartial.bounds?.[1]).toBeCloseTo(0.4814006, 6);
      expect(kPartial.reason).toBe("a quantum may give only part of its energy to an electron; the printed relation is an upper bound");
    }

    const vsPartial = stoppingPotentialMagnitude(nu, phiJ, set, { transferModel: "partial" });
    expect(vsPartial.status).toBe("underdetermined");
    if (vsPartial.status === "underdetermined") {
      expect(vsPartial.upperBound).toBeCloseTo(0.4814006, 6);
      expect(vsPartial.bounds?.[0]).toBe(0);
      expect(vsPartial.bounds?.[1]).toBeCloseTo(0.4814006, 6);
      expect(vsPartial.reason).toBe("a quantum may give only part of its energy to an electron; the printed relation is an upper bound");
    }

    // Cathode luminescence minimum potential at 600 THz / 2 eV
    const clRes = cathodeLuminescenceMinimumPotential(nu, phiJ, set);
    expect(clRes.status).toBe("value");
    if (clRes.status === "value") {
      expect(clRes.value).toBeCloseTo(0.4814006, 6);
      expect(clRes.unit).toBe("V");
    }

    // Cathode luminescence below threshold (nu <= nu_0) gives not-applicable
    const subNu = 450e12;
    const clSub = cathodeLuminescenceMinimumPotential(subNu, phiJ, set);
    expect(clSub.status).toBe("not-applicable");
    if (clSub.status === "not-applicable") {
      expect(clSub.reason).toBe("this idealization implies no minimum potential");
    }
  });

  it("AC 6: P = 1 mW at 600 THz gives N_dot_q = 2.515317e15 s^-1, eta_q = 0.1 gives N_dot_e = 2.515317e14 s^-1, I(0) = 4.029982e-5 A; doubling P doubles rates and leaves K_max unchanged; doubling frequency halves N_dot_q", () => {
    const nu = 600e12;
    const phiEv = 2.0;
    const e = 1.602176634e-19;
    const phiJ = phiEv * e;
    const p1 = 1e-3; // 1 mW
    const eta = 0.1;

    const nDotQ1 = quantumRate(p1, nu, set);
    expect(nDotQ1.status).toBe("value");
    if (nDotQ1.status === "value") {
      expect(nDotQ1.value).toBeCloseTo(2.515317e15, -10);
    }

    const nDotE1 = emissionRate({ P: p1, nu, Phi: phiJ, etaQ: eta }, set);
    expect(nDotE1.status).toBe("value");
    if (nDotE1.status === "value") {
      expect(nDotE1.value).toBeCloseTo(2.515317e14, -9);
    }

    const iZero = photocurrent(
      {
        P: p1,
        nu,
        Phi: phiJ,
        etaQ: eta,
        collectionFraction: 1.0,
        collectorPotential: 0,
        distributionModel: "all-at-kmax",
        transferModel: "complete",
      },
      set,
    );
    expect(iZero.status).toBe("value");
    if (iZero.status === "value") {
      expect(iZero.value).toBeCloseTo(4.029982e-5, 10);
    }

    // Doubling P to 2 mW
    const p2 = 2e-3;
    const nDotQ2 = quantumRate(p2, nu, set);
    const nDotE2 = emissionRate({ P: p2, nu, Phi: phiJ, etaQ: eta }, set);
    expect(nDotQ2.status).toBe("value");
    expect(nDotE2.status).toBe("value");
    if (nDotQ1.status === "value" && nDotQ2.status === "value") {
      expect(nDotQ2.value).toBeCloseTo(nDotQ1.value * 2, -10);
    }
    if (nDotE1.status === "value" && nDotE2.status === "value") {
      expect(nDotE2.value).toBeCloseTo(nDotE1.value * 2, -9);
    }

    // K_max is bitwise identical under power change
    const k1 = kMax(nu, phiJ, set);
    const k2 = kMax(nu, phiJ, set);
    if (k1.status === "value" && k2.status === "value") {
      expect(Object.is(k1.value, k2.value)).toBe(true);
    }

    // Doubling frequency from 600 THz to 1200 THz at fixed P halves N_dot_q
    const nuDouble = 1200e12;
    const nDotQDoubleNu = quantumRate(p1, nuDouble, set);
    expect(nDotQDoubleNu.status).toBe("value");
    if (nDotQ1.status === "value" && nDotQDoubleNu.status === "value") {
      expect(nDotQDoubleNu.value).toBeCloseTo(nDotQ1.value / 2, -10);
      expect(nDotQDoubleNu.value).toBeCloseTo(1.257658e15, -10);
    }
  });

  it("AC 7: stopping-line slope equals h/e exactly; all distribution models give full current for Uc >= 0, zero for Uc <= -Vs; interior models match definitions; none and partial transfer return underdetermined with bounds", () => {
    const phiEv = 2.0;
    const e = 1.602176634e-19;
    const h = 6.62607015e-34;
    const phiJ = phiEv * e;
    const nu = 600e12;
    const vs = (h * nu - phiJ) / e; // ~0.4814 V
    const p = 1e-3;
    const eta = 0.1;
    const iSat = e * 1.0 * (eta * (p / (h * nu)));

    // Stopping line
    const lines = stoppingLine(phiJ, { min: 500e12, max: 1000e12, steps: 5 }, set);
    expect(lines.slope).toBeCloseTo(h / e, 25);
    expect(lines.intercept).toBeCloseTo(-phiJ / e, 10);
    expect(lines.printedSlopeVsPerHz).toBeCloseTo(4.21213125e-15, 20);
    expect(lines.historicalSlopeLabel).toBe("historical");

    const models: ("all-at-kmax" | "uniform-0-kmax" | "none")[] = [
      "all-at-kmax",
      "uniform-0-kmax",
      "none",
    ];

    // Complete transfer:
    // 1. Accelerating Uc = +0.5 V >= 0: full saturation current for all models
    for (const model of models) {
      const res = photocurrent(
        {
          P: p,
          nu,
          Phi: phiJ,
          etaQ: eta,
          collectorPotential: 0.5,
          distributionModel: model,
          transferModel: "complete",
        },
        set,
      );
      expect(res.status).toBe("value");
      if (res.status === "value") {
        expect(res.value).toBeCloseTo(iSat, 10);
      }
    }

    // 2. Full retarding Uc = -0.8 V <= -Vs: zero current for all models
    for (const model of models) {
      const res = photocurrent(
        {
          P: p,
          nu,
          Phi: phiJ,
          etaQ: eta,
          collectorPotential: -0.8,
          distributionModel: model,
          transferModel: "complete",
        },
        set,
      );
      expect(res.status).toBe("value");
      if (res.status === "value") {
        expect(res.value).toBe(0);
      }
    }

    // 3. Interior -Vs < Uc < 0:
    const ucInterior = -0.2; // -0.4814 < -0.2 < 0
    const pcAll = photocurrent(
      {
        P: p,
        nu,
        Phi: phiJ,
        etaQ: eta,
        collectorPotential: ucInterior,
        distributionModel: "all-at-kmax",
        transferModel: "complete",
      },
      set,
    );
    expect(pcAll.status).toBe("value");
    if (pcAll.status === "value") {
      expect(pcAll.value).toBeCloseTo(iSat, 10);
    }

    const pcUniform = photocurrent(
      {
        P: p,
        nu,
        Phi: phiJ,
        etaQ: eta,
        collectorPotential: ucInterior,
        distributionModel: "uniform-0-kmax",
        transferModel: "complete",
      },
      set,
    );
    expect(pcUniform.status).toBe("value");
    if (pcUniform.status === "value") {
      const expectedFrac = 1 - Math.abs(ucInterior) / vs;
      expect(pcUniform.value).toBeCloseTo(iSat * expectedFrac, 10);
    }

    const pcNone = photocurrent(
      {
        P: p,
        nu,
        Phi: phiJ,
        etaQ: eta,
        collectorPotential: ucInterior,
        distributionModel: "none",
        transferModel: "complete",
      },
      set,
    );
    expect(pcNone.status).toBe("underdetermined");
    if (pcNone.status === "underdetermined") {
      expect(pcNone.bounds?.[0]).toBe(0);
      expect(pcNone.bounds?.[1]).toBeCloseTo(iSat, 10);
      expect(pcNone.reason).toBe("no electron energy distribution model declared");
    }

    // Partial transfer:
    // Uc >= 0 gives iSat
    const pcPartAcc = photocurrent(
      {
        P: p,
        nu,
        Phi: phiJ,
        etaQ: eta,
        collectorPotential: 0.5,
        transferModel: "partial",
      },
      set,
    );
    expect(pcPartAcc.status).toBe("value");
    if (pcPartAcc.status === "value") expect(pcPartAcc.value).toBeCloseTo(iSat, 10);

    // Uc <= -VsMax gives 0
    const pcPartCut = photocurrent(
      {
        P: p,
        nu,
        Phi: phiJ,
        etaQ: eta,
        collectorPotential: -0.8,
        transferModel: "partial",
      },
      set,
    );
    expect(pcPartCut.status).toBe("value");
    if (pcPartCut.status === "value") expect(pcPartCut.value).toBe(0);

    // Interior is underdetermined for EVERY model under partial transfer
    for (const model of models) {
      const pcPartInt = photocurrent(
        {
          P: p,
          nu,
          Phi: phiJ,
          etaQ: eta,
          collectorPotential: ucInterior,
          distributionModel: model,
          transferModel: "partial",
        },
        set,
      );
      expect(pcPartInt.status).toBe("underdetermined");
      if (pcPartInt.status === "underdetermined") {
        expect(pcPartInt.bounds?.[0]).toBe(0);
        expect(pcPartInt.bounds?.[1]).toBeCloseTo(iSat, 10);
      }
    }
  });

  it("AC 8: printed §8 check returns representations A (4.338495 V, slope 4.212131e-15 V s) and B (4.305742 V, 4.308723 V), labels non-printed documented alternative, applies result-line policy, and transcription slips fail", () => {
    const check = einsteinPrintedStoppingCheck();
    // Rep A
    expect(check.representationA.isPrinted).toBe(true);
    expect(check.representationA.stoppingPotentialVolts).toBeCloseTo(4.338495, 4);
    expect(check.representationA.slopeVsPerHz).toBeCloseTo(4.212131e-15, 18);
    expect(check.representationA.stoppingPotentialModernRVolts).toBeCloseTo(4.340584, 4);

    // Rep B
    expect(check.representationB.isPrinted).toBe(false);
    expect(check.representationB.label).toBe("not printed; documented alternative");
    expect(check.representationB.stoppingPotentialVoltsConventional).toBeCloseTo(4.305742, 4);
    expect(check.representationB.stoppingPotentialVoltsHistorical300).toBeCloseTo(4.308723, 4);

    // Suspected typographical error result-line policy
    expect(check.suspectedTypographicalError.comparisonWitnessPrintedText).toBe("Π·10^7 = 4.3 Volt");
    expect(check.suspectedTypographicalError.numericalConventionVolts).toBe("Π·10^-8 V");
    expect(check.suspectedTypographicalError.provenanceReference).toBe("docs/provenance/ap-17-132.md");

    // Modern equivalent line
    expect(check.readoutStatements.hypotheticalComparison.quantumEnergyEv).toBeCloseTo(4.259738, 5);

    // Adversarial slips
    expect(check.adversarialSlips.chargeEmuSlipE96e4Volts).toBeCloseTo(0.4338, 3);
    expect(check.adversarialSlips.chargeEsuSlipEps44e10Volts).toBeCloseTo(4.599, 2);
    expect(check.adversarialSlips.reason).toBe("transcription-slip");
  });

  it("AC 9 & 10: fluorescence budget and weak illumination rates comply with paper assumptions and deviation cases", () => {
    // 850 THz -> h*nu1 = 3.515318 eV, bound 850 THz
    const f850 = fluorescenceBudget({ nu1: 850e12, nu2: 850e12, regime: "standard-stokes", set });
    expect(f850.status).toBe("value");
    expect(f850.allowed).toBe(true);
    expect(f850.e1Ev).toBeCloseTo(3.515318, 5);
    expect(f850.nu2MaxHz).toBe(850e12);

    // 900 THz disallowed with deficit 0.206783 eV
    const f900 = fluorescenceBudget({ nu1: 850e12, nu2: 900e12, regime: "standard-stokes", set });
    expect(f900.status).toBe("value");
    expect(f900.allowed).toBe(false);
    expect(f900.energyDeficitEv).toBeCloseTo(0.206783, 5);

    // Deviation case 1: k = 2 gives 1700 THz, 900 THz allowed
    const fMulti = fluorescenceBudget({
      nu1: 850e12,
      nu2: 900e12,
      regime: "deviation-multi-quantum",
      multiQuantumK: 2,
      set,
    });
    expect(fMulti.status).toBe("value");
    expect(fMulti.allowed).toBe(true);
    expect(fMulti.nu2MaxHz).toBe(1700e12);

    // Deviation case 2: non-Wien
    const f20k = fluorescenceBudget({
      nu1: 850e12,
      nu2: 850e12,
      regime: "deviation-non-wien",
      sourceTemperatureK: 20000,
      set,
    });
    expect(f20k.status).toBe("outside-domain");
    expect(f20k.refusalCode).toBe("outside-wien-domain");

    const f10k = fluorescenceBudget({
      nu1: 850e12,
      nu2: 850e12,
      regime: "deviation-non-wien",
      sourceTemperatureK: 10000,
      set,
    });
    expect(f10k.status).toBe("outside-domain");
    expect(f10k.refusalCode).toBe("outside-wien-domain");

    const f5800 = fluorescenceBudget({
      nu1: 850e12,
      nu2: 850e12,
      regime: "deviation-non-wien",
      sourceTemperatureK: 5800,
      set,
    });
    expect(f5800.status).toBe("value");
    expect(f5800.allowed).toBe(true);

    // Modern thermal allowance: n = 10, T = 300 K
    const fTherm = fluorescenceBudget({
      nu1: 850e12,
      nu2: 900e12,
      regime: "modern-thermal",
      bodyThermalDegreesN: 10,
      bodyTemperatureK: 300,
      set,
    });
    expect(fTherm.status).toBe("value");
    expect(fTherm.thermalExtraEv).toBeCloseTo(0.25852, 4);
    expect(fTherm.nu2MaxHz / 1e12).toBeCloseTo(912.51, 1);
    expect(fTherm.labelKind).toBe("modern-allowance");

    // Light-only with nu2 < nu1 is disallowed
    const fLightOnly = fluorescenceBudget({
      nu1: 850e12,
      nu2: 800e12,
      channels: "light-only",
      regime: "standard-stokes",
      set,
    });
    expect(fLightOnly.status).toBe("value");
    expect(fLightOnly.allowed).toBe(false);

    // Weak illumination rates: P_abs = 1 mW at 850 THz
    const rates1 = fluorescenceRates({
      nu1: 850e12,
      nu2: 800e12,
      absorbedPowerWatts: 1e-3,
      quantumYield: 0.5,
      set,
    });
    expect(rates1.status).toBe("value");
    expect(rates1.absorbedRatePerSecond).toBeCloseTo(1.775518e15, -9);
    expect(rates1.emittedRatePerSecond).toBeCloseTo(8.877589e14, -8);

    // Doubling P_abs
    const rates2 = fluorescenceRates({
      nu1: 850e12,
      nu2: 800e12,
      absorbedPowerWatts: 2e-3,
      quantumYield: 0.5,
      set,
    });
    expect(rates2.status).toBe("value");
    expect(rates2.absorbedRatePerSecond).toBeCloseTo(rates1.absorbedRatePerSecond * 2, -9);
    expect(rates2.emittedRatePerSecond).toBeCloseTo(rates1.emittedRatePerSecond * 2, -8);

    // Y = 1.2 is outside-domain
    const ratesInvalidY = fluorescenceRates({
      nu1: 850e12,
      nu2: 800e12,
      absorbedPowerWatts: 1e-3,
      quantumYield: 1.2,
      set,
    });
    expect(ratesInvalidY.status).toBe("outside-domain");

    // Deviation case 1 gives not-applicable
    const ratesDev1 = fluorescenceRates({
      nu1: 850e12,
      nu2: 800e12,
      absorbedPowerWatts: 1e-3,
      quantumYield: 0.5,
      regime: "deviation-multi-quantum",
      set,
    });
    expect(ratesDev1.status).toBe("not-applicable");
  });

  it("AC 11 & 12: ionization bounds, counting, property test, and printed §9 checks", () => {
    const e = 1.602176634e-19;
    const h = 6.62607015e-34;
    const nu = (12.0 * e) / h; // exactly 12 eV (2901.586957 THz)
    const jEv = 10.0;
    const pOpt = 1e-6; // 1 uW
    const eta = 0.5;

    const b = ionizationBounds({ nu, ionizationEnergyEv: jEv, set });
    expect(b.status).toBe("value");
    expect(b.singleQuantumAllowed).toBe(true);
    expect(b.excessEnergyEv).toBeCloseTo(2.0, 1);
    expect(b.thresholdFrequencyTHz).toBeCloseTo(2417.989, 1);

    const countAll = ionizationCount({
      nu,
      ionizationEnergyEv: jEv,
      incidentPowerWatts: pOpt,
      absorptionEfficiency: eta,
      durationSeconds: 1.0,
      absorptionMode: "all-absorbed-ionizes",
      set,
    });
    expect(countAll.status).toBe("value");
    if (countAll.incidentQuantumRatePerSecond.status === "value") {
      expect(countAll.incidentQuantumRatePerSecond.value).toBeCloseTo(5.201258e11, -6);
    }
    if (countAll.absorbedQuantumRatePerSecond.status === "value") {
      expect(countAll.absorbedQuantumRatePerSecond.value).toBeCloseTo(2.600629e11, -6);
    }
    if (countAll.ionizationRatePerSecond.status === "value") {
      expect(countAll.ionizationRatePerSecond.value).toBeCloseTo(2.600629e11, -6);
    }
    if (countAll.ionizedGramMolecules.status === "value") {
      expect(countAll.ionizedGramMolecules.value).toBeCloseTo(4.318446e-13, 18);
    }

    // Declared fraction a = 0.25
    const countFrac = ionizationCount({
      nu,
      ionizationEnergyEv: jEv,
      incidentPowerWatts: pOpt,
      absorptionEfficiency: eta,
      durationSeconds: 1.0,
      absorptionMode: "declared-fraction",
      declaredFraction: 0.25,
      set,
    });
    expect(countFrac.status).toBe("value");
    if (countFrac.ionizationRatePerSecond.status === "value") {
      expect(countFrac.ionizationRatePerSecond.value).toBeCloseTo(6.501572e10, -5);
    }

    // Unknown absorption mode
    const countUnk = ionizationCount({
      nu,
      ionizationEnergyEv: jEv,
      incidentPowerWatts: pOpt,
      absorptionEfficiency: eta,
      durationSeconds: 1.0,
      absorptionMode: "unknown",
      set,
    });
    expect(countUnk.status).toBe("underdetermined");
    expect(countUnk.ionizationRatePerSecond.status).toBe("underdetermined");
    if (countUnk.absorbedQuantaCount.status === "value") {
      expect(countUnk.absorbedQuantaCount.value).toBeCloseTo(2.600629e11, -6);
    }

    // Sub-threshold 9 eV gives not-applicable
    const nu9Ev = (9.0 * 1.602176634e-19) / 6.62607015e-34;
    const bSub = ionizationBounds({ nu: nu9Ev, ionizationEnergyEv: jEv, set });
    expect(bSub.singleQuantumAllowed).toBe(false);

    const countSub = ionizationCount({
      nu: nu9Ev,
      ionizationEnergyEv: jEv,
      incidentPowerWatts: pOpt,
      set,
    });
    expect(countSub.status).toBe("not-applicable");

    // Property test: seeded PRNG never reports more ions than absorbed quanta
    let seed = 42;
    function pseudoRandom() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
    for (let i = 0; i < 1000; i++) {
      const randNu = (2500 + pseudoRandom() * 2000) * 1e12;
      const randJ = 5 + pseudoRandom() * 5;
      const randP = (0.1 + pseudoRandom() * 10) * 1e-6;
      const randEta = pseudoRandom();
      const randFrac = pseudoRandom();

      const res = ionizationCount({
        nu: randNu,
        ionizationEnergyEv: randJ,
        incidentPowerWatts: randP,
        absorptionEfficiency: randEta,
        declaredFraction: randFrac,
        absorptionMode: "declared-fraction",
        set,
      });

      if (
        res.ionizationCountMolecules.status === "value" &&
        res.absorbedQuantaCount.status === "value"
      ) {
        expect(res.ionizationCountMolecules.value).toBeLessThanOrEqual(
          res.absorbedQuantaCount.value + 1e-9,
        );
      }
    }

    // Printed §9 checks
    const hist = einsteinPrintedIonizationChecks();
    expect(hist.lenardCheck.energyPerGramEquivalentErg).toBeCloseTo(6.384704e12, -7);
    expect(hist.lenardCheck.printedEnergyText).toBe("ca. 6,4 · 10^12 Erg");
    expect(hist.lenardCheck.potentialDifferenceVolts).toBeCloseTo(6.650734, 3);
    expect(hist.lenardCheck.historicalPerMoleculeEv).toBeCloseTo(6.458702, 3);
    expect(hist.lenardCheck.modernEnergyEvAt190nm).toBeCloseTo(6.525484, 4);

    expect(hist.starkCheck.energyPerGramEquivalentErg).toBe(9.6e12);
    expect(hist.starkCheck.sparkPotentialVolts).toBe(10);
  });

  it("AC 13: uncited metal and gas cards return outside-domain; visible-color boundaries are exact", () => {
    // Metal card
    const citedMetal = metalCard({
      metalName: "Sodium",
      workFunctionEv: 2.28,
      citation: "Millikan (1916), Phys. Rev. 7, 355",
      condition: "freshly cut in high vacuum",
    });
    expect(citedMetal.status).toBe("value");
    if (citedMetal.status === "value") {
      expect(citedMetal.value.label).toBe("cited");
    }

    const uncitedMetal = metalCard({
      metalName: "Sodium",
      workFunctionEv: 2.28,
      citation: "",
    });
    expect(uncitedMetal.status).toBe("outside-domain");
    if (uncitedMetal.status === "outside-domain") {
      expect(uncitedMetal.condition).toBe("uncited-metal");
      expect(uncitedMetal.reason).toBe(
        "a named metal requires a cited, condition-specific work function",
      );
    }

    // Gas card
    const citedGas = gasCard({
      gasName: "Helium",
      ionizationEnergyPerMoleculeEv: 24.587,
      citation: "NIST Atomic Spectra Database",
      condition: "ground state to He+",
    });
    expect(citedGas.status).toBe("value");
    if (citedGas.status === "value") {
      expect(citedGas.value.label).toBe("cited");
    }

    const uncitedGas = gasCard({
      gasName: "Helium",
      ionizationEnergyPerMoleculeEv: 24.587,
      citation: "",
    });
    expect(uncitedGas.status).toBe("outside-domain");
    if (uncitedGas.status === "outside-domain") {
      expect(uncitedGas.condition).toBe("uncited-gas");
      expect(uncitedGas.reason).toBe(
        "a named gas requires a cited ionizationEnergyPerMolecule with its conditions",
      );
    }

    // Visible-color boundaries
    // 380 nm to 750 nm vacuum wavelength -> 399.723 THz to 788.928 THz
    const c = 299792458;
    const nuRedEdge = c / 750e-9; // ~399.723 THz
    const nuVioletEdge = c / 380e-9; // ~788.928 THz

    const colRed = visibleColor(nuRedEdge);
    expect(colRed.status).toBe("visible");
    expect(colRed.band).toBe("red");

    const colViolet = visibleColor(nuVioletEdge);
    expect(colViolet.status).toBe("visible");
    expect(colViolet.band).toBe("violet");

    // 1000 THz -> UV (outside visible)
    const col1000 = visibleColor(1000e12);
    expect(col1000.status).toBe("outside-visible");
    expect(col1000.marker).toBe("outside-visible");
    expect(col1000.color).toBe("outside-visible");
    expect(col1000.band).toBe("ultraviolet");

    // 300 THz -> IR (outside visible)
    const col300 = visibleColor(300e12);
    expect(col300.status).toBe("outside-visible");
    expect(col300.marker).toBe("outside-visible");
    expect(col300.color).toBe("outside-visible");
    expect(col300.band).toBe("infrared");
  });
});
