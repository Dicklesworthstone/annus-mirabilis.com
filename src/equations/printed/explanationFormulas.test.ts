/**
 * The build's list of an explanation's formulas (explanationFormulas.ts) must be the page's: the
 * colour slots and the inspector's facts are made from it, and the page draws its formulas itself
 * (src/reader/explanationInlines.ts). If the two disagreed, a pinned glyph would have no facts, or a
 * quantity would get a slot for a formula the page leaves plain.
 */
import { describe, expect, test } from "bun:test";
import { COLOURED_EXPLANATION_PAPERS, explanationInline } from "../../reader/explanationInlines.ts";
import { explanationFormulas } from "./explanationFormulas.ts";

const ROOT = process.cwd();

describe("an explanation's formulas, as the build lists them", () => {
  test("every formula listed for a coloured paper is one the page draws in colour", () => {
    for (const paper of COLOURED_EXPLANATION_PAPERS) {
      const { formulas, quantities } = explanationFormulas(ROOT, paper);
      console.log(
        `[explanation formulas] ${paper}: ${formulas.length} formulas / ${Object.keys(quantities).length} quantities`,
      );
      expect(formulas.length).toBeGreaterThan(0);
      const disagree = formulas.filter(
        (f) => !explanationInline(f.latex, { paper, section: f.section, where: f.where })?.coloured,
      );
      expect(disagree).toEqual([]);
    }
  });

  test("each quantity carries its glyphs and the scope of its first use, as the facts expect", () => {
    const { quantities } = explanationFormulas(ROOT, "mass-energy");
    expect(quantities.speedOfLight).toEqual({
      glyphs: ["V"],
      scope: { anchor: "s0", section: "s0" },
    });
    for (const [id, use] of Object.entries(quantities))
      expect(use.glyphs.length, id).toBeGreaterThan(0);
  });

  test("a formula that does not resolve is not listed: mass-energy's ½mv² has no reading of m in § 0", () => {
    const { formulas } = explanationFormulas(ROOT, "mass-energy");
    expect(formulas.some((f) => /(^|[^a-z\\])m(?![a-z])/.test(f.latex))).toBe(false);
  });
});
