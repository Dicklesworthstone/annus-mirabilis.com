import { describe, expect, it } from "bun:test";
import { evaluateBoundaryLedger, evaluateEnergySourceCard, systemLedger } from "./massEnergy.ts";

describe("massEnergy.boundary: system boundaries and conservation", () => {
  const c = 299792458;
  const cSq = c * c;

  function val(res: { status: string; value?: number | Float64Array }): number {
    expect(res.status).toBe("value");
    return res.value as number;
  }

  describe("the three system boundaries", () => {
    it("1. body alone (open to radiation): delta E = -L, delta m = -L/c^2", () => {
      const L = 100.0; // J
      const ledger = systemLedger({ include: "body-alone", emittedEnergy: L });

      expect(val(ledger.energyChange)).toBe(-100.0);
      expect(val(ledger.massChange)).toBeCloseTo(-100.0 / cSq, 25);
      expect(ledger.massChange.unit).toBe("kg");
      expect(ledger.massChange.quantityId).toBe("massChange");
    });

    it("2. radiation alone: delta E = +L, mass change is not applicable in 1905 kinematics", () => {
      const L = 100.0; // J
      const ledger = systemLedger({ include: "radiation", emittedEnergy: L });

      expect(val(ledger.energyChange)).toBe(100.0);
      expect(ledger.massChange.status).toBe("not-applicable");
      if (ledger.massChange.status === "not-applicable") {
        expect(ledger.massChange.reason).toContain(
          "Free radiation is not assigned an inertial rest mass",
        );
      }
    });

    it("3. combined isolated system: delta E = 0, delta m = 0", () => {
      const L = 100.0; // J
      const ledger = systemLedger({ include: ["body", "radiation"], emittedEnergy: L });

      expect(val(ledger.energyChange)).toBe(0);
      expect(val(ledger.massChange)).toBe(0);
      expect(val(ledger.systemEnergyChange)).toBe(0);
      expect(val(ledger.systemMassChange)).toBe(0);
    });
  });

  describe("heated sealed box (Einstein 1906, Ann. Phys. 20, 627)", () => {
    it("energy enters through leads without matter transfer: delta E = +Ein, delta m = +Ein/c^2", () => {
      const Ein = 500.0; // J
      const ledger = evaluateBoundaryLedger("combined-isolated-system", "retained", 1.0, Ein);

      expect(val(ledger.energyChange)).toBe(500.0);
      expect(val(ledger.massChange)).toBeCloseTo(500.0 / cSq, 25);
    });

    it("card verifies closed-but-not-isolated facts and citation", () => {
      const card = evaluateEnergySourceCard("me-03-heated-sealed-box");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(false);
      expect(card.boundary.radiation.disposition).toBe("retained");
      expect(card.boundary.closedButNotIsolated.value).toBe(true);
      expect(card.citation).toContain("Ann. Phys. 20, 627");
    });
  });

  describe("sealed lamp and mirror", () => {
    it("internal transfer: enclosure mass change is exactly 0", () => {
      const card = evaluateEnergySourceCard("me-03-sealed-lamp-and-mirror");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(false);
      expect(card.boundary.radiation.disposition).toBe("retained");
      expect(card.massChangeKg).toBe(0);
      expect(val(card.massChangeSigned)).toBe(0);
      expect(card.massChangeFormatted).toContain("0 (enclosure mass unchanged)");
    });
  });
});
