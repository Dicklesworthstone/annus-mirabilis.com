import { describe, expect, it } from "bun:test";
import {
  type EnergySourceCard,
  evaluateEnergySourceCard,
  MassEnergyError,
  ME03_CARD_IDS,
  validateEnergySourceCard,
} from "./massEnergy.ts";

describe("massEnergy.cards: cited energy-source cards and citation validation", () => {
  const cSq = 299792458 * 299792458;

  function val(res: { status: string; value?: number | Float64Array }): number {
    expect(res.status).toBe("value");
    return res.value as number;
  }

  describe("uncited card refusal (card-citation-missing)", () => {
    it("throws card-citation-missing when citation is empty or missing", () => {
      const cardWithoutCitation: Partial<EnergySourceCard> = {
        id: "me-03-card-coal",
        citation: "",
      };

      expect(() => validateEnergySourceCard(cardWithoutCitation)).toThrow();
      try {
        validateEnergySourceCard(cardWithoutCitation);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(MassEnergyError);
        expect((err as MassEnergyError).code).toBe("card-citation-missing");
      }
    });

    it("throws card-citation-missing through evaluateEnergySourceCard", () => {
      const invalidCard = {
        id: "me-03-card-coal" as const,
        label: "Coal",
        description: "Uncited coal",
        citation: "   ",
      };

      expect(() => evaluateEnergySourceCard(invalidCard as any)).toThrow();
      try {
        evaluateEnergySourceCard(invalidCard as any);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(MassEnergyError);
        expect((err as MassEnergyError).code).toBe("card-citation-missing");
      }
    });
  });

  describe("Radium-226 alpha decay", () => {
    it("computes ~5.23 mg/mol (0.0052292 u/decay) from Q = 4.871 MeV", () => {
      const card = evaluateEnergySourceCard("me-03-card-radium");
      expect(card.citation).toContain("NuDat 3.0");
      expect(card.boundary.energyFigure.value).toBe(4.871);
      expect(card.boundary.energyFigure.unit).toBe("MeV");
      expect(card.massChangeKg).toBeCloseTo(8.683e-30, 32);
      expect(card.massChangeFormatted).toContain("0.0052292 u/decay");
      expect(card.massChangeFormatted).toContain("5.229 mg/mol");
      expect(val(card.massChangeSigned)).toBeLessThan(0); // mass decrease
    });
  });

  describe("The Sun", () => {
    it("computes 4.259e9 kg/s from luminosity 3.828e26 W", () => {
      const card = evaluateEnergySourceCard("me-03-card-sun");
      expect(card.citation).toContain("IAU 2015");
      expect(card.boundary.energyFigure.value).toBe(3.828e26);
      expect(card.boundary.energyFigure.unit).toBe("W");
      expect(card.massChangeKg).toBeCloseTo(4259224414.57, 1);
      expect(card.massChangeFormatted).toContain("4.259 × 10^9 kg/s");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(true);
    });
  });

  describe("Burning coal (correction to plan: 0.27–0.39 ug/kg)", () => {
    it("heat of combustion 24 to 35 MJ/kg gives 2.670e-10 to 3.894e-10 kg/kg burned", () => {
      const card = evaluateEnergySourceCard("me-03-card-coal");
      expect(card.citation).toContain("CRC Handbook");
      expect(card.boundary.energyFigure.unit).toBe("MJ/kg");

      const minMass = 24e6 / cSq;
      const maxMass = 35e6 / cSq;

      expect(minMass).toBeCloseTo(2.670356e-10, 15);
      expect(maxMass).toBeCloseTo(3.894278e-10, 15);
      expect(card.massChangeFormatted).toContain("0.27–0.39 µg/kg");
      expect(card.massChangeFormatted).toContain("(2.670–3.894) × 10^-10 kg");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(true);
    });
  });

  describe("A burning candle", () => {
    it("80 W for 3600 s gives 3.20 ng mass loss", () => {
      const card = evaluateEnergySourceCard("me-03-card-candle");
      expect(card.citation).toContain("Sundström");
      expect(card.boundary.energyFigure.value).toBe(80.0);
      expect(card.massChangeKg).toBeCloseTo(3.20442e-12, 16);
      expect(card.massChangeFormatted).toContain("3.20 ng");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(true);
    });
  });

  describe("100 W light bulb for 1 Julian year", () => {
    it("365.25 days continuous electrical operation gives 35.1 ug mass loss", () => {
      const card = evaluateEnergySourceCard("me-03-card-bulb");
      expect(card.citation).toContain("BIPM SI Brochure");
      expect(card.massChangeKg).toBeCloseTo(3.51128e-8, 12);
      expect(card.massChangeFormatted).toContain("35.1 µg");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(false);
      expect(card.boundary.closedButNotIsolated.value).toBe(true);
    });
  });

  describe("completeness of all cards", () => {
    it("every registered card id evaluates with non-empty citation and valid boundary", () => {
      expect(ME03_CARD_IDS.length).toBe(7);
      for (const id of ME03_CARD_IDS) {
        const card = evaluateEnergySourceCard(id);
        expect(card.id).toBe(id);
        expect(card.citation.trim().length).toBeGreaterThan(15);
        expect(card.boundary.systemBefore.trim().length).toBeGreaterThan(0);
        expect(card.boundary.systemAfter.trim().length).toBeGreaterThan(0);
        expect(card.boundary.energyFigure.citationId.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
