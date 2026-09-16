import { describe, expect, test } from "bun:test";
import {
  evaluateEnergySourceCard,
  ME03_CARD_IDS,
  type Me03CardId,
} from "../physics/reference/massEnergy.ts";

describe("ME-03 energy source cards typed boundary validation", () => {
  test("all 7 real cards have complete 7 typed boundary fields without omission", () => {
    for (const cardId of ME03_CARD_IDS) {
      const card = evaluateEnergySourceCard(cardId);
      const b = card.boundary;

      expect(b.systemBefore).toBeDefined();
      expect(b.systemBefore.length).toBeGreaterThan(0);

      expect(b.systemAfter).toBeDefined();
      expect(b.systemAfter.length).toBeGreaterThan(0);

      expect(b.matterCrossesBoundary).toBeDefined();
      expect(typeof b.matterCrossesBoundary.crosses).toBe("boolean");
      expect(b.matterCrossesBoundary.note.length).toBeGreaterThan(0);

      expect(b.radiation).toBeDefined();
      expect(["escapes", "retained", "partly-retained"]).toContain(b.radiation.disposition);
      expect(b.radiation.note.length).toBeGreaterThan(0);

      expect(b.referenceFrame).toBeDefined();
      expect(b.referenceFrame.length).toBeGreaterThan(0);

      expect(b.energyFigure).toBeDefined();
      expect(b.energyFigure.value).toBeGreaterThan(0);
      expect(b.energyFigure.unit.length).toBeGreaterThan(0);
      expect(b.energyFigure.citationId.length).toBeGreaterThan(0);

      expect(b.closedButNotIsolated).toBeDefined();
      expect(typeof b.closedButNotIsolated.value).toBe("boolean");
      expect(b.closedButNotIsolated.note.length).toBeGreaterThan(0);
    }
  });

  test("contradictory combination: matterCrosses=true and closedButNotIsolated=true is rejected", () => {
    function validateBoundaryConsistency(cardId: Me03CardId): boolean {
      const card = evaluateEnergySourceCard(cardId);
      const b = card.boundary;
      if (b.matterCrossesBoundary.crosses && b.closedButNotIsolated.value) {
        throw new Error(
          `Card ${cardId} is invalid: a system where matter crosses the boundary cannot be closed.`,
        );
      }
      return true;
    }

    for (const cardId of ME03_CARD_IDS) {
      expect(validateBoundaryConsistency(cardId)).toBe(true);
    }
  });

  test("radium, bulb, heated-box, and sealed-lamp cards have closedButNotIsolated=true", () => {
    const closedCards: Me03CardId[] = [
      "me-03-card-radium",
      "me-03-card-bulb",
      "me-03-heated-sealed-box",
      "me-03-sealed-lamp-and-mirror",
    ];

    for (const id of closedCards) {
      const card = evaluateEnergySourceCard(id);
      expect(card.boundary.closedButNotIsolated.value).toBe(true);
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(false);
    }
  });

  test("sun, coal, and candle cards have matterCrossesBoundary=true and closedButNotIsolated=false", () => {
    const matterExchangeCards: Me03CardId[] = [
      "me-03-card-sun",
      "me-03-card-coal",
      "me-03-card-candle",
    ];

    for (const id of matterExchangeCards) {
      const card = evaluateEnergySourceCard(id);
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(true);
      expect(card.boundary.closedButNotIsolated.value).toBe(false);
    }
  });

  test("radiation.disposition is 'retained' for sealed-lamp and heated-box, and 'escapes' for others", () => {
    const retainedCards: Me03CardId[] = ["me-03-sealed-lamp-and-mirror", "me-03-heated-sealed-box"];

    const escapingCards: Me03CardId[] = [
      "me-03-card-radium",
      "me-03-card-sun",
      "me-03-card-coal",
      "me-03-card-candle",
      "me-03-card-bulb",
    ];

    for (const id of retainedCards) {
      expect(evaluateEnergySourceCard(id).boundary.radiation.disposition).toBe("retained");
    }

    for (const id of escapingCards) {
      expect(evaluateEnergySourceCard(id).boundary.radiation.disposition).toBe("escapes");
    }
  });
});
