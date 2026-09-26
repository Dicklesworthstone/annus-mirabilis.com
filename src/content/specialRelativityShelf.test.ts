/**
 * The relativity shelf's cards carry the evidence of their source checks (dispatch 251): every
 * source was read, on the page or in a catalog record, and the card says what the source says.
 */
import { describe, expect, test } from "bun:test";
import { sourceCheckProblems, uncheckedSources } from "../discovery/cards/sourceChecks.ts";
import { SPECIAL_RELATIVITY_SHELF_CARDS as CARDS } from "./specialRelativityShelf.ts";

describe("the relativity shelf's source checks", () => {
  test("every card has a well-formed check for each of its sources", () => {
    // Non-vacuity: an empty shelf would pass both lists below having checked nothing.
    expect(CARDS.length).toBeGreaterThan(0);
    expect(CARDS.flatMap((c) => sourceCheckProblems(c))).toEqual([]);
    expect(CARDS.filter((c) => uncheckedSources(c).length > 0).map((c) => c.id)).toEqual([]);
  });

  test("every source on this shelf was read on the page, not only in a catalog", () => {
    const catalogOnly = CARDS.filter(
      (c) => !(c.sourceChecks ?? []).some((k) => k.read === "page-image"),
    ).map((c) => c.id);
    expect(catalogOnly).toEqual([]);
  });

  test("the corrections the pages required hold", () => {
    const card = (id: string) => CARDS.find((c) => c.id === id);
    const title = (id: string) => (card(id)?.sources[0] as { title?: string } | undefined)?.title;
    // Proc. R. Acad. Amsterdam 6, 809 prints "smaller", not "less".
    expect(title("lorentz-1904-corresponding-states")).toContain("smaller than that of light");
    // The Scholium states absolute time; the simultaneity is the route's reading, in the limits.
    expect(card("newton-1687-absolute-time")?.proposition).not.toContain("at once");
    expect(card("newton-1687-absolute-time")?.limits).toContain("says nothing about simultaneity");
    // Lorentz's local time is not what a clock reads.
    expect(card("lorentz-1904-corresponding-states")?.proposition).not.toContain("clock");
    // The catalog dates Bradley's number 1728, and the letter is undated: a range.
    expect(card("bradley-1729-stellar-aberration")?.date).toMatchObject({
      earliest: "1728",
      latest: "1729",
      precision: "range",
    });
  });
});
