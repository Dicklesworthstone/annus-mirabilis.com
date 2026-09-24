import { describe, expect, test } from "bun:test";
import { loadAllConcordances } from "./loader.ts";

/**
 * am-ep-equations-y76: "raw $LaTeX$ never reaches a reader". The notation page renders each
 * entry's meaning and notes, and each modern-only symbol's label, as plain text
 * (NotationEntryCard, CollisionClusterView, ModernOnlySymbolsView), so LaTeX written there
 * reaches the reader verbatim. A sweep of every sitemap page on live 01478983 found exactly that
 * on /notation/: "10^{-8} V" and "rendered as \ln", from two notes (fixed in 363ab320). Glyphs
 * are LaTeX by design and are not read here.
 */

/** A backslash command, a braced script, or a $...$ span (not a price: "$5 and $6" is not one). */
const LATEX = /\\[A-Za-z]+|\^\{|_\{|\$[^$\s](?:[^$]*[^$\s])?\$(?!\d)/g;
const latexIn = (text: string) => [...text.matchAll(LATEX)].map((m) => m[0]);

const concordances = loadAllConcordances();
const fields = concordances.flatMap((c) => [
  ...c.entries.flatMap((e) => [
    { where: `${e.id}.meaning`, text: e.meaning },
    ...(e.notes === undefined ? [] : [{ where: `${e.id}.notes`, text: e.notes }]),
  ]),
  ...(c.modernOnlySymbols ?? []).map((s) => ({ where: `${s.id}.label`, text: s.label })),
]);

describe("notation text a reader sees as plain text holds no LaTeX", () => {
  test("every meaning, note and modern-only label", () => {
    // Non-vacuity: every paper's concordance loaded, and it has notes as well as meanings.
    expect(concordances.length).toBeGreaterThanOrEqual(4);
    expect(fields.some((f) => f.where.endsWith(".notes"))).toBe(true);
    const found = fields
      .map((f) => ({ where: f.where, latex: latexIn(f.text) }))
      .filter((f) => f.latex.length > 0);
    expect(found).toEqual([]);
  });

  test("the pattern finds the two strings the live sweep found, and passes their repairs", () => {
    expect(latexIn("Conventional factor: 1 abV ↔ 10^{-8} V.")).toEqual(["^{"]);
    expect(latexIn("rendered as \\ln in modern standards.")).toEqual(["\\ln"]);
    expect(latexIn("with $x_1$ held")).toEqual(["$x_1$"]);
    expect(latexIn("Conventional factor: 1 abV ↔ 10⁻⁸ V.")).toEqual([]);
    expect(latexIn("written ln in modern standards; costs $5 and $6")).toEqual([]);
  });
});
