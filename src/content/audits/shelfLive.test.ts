/**
 * The shelf audit over the cards the journeys render (am-rc1001-bridge-plan-pcjk.12). This is its
 * proof in the unit lane; verify-content, the lane it gates, prints the same population.
 */
import { describe, expect, test } from "bun:test";
import { validateCardIntrinsicRules } from "../../discovery/cards/cardRules.ts";
import { JOURNEY_SHELVES, type JourneyShelf } from "../../discovery/cards/journeyCards.ts";
import type { KnowledgeCard } from "../../discovery/cards/types.ts";
import { BROWNIAN_SHELF_CARDS } from "../brownianShelf.ts";
import { cardDateAfter } from "../schemas/argument.ts";
import { auditLiveShelves } from "./shelfLive.ts";

const card = (over: Partial<KnowledgeCard>): KnowledgeCard => ({
  id: "planted-card",
  proposition: "A proposition for the shelf audit's own test.",
  status: "available",
  sources: [{ title: "A source", locator: "p. 1", date: "1900" }],
  date: {
    earliest: "1900",
    latest: "1900",
    precision: "year",
    latestYear: 1900,
    eventKind: "published",
  },
  ...over,
});

const withShelfCard = (extra: KnowledgeCard): JourneyShelf[] =>
  JOURNEY_SHELVES.map((s, i) => (i === 0 ? { ...s, shelf: [...s.shelf, extra] } : s));

describe("dates compare only as far as both are written", () => {
  test("a day inside the year it is compared with is not after it", () => {
    expect(cardDateAfter("1879-06-07", "1879")).toBe(false);
    expect(cardDateAfter("1879-06", "1879")).toBe(false);
    expect(cardDateAfter("1879", "1879-06-07")).toBe(false);
  });

  test("a genuinely later date is after, at every precision", () => {
    expect(cardDateAfter("1880-01-01", "1879")).toBe(true);
    expect(cardDateAfter("1879-07", "1879-06-30")).toBe(true);
    expect(cardDateAfter("1879-06-08", "1879-06-07")).toBe(true);
    expect(cardDateAfter("1879-06-07", "1879-06-08")).toBe(false);
  });
});

describe("the Nägeli card, refused by a string compare until 2026-10-02", () => {
  const naegeli = BROWNIAN_SHELF_CARDS.find((c) => c.id === "naegeli-1879-single-impacts");

  test("the real card passes: presented 7 June 1879, published 1879", () => {
    expect(naegeli?.priorEvent?.latest).toBe("1879-06-07");
    expect(naegeli?.date.latest).toBe("1879");
    expect(validateCardIntrinsicRules(naegeli as KnowledgeCard)).toEqual([]);
  });

  test("a prior event planted after publication is refused", () => {
    const real = naegeli as KnowledgeCard;
    const later: KnowledgeCard = {
      ...real,
      priorEvent: {
        eventKind: "presented",
        precision: "day",
        ...real.priorEvent,
        earliest: "1880-02-01",
        latest: "1880-02-01",
      },
    };
    expect(validateCardIntrinsicRules(later).map((d) => d.rule)).toContain(
      "card-prior-event-not-prior",
    );
  });
});

describe("the live shelf audit", () => {
  test("judges every card the four journeys render, and passes on the real corpus", () => {
    const live = auditLiveShelves();
    const rendered = JOURNEY_SHELVES.reduce(
      (n, s) => n + s.shelf.length + s.laterEvidence.length,
      0,
    );
    console.log(
      `[audit-shelf] examined ${live.cards} cards on ${live.shelves} shelves: ${live.report.errorCount} errors, ${live.report.flagCount} flags`,
    );
    // Measured 2026-10-02: 46 cards on 4 shelves. A floor, not a census.
    expect(live.cards).toBe(rendered);
    expect(live.cards).toBeGreaterThanOrEqual(46);
    expect(live.shelves).toBe(4);
    expect(live.report.population).toEqual({
      total: live.cards,
      judged: live.cards,
      notYetAuditable: 0,
    });
    expect(live.report.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(live.report.ok).toBe(true);
    // The flags are the later evidence, named as evidence and not premises.
    expect(new Set(live.report.findings.map((f) => f.check))).toEqual(
      new Set(["shelf-world-check-evidence"]),
    );
  });

  test("a card dated 1906 on a 1904 shelf, unflagged, turns it red", () => {
    const planted = card({
      id: "planted-1906-on-shelf",
      date: {
        earliest: "1906",
        latest: "1906",
        precision: "year",
        latestYear: 1906,
        eventKind: "published",
      },
    });
    const live = auditLiveShelves(withShelfCard(planted));
    expect(live.report.ok).toBe(false);
    const rules = live.report.findings.filter((f) => f.recordId === planted.id).map((f) => f.check);
    expect(rules).toContain("card-available-year-exceeded");
    expect(rules).toContain("shelf-date-violation");
  });

  test("a later-evidence card placed on a shelf is refused", () => {
    const planted = card({
      id: "planted-later-on-shelf",
      status: "later",
      date: {
        earliest: "1909",
        latest: "1909",
        precision: "year",
        latestYear: 1909,
        eventKind: "published",
      },
    });
    const live = auditLiveShelves(withShelfCard(planted));
    expect(live.report.ok).toBe(false);
    expect(
      live.report.findings.filter((f) => f.recordId === planted.id).map((f) => f.check),
    ).toContain("card-later-on-shelf");
  });

  test("no shelves is a failure, not a pass", () => {
    const live = auditLiveShelves([]);
    expect(live.cards).toBe(0);
    expect(live.report.ok).toBe(false);
  });
});
