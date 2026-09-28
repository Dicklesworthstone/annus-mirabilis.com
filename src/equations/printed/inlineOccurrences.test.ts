/**
 * ONE PARAGRAPH, ONE GLYPH, TWO MEANINGS (am-rse2).
 *
 * Relativity's s10-p10 prints "auf der X-Achse unter der Wirkung einer elektrostatischen Kraft X"
 * (plate of printed page 920, line 1: both italic capital X). The inline resolver keyed a reading by
 * paper, paragraph and section, so one paragraph could hold only one reading of "X": the axis was
 * drawn in the colour of `electricFieldStationary` and its inspector named the force. Colour
 * identifies meaning here, so that silently asserted the axis and the force were the same quantity.
 *
 * A math inline may now name the printing it is (`inlineId`), and a concordance entry may be scoped
 * to that printing, which outranks a paragraph-scoped entry. This asserts both the live sentence and
 * a plant that does not depend on it: a paragraph printing one glyph twice, read two ways.
 */
import { describe, expect, test } from "bun:test";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { checkPaperInlines, formulaKey, scopeKey } from "./paperInlines.ts";

const PAPER = "special-relativity";
const AXIS = "s10-p10-s2-m2";
const FORCE = "s10-p10-s2-m3";

describe("an inline reading can be scoped to one printing of a glyph", () => {
  test("relativity s10-p10: the axis is a label and the force four words later is coloured", async () => {
    const paper = await checkPaperInlines(process.cwd(), PAPER);
    expect(paper.census.refused).toBe(0);
    const scope = scopeKey({ paper: PAPER, anchor: "s10-p10", section: "s10" });
    const axis = paper.formulas[formulaKey(scope, "X", AXIS)];
    const force = paper.formulas[formulaKey(scope, "X", FORCE)];
    if (!axis || !force) throw new Error("the two X printings of s10-p10 have no render");
    // The axis binds no quantity, so it takes no quantity's colour; it carries the label a reader
    // can point at, as the axis of s10-p4 does.
    expect(axis.terms).toEqual([]);
    expect((axis.labels ?? []).length).toBeGreaterThan(0);
    // The force keeps its colour, in the same sentence.
    expect(force.terms.map((t) => t.quantityId)).toEqual(["electricFieldStationary"]);
    // And the two are different renders, which is the whole point.
    expect(axis.html).not.toBe(force.html);
  });

  test("the plant: one paragraph printing one glyph twice reads it two ways", async () => {
    const edition = await loadBilingualEdition(PAPER);
    if (!edition) throw new Error("no relativity edition");
    const model = edition.blocks.find((b) => b.id === "s10-p10");
    if (!model) throw new Error("no s10-p10 block to model the plant on");
    const planted = {
      blocks: [
        ...edition.blocks,
        {
          ...model,
          id: "s10-p98",
          inlines: [
            { kind: "math" as const, latex: "X", inlineId: "s10-p98-m1" },
            { kind: "text" as const, text: "-Achse und die Kraft " },
            { kind: "math" as const, latex: "X", inlineId: "s10-p98-m2" },
          ],
          sentenceSpans: [],
        },
      ],
      units: edition.units,
    };
    const concordance = loadConcordanceForPaper(PAPER).entries;
    const axisEntry = concordance.find((e) => e.id === "sr.X.axisLabelS10p10");
    if (!axisEntry) throw new Error("no occurrence-scoped axis entry to plant with");
    const withPlant = [
      ...concordance,
      { ...axisEntry, id: "sr.X.axisLabelPlant", scope: ["sr-s10-p98-m1"] },
    ];
    const paper = await checkPaperInlines(process.cwd(), PAPER, {
      edition: planted,
      concordance: withPlant,
    });
    const scope = scopeKey({ paper: PAPER, anchor: "s10-p98", section: "s10" });
    const first = paper.formulas[formulaKey(scope, "X", "s10-p98-m1")];
    const second = paper.formulas[formulaKey(scope, "X", "s10-p98-m2")];
    if (!first || !second) throw new Error("the planted printings have no render");
    expect(first.terms).toEqual([]);
    expect(second.terms.map((t) => t.quantityId)).toEqual(["electricFieldStationary"]);
    // Nothing else moved: the plant adds one paragraph and refuses nothing.
    expect(paper.census.refused).toBe(0);
    console.log(
      `[inline occurrences] planted paragraph: first X ${JSON.stringify(first.terms)}, second X ${second.terms.map((t) => t.quantityId).join(", ")}`,
    );
  });

  test("the plant's other direction: without the occurrence id both printings read the same", async () => {
    // The same paragraph with nothing naming its printings, which is what every other paragraph of
    // every paper still is. A run where this also came back as two readings would mean the first
    // test proves nothing about the occurrence scope.
    const edition = await loadBilingualEdition(PAPER);
    if (!edition) throw new Error("no relativity edition");
    const model = edition.blocks.find((b) => b.id === "s10-p10");
    if (!model) throw new Error("no s10-p10 block to model the plant on");
    const planted = {
      blocks: [
        ...edition.blocks,
        {
          ...model,
          id: "s10-p97",
          inlines: [
            { kind: "math" as const, latex: "X" },
            { kind: "text" as const, text: "-Achse und die Kraft " },
            { kind: "math" as const, latex: "X" },
          ],
          sentenceSpans: [],
        },
      ],
      units: edition.units,
    };
    const paper = await checkPaperInlines(process.cwd(), PAPER, { edition: planted });
    const scope = scopeKey({ paper: PAPER, anchor: "s10-p97", section: "s10" });
    const shared = paper.formulas[formulaKey(scope, "X")];
    if (!shared) throw new Error("the unnamed printings have no render");
    expect(shared.terms.map((t) => t.quantityId)).toEqual(["electricFieldStationary"]);
    // And there is exactly one render for that paragraph's X, not two.
    expect(
      Object.keys(paper.formulas).filter(
        (k) => k.includes("s10-p97") || k.startsWith(`${scope}\u0000`),
      ).length,
    ).toBe(1);
  });
});
