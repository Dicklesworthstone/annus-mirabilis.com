import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JOURNEY_CARDS } from "../../../scripts/check-shelf-publication.ts";
import { KnowledgeCardView } from "./KnowledgeCard.tsx";
import { isCardVerified } from "./publicationGate.ts";
import { AWAITING_MARKER, checkShelfPublication, VERIFIED_MARKER } from "./shelfPublication.ts";
import type { KnowledgeCard } from "./types.ts";

/**
 * The build's shelf publication gate (scripts/check-shelf-publication.ts, run by prepare:content).
 * This is its proof in the unit lane, apart from the prepare lane it controls, so a gate that
 * stopped running would still be caught here.
 */
const render = (card: KnowledgeCard) =>
  renderToStaticMarkup(createElement(KnowledgeCardView, { card }));

const base: KnowledgeCard = {
  id: "planted-card",
  proposition: "A proposition for the gate's own test.",
  status: "available",
  sources: [{ title: "A source", locator: "p. 1", date: "1900" }],
  date: {
    earliest: "1900",
    latest: "1900",
    precision: "year",
    latestYear: 1900,
    eventKind: "published",
  },
};
const journey = (card: KnowledgeCard) => [{ journey: "test-journey", cards: [card] }];

describe("the shelf publication gate the build runs", () => {
  test("no card the four journeys render shows verification status", () => {
    const result = checkShelfPublication(JOURNEY_CARDS, render);
    const cards = JOURNEY_CARDS.reduce((n, j) => n + j.cards.length, 0);
    // Non-empty on purpose: over no cards the gate would pass and have looked at nothing.
    expect(cards).toBeGreaterThan(0);
    expect(result.checked).toBe(cards);
    expect(result.verified + result.unverified).toBe(cards);
    expect(result.problems).toEqual([]);
  });

  test("a verifier's name and a locator with no verification date is refused, and shown with no status", () => {
    // Before this gate, isCardVerified took the card's publication date for a verification date,
    // so this card passed as verified and CardDetail printed "Verified by ... on undefined".
    const claim: KnowledgeCard = { ...base, verifier: "agent:Somebody", evidenceLocator: "p. 1" };
    expect(isCardVerified(claim)).toBe(false);
    const result = checkShelfPublication(journey(claim), render);
    expect(result.problems.map((p) => p.rule)).toEqual(["claims-unrecorded-verification"]);
    expect(render(claim)).not.toContain(AWAITING_MARKER);
    expect(render(claim)).not.toContain(VERIFIED_MARKER);
  });

  test("a rendering that says either marker is refused, the label the shelf used to print included", () => {
    for (const marker of [AWAITING_MARKER, VERIFIED_MARKER]) {
      const result = checkShelfPublication(journey(base), () => `<p>${marker}</p>`);
      expect(result.problems.map((p) => p.rule)).toEqual(["shows-verification-status"]);
    }
    // The real rendering of the same card passes, so each refusal above is the marker's.
    expect(checkShelfPublication(journey(base), render).problems).toEqual([]);
  });

  test("a verified card shows its locator as a source and never says it is verified", () => {
    const verified: KnowledgeCard = {
      ...base,
      verification: {
        verifiedBy: "A reviewer",
        verifierKind: "human",
        date: "2026-09-24",
        method: "library scan",
        evidenceLocator: "p. 1",
      },
    };
    const real = checkShelfPublication(journey(verified), render);
    expect(real.verified).toBe(1);
    expect(real.problems).toEqual([]);
    const shown = checkShelfPublication(journey(verified), () => `<p>${VERIFIED_MARKER}</p>`);
    expect(shown.problems.map((p) => p.rule)).toEqual(["shows-verification-status"]);
  });
});
