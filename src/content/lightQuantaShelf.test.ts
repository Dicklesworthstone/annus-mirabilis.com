/**
 * The light-quanta shelf's sources were read (dispatch 252). Each card records, in its own
 * `sourceChecks`, the scan or catalog record that was read, the day, and what matched; nothing
 * renders it. The checks land card by card, so the cards checked so far are named by id: a named
 * card that loses a check turns this red, and the list becomes the whole shelf when the last card
 * is read.
 */
import { describe, expect, test } from "bun:test";
import { sourceCheckProblems, uncheckedSources } from "../discovery/cards/sourceChecks.ts";
import { LIGHT_QUANTA_LATER_EVIDENCE, LIGHT_QUANTA_SHELF_CARDS } from "./lightQuantaShelf.ts";

const CARDS = [...LIGHT_QUANTA_SHELF_CARDS, ...LIGHT_QUANTA_LATER_EVIDENCE];

const CHECKED = [
  "equipartition-mean-resonator-energy",
  "stokes-1852-refrangibility",
  "rayleigh-1900-radiation-law",
  "thomson-1899-photoelectric-carrier",
  "planck-1901-energy-elements",
  "rubens-1901-long-wave-radiation",
  "wien-1896-radiation-law",
  "lenard-1902-photoelectric",
  "hertz-1887-ultraviolet-spark",
  "boltzmann-1896-gas-volume-entropy",
  "boltzmann-1877-entropy-probability",
  "millikan-1916-photoelectric-h",
];

/**
 * Cards whose source could not be read: their check records only a period citation, and says so
 * in its first words. Named by identity so that such a card is never mistaken for a checked one;
 * a card leaves this list when someone reads the article and records it.
 */
const NOT_READ = ["boltzmann-1877-entropy-probability"];

describe("the light-quanta shelf's source checks", () => {
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

  test("a card whose source was not read says so in its check", () => {
    for (const id of NOT_READ) {
      const checks = CARDS.find((c) => c.id === id)?.sourceChecks ?? [];
      expect(checks.length).toBeGreaterThan(0);
      for (const check of checks)
        expect(check.matched.startsWith("The article's text was not read")).toBe(true);
    }
  });

  test("each card named as checked is on the shelf and carries its checks", () => {
    for (const id of CHECKED) {
      const card = CARDS.find((c) => c.id === id);
      expect(card?.id).toBe(id);
      expect((card?.sourceChecks ?? []).length).toBeGreaterThan(0);
    }
  });
});
