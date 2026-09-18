import { describe, expect, it } from "bun:test";
import {
  evaluateMe01,
  evaluateSubtraction,
  kineticIdentification,
  ledgers,
  MassEnergyError,
  subtractLedgers,
} from "./massEnergy.ts";

describe("massEnergy.ledgers: balances, subtraction move, premise provenance, and observer changes", () => {
  const _TOLERANCE = 1e-12;

  function val(res: { status: string; value?: number | Float64Array }): number {
    expect(res.status).toBe("value");
    return res.value as number;
  }

  describe("rest and moving energy balances", () => {
    it("rest frame balance: E0 - E1 = L", () => {
      const res = ledgers(10.0, 0.6);
      expect(res.status).toBe("value");
      expect(val(res.restBalance)).toBe(10.0);
      expect(res.restBalanceLight).toBe(10.0);
    });

    it("moving frame balance: H0 - H1 = gamma * L (1.25L at beta = 0.6)", () => {
      const res = ledgers(10.0, 0.6);
      expect(res.status).toBe("value");
      expect(val(res.movingBalance)).toBeCloseTo(12.5, 12);
      expect(res.movingBalanceLight).toBeCloseTo(12.5, 12);
      expect(res.lorentzFactor).toBeCloseTo(1.25, 12);
    });

    it("vanishing speed: both balances equal L", () => {
      const res = ledgers(10.0, 0);
      expect(res.status).toBe("value");
      expect(val(res.restBalance)).toBe(10.0);
      expect(val(res.movingBalance)).toBe(10.0);
      expect(res.lorentzFactor).toBe(1.0);
    });
  });

  describe("subtraction move: (H0 - E0) - (H1 - E1) = L * (gamma - 1)", () => {
    it("at beta = 0.6: subtraction gives 0.25L", () => {
      const res = subtractLedgers(1.0, 0.6);
      expect(res.status).toBe("value");
      expect(val(res.subtractionDifference)).toBeCloseTo(0.25, 12);
      expect(res.differenceValue).toBeCloseTo(0.25, 12);
      expect(res.operations.length).toBeGreaterThan(2);
      expect(res.cancellations.additiveConstant).toBe(true);
      expect(res.cancellations.angleFactors).toBe(true);
      expect(res.cancellations.internalEnergies).toBe(true);
    });

    it("at beta = 0: subtraction gives 0", () => {
      const res = subtractLedgers(1.0, 0);
      expect(res.status).toBe("value");
      expect(val(res.subtractionDifference)).toBe(0);
      expect(res.differenceValue).toBe(0);
    });

    it("evaluates subtraction kernel function across premises", () => {
      const resUnchanged = evaluateSubtraction(1.0, 0.6, 0, "unchanged");
      expect(resUnchanged.subtractionValue).toBeCloseTo(0.25, 12);
      expect(resUnchanged.kineticDifference).toBe(resUnchanged.subtractionValue);

      const resRelaxed = evaluateSubtraction(1.0, 0.6, 0, "relaxed");
      expect(resRelaxed.subtractionValue).toBeCloseTo(0.25, 12);
      expect(resRelaxed.kineticDifference).toBeNull();
    });
  });

  describe("premise presence and provenance in kinetic identification", () => {
    it("additive-constant premise is present in every kinetic identification result", () => {
      const res = kineticIdentification(1.0, 0.6, "unchanged");
      expect(res.status).toBe("value");
      expect(res.premise).toBeDefined();
      expect(res.premise.id).toBe("premise-additive-constant");
      expect(res.premise.provenance).toBe(
        "asserted in the paper; the cancellation does not derive it",
      );
      expect(res.premise.statement).toContain("H - E = K + C");
      expect(res.premise.status).toBe("asserted");
      expect(val(res.kineticEnergyDifference)).toBeCloseTo(0.25, 12);
      expect(res.additiveEnergyConstant.status).toBe("symbolic");
      if (res.additiveEnergyConstant.status === "symbolic") {
        expect(res.additiveEnergyConstant.unspecifiedSymbols).toContain("C");
      }
    });

    it("relaxed premise produces underdetermined kinetic difference with premise present", () => {
      const res = kineticIdentification(1.0, 0.6, "relaxed");
      expect(res.status).toBe("underdetermined");
      expect(res.premise).toBeDefined();
      expect(res.premise.id).toBe("premise-additive-constant");
      expect(res.premise.status).toBe("relaxed");
      expect(res.kineticEnergyDifference.status).toBe("underdetermined");
      if (res.kineticEnergyDifference.status === "underdetermined") {
        expect(res.kineticEnergyDifference.compatibleFamily).toContain("kinetic-difference");
        expect(res.kineticEnergyDifference.neededInformation).toContain(
          "additive-constant-invariance-under-emission",
        );
      }
    });

    it("premise is present even on refusal / outside-domain", () => {
      const resOutside = kineticIdentification(1.0, 1.5, "unchanged");
      expect(resOutside.status).toBe("outside-domain");
      expect(resOutside.premise).toBeDefined();
      expect(resOutside.premise.id).toBe("premise-additive-constant");
    });

    it("supplying numeric absolute rest energy throws absolute-energy-not-admitted", () => {
      expect(() =>
        kineticIdentification(1.0, 0.6, "unchanged", { restEnergyBefore: 100 }),
      ).toThrow();
      try {
        kineticIdentification(1.0, 0.6, "unchanged", { restEnergyBefore: 100 });
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(MassEnergyError);
        expect((err as MassEnergyError).code).toBe("absolute-energy-not-admitted");
      }
    });
  });

  describe("observer-change identity", () => {
    it("changing frame speed re-describes the same emission without altering rest balance", () => {
      const snap1 = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.1,
        emissionAngle: 45,
      });

      const snap2 = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.8,
        emissionAngle: 45,
      });

      // Rest balance is invariant under observer boost
      expect(val(snap1.restBalanceLight)).toBe(val(snap2.restBalanceLight));
      expect(val(snap1.restBalanceLight)).toBe(1.0);

      // Rest energies remain symbolic across observers
      expect(snap1.restBodyBefore.status).toBe("symbolic");
      expect(snap2.restBodyBefore.status).toBe("symbolic");
      expect(snap1.movingBodyBefore.status).toBe("symbolic");
      expect(snap2.movingBodyBefore.status).toBe("symbolic");
    });
  });
});
