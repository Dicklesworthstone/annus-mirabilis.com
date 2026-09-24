/**
 * Einstein's letters for a formula come from the notation concordance only where it is
 * unambiguous (notationForms.ts). Checked on the real special-relativity concordance and records.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import type { Expression } from "./ast.ts";
import { expressionLatex } from "./latex.ts";
import { printedLetters } from "./notationForms.ts";
import { recordQuantities } from "./printedGlyphs.ts";
import { teachingProfile } from "./teachingProfiles.ts";

const ROOT = process.cwd();
const table = teachingProfile("special-relativity")?.quantities ?? {};
const { entries } = loadConcordanceForPaper("special-relativity");
const tree = (id: string): Expression =>
  JSON.parse(readFileSync(join(ROOT, "content/equations/special-relativity", `${id}.json`), "utf8"))
    .tree;
const letters = (id: string, section: string) => printedLetters(tree(id), table, entries, section);
const printedLatex = (id: string, section: string) =>
  expressionLatex(
    tree(id),
    recordQuantities(
      table,
      Object.fromEntries(Object.entries(letters(id, section)).map(([q, l]) => [q, l.latex])),
    ),
  );

describe("printedLetters", () => {
  test("V for the speed of light and beta for the Lorentz factor, where one rename applies", () => {
    const l = letters("eq-model-sr-slow-clock", "s4");
    expect(l.speedOfLight?.latex).toBe("V");
    expect(l.lorentzFactor?.latex).toBe("\\beta");
    expect(printedLatex("eq-model-sr-slow-clock", "s4")).toBe(
      "1 - \\frac{1}{\\beta} \\approx \\frac{1}{2}\\,\\frac{v^{2}}{V^{2}}",
    );
    // The same tree with the table's letters is what readers see today.
    expect(expressionLatex(tree("eq-model-sr-slow-clock"), table)).toBe(
      "1 - \\frac{1}{\\gamma} \\approx \\frac{1}{2}\\,\\frac{v^{2}}{c^{2}}",
    );
  });

  test("a vector whose components Einstein printed as separate letters is left alone", () => {
    const l = letters("eq-model-sr-field-ey", "s6");
    expect(l.electricFieldStationary).toBeUndefined();
    expect(l.magneticFieldStationary).toBeUndefined();
    expect(printedLatex("eq-model-sr-field-ey", "s6")).toBe(
      "E'_{y} = \\beta\\,\\left(E_{y} - v\\,B_{z}\\right)",
    );
  });

  test("a quantity whose concordance target differs from the record's letter is left alone", () => {
    // The concordance renames phi to vartheta; the records and their prose print phi.
    expect(letters("eq-model-sr-aberration", "s7").propagationAngleStationary).toBeUndefined();
  });

  test("a quantity with no entry keeps its letter: never matched to an entry by its glyph", () => {
    // Kinetic energy prints K, the letter of Einstein's stationary system, whose rename is S.
    expect(letters("eq-model-sr-electron-work-result", "s10").kineticEnergy).toBeUndefined();
    expect(printedLatex("eq-model-sr-electron-work-result", "s10")).toBe(
      "K = \\mu\\,V^{2}\\,\\left(\\beta - 1\\right)",
    );
  });

  test("two entries for one quantity in one section: neither is taken, not even the first", () => {
    // The field and coordinate cases above are also refused by the target check, so this is the
    // case that holds the "exactly one" rule on its own: both entries pass the target check.
    const v = entries.find((e) => e.id === "sr.V.speedOfLight");
    expect(v).toBeDefined();
    const twin = {
      ...(v as NonNullable<typeof v>),
      id: "sr.C.speedOfLight",
      glyph: { unicode: "C", latex: "C" },
    };
    const l = printedLetters(tree("eq-model-sr-slow-clock"), table, [...entries, twin], "s4");
    expect(l.speedOfLight).toBeUndefined();
    expect(l.lorentzFactor?.latex).toBe("\\beta");
  });

  test("an entry applies only in its sections", () => {
    const l = letters("eq-model-sr-simultaneity-offset", "s2");
    expect(l.speedOfLight?.latex).toBe("V");
    expect(l.lorentzFactor).toBeUndefined();
  });

  test("every letter names the entry that gives it, and bindings are untouched", () => {
    for (const [quantityId, letter] of Object.entries(letters("eq-model-sr-velocity-y", "s5"))) {
      const entry = entries.find((e) => e.id === letter.entryId);
      expect(entry && "quantityId" in entry.binding ? entry.binding.quantityId : "").toBe(
        quantityId,
      );
      expect(entry?.glyph.latex).toBe(letter.latex);
    }
  });
});
