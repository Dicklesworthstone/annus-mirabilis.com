/**
 * The mass-energy shelf's cards, and its later evidence, carry the evidence of their source checks
 * (dispatch 251): every source was read, on the page or in a catalog record, and a card whose text
 * could not be read says so in its check rather than passing for one that was.
 */
import { describe, expect, test } from "bun:test";
import { sourceCheckProblems, uncheckedSources } from "../discovery/cards/sourceChecks.ts";
import { MASS_ENERGY_LATER_EVIDENCE, MASS_ENERGY_SHELF_CARDS } from "./massEnergyShelf.ts";

const CARDS = [...MASS_ENERGY_SHELF_CARDS, ...MASS_ENERGY_LATER_EVIDENCE];

describe("the mass-energy shelf's source checks", () => {
  test("every card has a well-formed check for each of its sources", () => {
    // Non-vacuity: an empty shelf would pass both lists below having checked nothing.
    expect(CARDS.length).toBeGreaterThan(0);
    expect(CARDS.flatMap((c) => sourceCheckProblems(c))).toEqual([]);
    expect(CARDS.filter((c) => uncheckedSources(c).length > 0).map((c) => c.id)).toEqual([]);
  });

  test("a card checked only in a catalog says its text was not read, and these are the ones", () => {
    const catalogOnly = CARDS.filter(
      (c) => !(c.sourceChecks ?? []).some((k) => k.read === "page-image"),
    );
    // Identity, not census: the four sources no scan with open terms could be found for, on
    // 2026-09-26. Reading one on the page moves it out of this list.
    expect(catalogOnly.map((c) => c.id)).toEqual([
      "lebedev-1901-radiation-pressure-measured",
      "thomson-1881-electromagnetic-mass",
      "cockcroft-walton-1932-lithium",
      "bainbridge-1933-mass-spectrograph",
    ]);
    const silent = catalogOnly.filter(
      (c) => !(c.sourceChecks ?? []).every((k) => k.matched.includes("text was not read")),
    );
    expect(silent.map((c) => c.id)).toEqual([]);
  });

  test("the corrections the pages required hold", () => {
    const card = (id: string) => CARDS.find((c) => c.id === id);
    const locator = (id: string) =>
      (card(id)?.sources[0] as { locator?: string } | undefined)?.locator;
    // §§ 792-793 speak of a pressure, not of momentum.
    expect(card("maxwell-1873-radiation-pressure")?.proposition).not.toContain("momentum");
    // § 8 begins on p. 913.
    expect(locator("einstein-1905-light-complex-transformation")).toContain("913-914");
    // The kinetic energy is § 213, a definition with no restriction on speed.
    expect(locator("thomson-tait-1867-kinetic-energy")).toContain("§ 213");
    expect(card("thomson-tait-1867-kinetic-energy")?.proposition).not.toContain("slowly");
  });
});
