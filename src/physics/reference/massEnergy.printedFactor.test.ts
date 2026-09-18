import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { loadScenarioFile } from "../../testing/scenario-registry/load.ts";
import { runScenariosIsolated } from "../../testing/scenario-registry/run.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { assertSameSet, ConstantSetError, constantValue, getConstantSet } from "./constants.ts";
import {
  C_CGS,
  MASS_ENERGY_PRINTED_FACTOR_SCENARIO,
  PRINTED_FACTOR_WORDING,
  PRINTED_V_SQUARED_ERG_PER_GRAM,
  printedMassConversion,
} from "./massEnergy.ts";

describe("massEnergy.printedFactor: printed vs modern conversion and cross-set separation", () => {
  describe("historical fixtures", () => {
    it("L = 9e20 erg (9e13 J) gives exactly 1 g printed and 1.0013851 g modern", () => {
      const res = printedMassConversion({ emittedEnergyErg: 9e20 });
      expect(res.status).toBe("value");
      expect(res.scenarioId).toBe(MASS_ENERGY_PRINTED_FACTOR_SCENARIO);

      // Printed: 9e20 erg / 9e20 (erg/g) = 1 g
      expect(res.printed.value).toBe(1.0);
      expect(res.printed.unit).toBe("g");
      expect(res.printed.constantSetId).toBe("einstein-1905-mass-energy-printed");
      expect(res.printed.entryLabels).toContain("speedOfLightSquared (printed: 9e20 erg/g)");

      // Modern: 9e20 erg / (2.99792458e10)^2 = 1.0013850505... g
      expect(res.modern.value).toBeCloseTo(1.0013851, 7);
      expect(res.modern.unit).toBe("g");
      expect(res.modern.constantSetId).toBe("modern-si-2019");
      expect(res.modern.entryLabels).toContain("speedOfLight (defined: 299792458 m/s)");

      // Comparison record
      expect(res.comparison.leftSetId).toBe("modern-si-2019");
      expect(res.comparison.rightSetId).toBe("einstein-1905-mass-energy-printed");
      expect(res.comparison.ratioModernToPrinted).toBeCloseTo(1.00138505, 8);
      expect(res.comparison.wording).toBe(PRINTED_FACTOR_WORDING);
    });

    it("L = 10^7 erg (1 J) gives 1.1111111e-14 g printed and 1.1126501e-14 g modern", () => {
      const res = printedMassConversion({ emittedEnergyJoules: 1.0 });
      expect(res.status).toBe("value");

      // Printed: 1e7 / 9e20 = (1/9) * 1e-13 = 1.1111111e-14 g
      expect(res.printed.value).toBeCloseTo(1.1111111e-14, 21);

      // Modern: 1e7 / (2.99792458e10)^2 = 1.1126501e-14 g
      expect(res.modern.value).toBeCloseTo(1.1126501e-14, 21);

      // Ratio is unchanged
      expect(res.comparison.ratioModernToPrinted).toBeCloseTo(1.00138505, 8);
    });
  });

  describe("ratio at 50 log-spaced energies from 1e-3 J to 1e20 J", () => {
    it("preserves exact ratio 9e20 / c_cgs^2 for all energies", () => {
      const cSqCgs = C_CGS * C_CGS;
      const expectedRatio = PRINTED_V_SQUARED_ERG_PER_GRAM / cSqCgs;

      for (let i = 0; i < 50; i++) {
        const exponent = -3 + (i / 49) * 23; // from -3 to 20
        const energyJ = 10 ** exponent;
        const res = printedMassConversion({ emittedEnergyJoules: energyJ });

        expect(res.status).toBe("value");
        expect(
          withinTolerance(res.comparison.ratioModernToPrinted, expectedRatio, { relative: 1e-12 })
            .ok,
        ).toBe(true);
        expect(
          withinTolerance(res.modern.value / res.printed.value, expectedRatio, { relative: 1e-12 })
            .ok,
        ).toBe(true);
      }
    });
  });

  describe("mixing guard throw on direct cross-set arithmetic", () => {
    it("assertSameSet throws constant-set-mismatch when combining constants from different sets", () => {
      const modernC = constantValue(getConstantSet("modern-si-2019"), "speedOfLight");
      const codataM = constantValue(getConstantSet("modern-codata-2022"), "electronMass");

      expect(() => assertSameSet(modernC, codataM)).toThrow();
      try {
        assertSameSet(modernC, codataM);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ConstantSetError);
        expect((err as ConstantSetError).code).toBe("constant-set-mismatch");
        expect((err as ConstantSetError).message).toContain("Cannot combine");
      }
    });
  });

  describe("domain checks (L <= 0)", () => {
    it("refuses L = 0 with outside-domain", () => {
      const res = printedMassConversion({ emittedEnergyJoules: 0 });
      expect(res.status).toBe("outside-domain");
      expect(res.condition).toBe("L > 0");
    });

    it("refuses L < 0 with outside-domain", () => {
      const res = printedMassConversion({ emittedEnergyJoules: -10 });
      expect(res.status).toBe("outside-domain");
      expect(res.condition).toBe("L > 0");
    });

    it("refuses NaN and nonfinite with outside-domain", () => {
      const res = printedMassConversion({ emittedEnergyJoules: Number.NaN });
      expect(res.status).toBe("outside-domain");
    });
  });

  describe("adversarial: modern c^2 does NOT reproduce printed 1 g", () => {
    it("fails by 1.385e-3 relative (0.1385%)", () => {
      const res = printedMassConversion({ emittedEnergyErg: 9e20 });
      const printedG = res.printed.value;
      const modernG = res.modern.value;

      const relDifference = (modernG - printedG) / printedG;
      expect(relDifference).toBeCloseTo(1.38505e-3, 5);
      expect(relDifference).toBeGreaterThan(1.38e-3);
      expect(relDifference).toBeLessThan(1.39e-3);
    });
  });

  describe("historical scenario fixture file integration", () => {
    it("mass-energy-printed-factor.yaml scenario loads and passes evaluation with 1 g printed output", () => {
      const scenarioPath = fileURLToPath(
        new URL("../../../content/scenarios/mass-energy-printed-factor.yaml", import.meta.url),
      );
      const loaded = loadScenarioFile(scenarioPath);
      expect(loaded.scenario.id).toBe(MASS_ENERGY_PRINTED_FACTOR_SCENARIO);
      expect(loaded.scenario.kind).toBe("historical-fixture");
      expect(loaded.scenario.owner).toBe("mass-energy");
      expect(loaded.scenario.constantSetId).toBe("einstein-1905-mass-energy-printed");

      const { results } = runScenariosIsolated([loaded]);
      expect(results.length).toBe(1);
      expect(results[0]?.status).toBe("passed");
      expect(results[0]?.scenarioId).toBe(MASS_ENERGY_PRINTED_FACTOR_SCENARIO);
    });
  });
});
