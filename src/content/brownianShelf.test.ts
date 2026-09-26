/**
 * The Brownian shelf's sources were read (dispatch 252). Each card records, in its own
 * `sourceChecks`, the scan or catalog record that was read, the day, and what matched; nothing
 * renders it. The checks land card by card, so the cards checked so far are named by id: a named
 * card that loses a check turns this red, and the list becomes the whole shelf when the last card
 * is read.
 */
import { describe, expect, test } from "bun:test";
import { sourceCheckProblems, uncheckedSources } from "../discovery/cards/sourceChecks.ts";
import { BROWNIAN_LATER_EVIDENCE, BROWNIAN_SHELF_CARDS } from "./brownianShelf.ts";

const CARDS = [...BROWNIAN_SHELF_CARDS, ...BROWNIAN_LATER_EVIDENCE];

const CHECKED = [
  "brown-1828-microscopical-observations",
  "stokes-1851-sphere-drag",
  "maxwell-1860-equipartition",
  "sutherland-1904-dunedin",
  "sutherland-1905-phil-mag",
  "fick-1855-diffusion-equation",
  "exner-1900-particle-speeds",
  "siedentopf-1903-ultramicroscope",
  "vant-hoff-1887-osmotic-gas-law",
  "naegeli-1879-single-impacts",
];

describe("the Brownian shelf's source checks", () => {
  test("every check on every card is well formed", () => {
    expect(CARDS.length).toBeGreaterThan(0);
    for (const card of CARDS) expect(sourceCheckProblems(card)).toEqual([]);
  });

  test("a card that records checks has checked every one of its sources", () => {
    const withChecks = CARDS.filter((card) => (card.sourceChecks ?? []).length > 0);
    // Not vacuous: at least the named cards below carry checks.
    expect(withChecks.length).toBeGreaterThan(0);
    for (const card of withChecks) expect([card.id, uncheckedSources(card)]).toEqual([card.id, []]);
  });

  test("each card named as checked is on the shelf and carries its checks", () => {
    for (const id of CHECKED) {
      const card = CARDS.find((c) => c.id === id);
      expect(card?.id).toBe(id);
      expect((card?.sourceChecks ?? []).length).toBeGreaterThan(0);
    }
  });

  test("the Dunedin paper of January 1904 is not credited with the slip correction of 1905", () => {
    // The printed Dunedin paper (Report, pp. 117-121) has no slip term; the correction first
    // appears in the June 1905 Philosophical Magazine paper. The shelf said otherwise until
    // dispatch 252.
    const dunedin = CARDS.find((c) => c.id === "sutherland-1904-dunedin");
    expect(dunedin?.proposition).not.toMatch(/slip/i);
    expect(dunedin?.limits).toMatch(/No correction for slip/);
    expect(CARDS.find((c) => c.id === "sutherland-1905-phil-mag")?.proposition).toMatch(/slip/);
  });
});
