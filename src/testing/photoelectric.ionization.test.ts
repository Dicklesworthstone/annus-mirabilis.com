import { describe, expect, it, test } from "bun:test";
import { resolveQuantityId } from "../content/quantities/resolveQuantityId.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  einsteinPrintedIonizationChecks,
  ionizationBounds,
  ionizationCount,
} from "../physics/reference/photoelectric.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("LQ-09 Ionization Bounds & Counting Reference Evaluator (Paper 1, §9)", () => {
  const set = getConstantSet("modern-si-2019");

  it("evaluates modern golden fixture (h*nu = 12 eV, J_mol = 10 eV, P_opt = 1 uW, eta = 0.5)", () => {
    const nu = 2901.59e12; // 2901.59 THz -> h*nu ≈ 12 eV
    const jMolEv = 10.0;
    const pOpt = 1e-6; // 1 uW
    const eta = 0.5;
    const duration = 1.0;

    const bounds = ionizationBounds({
      nu,
      ionizationEnergyEv: jMolEv,
      set,
    });

    expect(bounds.status).toBe("value");
    expect(bounds.singleQuantumAllowed).toBe(true);
    expect(bounds.quantumEnergyEv).toBeCloseTo(12.0, 1);
    expect(bounds.excessEnergyEv).toBeCloseTo(2.0, 1);
    expect(bounds.thresholdFrequencyTHz).toBeCloseTo(2417.99, 1);

    const countRes = ionizationCount({
      nu,
      ionizationEnergyEv: jMolEv,
      incidentPowerWatts: pOpt,
      absorptionEfficiency: eta,
      durationSeconds: duration,
      absorptionMode: "all-absorbed-ionizes",
      set,
    });

    expect(countRes.status).toBe("value");
    expect(countRes.absorbedLightEnergyJoules).toBeCloseTo(0.5e-6, 12);

    // Incident quanta rate: ~ 5.20126e11 s^-1
    if (countRes.incidentQuantumRatePerSecond.status === "value") {
      expect(countRes.incidentQuantumRatePerSecond.value).toBeCloseTo(5.20126e11, -7);
    } else {
      expect(countRes.incidentQuantumRatePerSecond.status).toBe("value");
    }

    // Absorbed quanta rate: ~ 2.60063e11 s^-1
    if (countRes.absorbedQuantumRatePerSecond.status === "value") {
      expect(countRes.absorbedQuantumRatePerSecond.value).toBeCloseTo(2.60063e11, -7);
    }

    // Ionization rate under "all-absorbed-ionizes": 2.60063e11 s^-1
    if (countRes.ionizationRatePerSecond.status === "value") {
      expect(countRes.ionizationRatePerSecond.value).toBeCloseTo(2.60063e11, -7);
    }

    // Ionized count: 2.60063e11 molecules
    if (countRes.ionizationCountMolecules.status === "value") {
      expect(countRes.ionizationCountMolecules.value).toBeCloseTo(2.60063e11, -7);
    }

    // Ionized gram-molecules: 4.31845e-13 mol
    if (countRes.ionizedGramMolecules.status === "value") {
      expect(countRes.ionizedGramMolecules.value).toBeCloseTo(4.31845e-13, 17);
    }
  });

  it("handles declared fraction mode (a = 0.25)", () => {
    const nu = 2901.59e12;
    const jMolEv = 10.0;
    const pOpt = 1e-6;
    const eta = 0.5;

    const countRes = ionizationCount({
      nu,
      ionizationEnergyEv: jMolEv,
      incidentPowerWatts: pOpt,
      absorptionEfficiency: eta,
      durationSeconds: 1.0,
      absorptionMode: "declared-fraction",
      declaredFraction: 0.25,
      set,
    });

    expect(countRes.status).toBe("value");
    if (countRes.ionizationRatePerSecond.status === "value") {
      expect(countRes.ionizationRatePerSecond.value).toBeCloseTo(6.50157e10, -6);
    }
  });

  it("handles unknown absorption mode with underdetermined status and upper bound", () => {
    const nu = 2901.59e12;
    const jMolEv = 10.0;
    const pOpt = 1e-6;
    const eta = 0.5;

    const countRes = ionizationCount({
      nu,
      ionizationEnergyEv: jMolEv,
      incidentPowerWatts: pOpt,
      absorptionEfficiency: eta,
      durationSeconds: 1.0,
      absorptionMode: "unknown",
      set,
    });

    expect(countRes.status).toBe("underdetermined");
    expect(countRes.ionizationRatePerSecond.status).toBe("underdetermined");
    if (countRes.absorbedQuantaCount.status === "value") {
      expect(countRes.absorbedQuantaCount.value).toBeCloseTo(2.60063e11, -7);
    }
  });

  it("returns not-applicable count for sub-threshold frequency (h*nu = 9 eV, J_mol = 10 eV)", () => {
    // 9 eV -> nu = 2176.19 THz
    const nu = (9.0 * 1.602176634e-19) / 6.62607015e-34;
    const jMolEv = 10.0;

    const bounds = ionizationBounds({
      nu,
      ionizationEnergyEv: jMolEv,
      set,
    });
    expect(bounds.singleQuantumAllowed).toBe(false);

    const countRes = ionizationCount({
      nu,
      ionizationEnergyEv: jMolEv,
      incidentPowerWatts: 1e-6,
      absorptionEfficiency: 0.5,
      set,
    });

    expect(countRes.status).toBe("not-applicable");
    expect(countRes.ionizationRatePerSecond.status).toBe("not-applicable");
    if (countRes.ionizationRatePerSecond.status === "not-applicable") {
      expect(countRes.ionizationRatePerSecond.reason).toBe(
        "no single-quantum ionization under this hypothesis",
      );
    }
  });

  it("refuses uncited named gas with outside-domain", () => {
    const res = ionizationBounds({
      nu: 3000e12,
      ionizationEnergyEv: 10.0,
      gasCitation: { gasName: "Nitrogen", citation: "" },
      set,
    });
    expect(res.status).toBe("outside-domain");
    expect(res.refusalCode).toBe("uncited-gas");
  });

  it("scales rates with power and halves with frequency at fixed absorbed power", () => {
    const nu = 2901.59e12;
    const jMolEv = 10.0;

    const base = ionizationCount({
      nu,
      ionizationEnergyEv: jMolEv,
      absorbedPowerWatts: 1e-6,
      durationSeconds: 1.0,
      set,
    });

    const doublePower = ionizationCount({
      nu,
      ionizationEnergyEv: jMolEv,
      absorbedPowerWatts: 2e-6,
      durationSeconds: 1.0,
      set,
    });

    if (
      base.ionizationRatePerSecond.status === "value" &&
      doublePower.ionizationRatePerSecond.status === "value"
    ) {
      expect(doublePower.ionizationRatePerSecond.value).toBeCloseTo(
        base.ionizationRatePerSecond.value * 2,
        -5,
      );
    }

    const doubleNu = ionizationCount({
      nu: nu * 2,
      ionizationEnergyEv: jMolEv,
      absorbedPowerWatts: 1e-6,
      durationSeconds: 1.0,
      set,
    });

    if (
      base.ionizationRatePerSecond.status === "value" &&
      doubleNu.ionizationRatePerSecond.status === "value"
    ) {
      expect(doubleNu.ionizationRatePerSecond.value).toBeCloseTo(
        base.ionizationRatePerSecond.value / 2,
        -5,
      );
    }
  });

  it("property test: ions per absorbed quantum never exceeds 1 across random inputs", () => {
    for (let i = 0; i < 50; i++) {
      const nu = 2500e12 + Math.random() * 2000e12;
      const jMolEv = 5 + Math.random() * 5;
      const pOpt = (0.1 + Math.random() * 10) * 1e-6;
      const eta = Math.random();
      const frac = Math.random();

      const res = ionizationCount({
        nu,
        ionizationEnergyEv: jMolEv,
        incidentPowerWatts: pOpt,
        absorptionEfficiency: eta,
        declaredFraction: frac,
        absorptionMode: "declared-fraction",
        set,
      });

      if (
        res.ionizationCountMolecules.status === "value" &&
        res.absorbedQuantaCount.status === "value"
      ) {
        expect(res.ionizationCountMolecules.value).toBeLessThanOrEqual(
          res.absorbedQuantaCount.value + 1e-10,
        );
      }
    }
  });

  it("reproduces historical printed regression checks (Lenard and Stark)", () => {
    const hist = einsteinPrintedIonizationChecks();

    // Lenard check
    expect(hist.lenardCheck.energyPerGramEquivalentErg).toBeCloseTo(6.3847e12, -8);
    expect(hist.lenardCheck.printedEnergyText).toBe("ca. 6,4 · 10^12 Erg");
    expect(hist.lenardCheck.potentialDifferenceVolts).toBeCloseTo(6.65, 1);
    expect(hist.lenardCheck.printedPotentialText).toBe("ca. 6,6 Volt");
    expect(hist.lenardCheck.modernEnergyEvAt190nm).toBeCloseTo(6.5255, 3);
    expect(hist.lenardCheck.historicalPerMoleculeEv).toBeCloseTo(6.459, 2);

    // Stark check
    expect(hist.starkCheck.energyPerGramEquivalentErg).toBe(9.6e12);
    expect(hist.starkCheck.sparkPotentialVolts).toBe(10);
    expect(hist.starkCheck.thresholdWavelengthNm).toBeCloseTo(126.37, 1);

    // Within tolerance checks
    const tol1 = withinTolerance(hist.lenardCheck.potentialDifferenceVolts, 6.65077, {
      relative: 1e-4,
    });
    expect(tol1.ok).toBe(true);
    expect(tol1.kind).toBe("within");
  });

  test("glyph-scope and quantity registry binding tests", () => {
    // L in §9 binds absorbedLightEnergy
    const lRes = resolveQuantityId("absorbedLightEnergy");
    expect(lRes.ok).toBe(true);
    if (lRes.ok) {
      expect(lRes.quantity.id).toBe("absorbedLightEnergy");
    }

    // J_mol binds ionizationEnergyPerMolecule
    const jMolRes = resolveQuantityId("ionizationEnergyPerMolecule");
    expect(jMolRes.ok).toBe(true);
    if (jMolRes.ok) {
      expect(jMolRes.quantity.id).toBe("ionizationEnergyPerMolecule");
    }

    // Legacy spelling ionizationEnergy fails with canonical target in message
    const legacyRes = resolveQuantityId("ionizationEnergy");
    expect(legacyRes.ok).toBe(false);
    if (!legacyRes.ok) {
      expect(legacyRes.kind).toBe("legacy-spelling");
      if (legacyRes.kind === "legacy-spelling") {
        expect(legacyRes.canonicalIds).toContain("ionizationEnergyPerMolecule");
      }
    }
  });

  describe("photoelectric refusal throw sites (am-muyh)", () => {
    test("refusal (photoelectric.ts:1202): nonfinite-frequency rejects non-finite frequency", () => {
      // Accept: finite frequency
      const accepted = ionizationBounds({ nu: 1e15, ionizationEnergyEv: 2.0, set });
      expect(accepted.status).toBe("value");

      // Reject: NaN frequency
      const rejected = ionizationBounds({ nu: NaN, ionizationEnergyEv: 2.0, set });
      expect(rejected.status).toBe("outside-domain");
      expect(rejected.refusalCode).toBe("nonfinite-frequency");
    });

    test("refusal (photoelectric.ts:1221): nonpositive-frequency rejects non-positive frequency", () => {
      // Accept: positive frequency
      const accepted = ionizationBounds({ nu: 1e15, ionizationEnergyEv: 2.0, set });
      expect(accepted.status).toBe("value");

      // Reject: negative frequency
      const rejected = ionizationBounds({ nu: -1e14, ionizationEnergyEv: 2.0, set });
      expect(rejected.status).toBe("outside-domain");
      expect(rejected.refusalCode).toBe("nonpositive-frequency");
    });

    test("refusal (photoelectric.ts:1267): invalid-ionization-energy rejects negative ionizationEnergyEv", () => {
      // Accept: positive ionizationEnergyEv
      const accepted = ionizationBounds({ nu: 1e15, ionizationEnergyEv: 2.0, set });
      expect(accepted.status).toBe("value");

      // Reject: negative ionizationEnergyEv
      const rejected = ionizationBounds({ nu: 1e15, ionizationEnergyEv: -2.0, set });
      expect(rejected.status).toBe("outside-domain");
      expect(rejected.refusalCode).toBe("invalid-ionization-energy");
    });

    test("refusal (photoelectric.ts:1288): invalid-ionization-energy rejects negative ionizationEnergyJoules", () => {
      // Accept: positive ionizationEnergyJoules
      const accepted = ionizationBounds({ nu: 1e15, ionizationEnergyJoules: 3.2e-19, set });
      expect(accepted.status).toBe("value");

      // Reject: negative ionizationEnergyJoules
      const rejected = ionizationBounds({ nu: 1e15, ionizationEnergyJoules: -3.2e-19, set });
      expect(rejected.status).toBe("outside-domain");
      expect(rejected.refusalCode).toBe("invalid-ionization-energy");
    });

    test("refusal (photoelectric.ts:1308): missing-ionization-energy rejects omitted ionization energy", () => {
      // Accept: provided ionizationEnergyEv
      const accepted = ionizationBounds({ nu: 1e15, ionizationEnergyEv: 2.0, set });
      expect(accepted.status).toBe("value");

      // Reject: neither eV nor Joules provided
      const rejected = ionizationBounds({ nu: 1e15, set });
      expect(rejected.status).toBe("outside-domain");
      expect(rejected.refusalCode).toBe("missing-ionization-energy");
    });
  });
});
