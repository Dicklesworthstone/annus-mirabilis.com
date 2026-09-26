/**
 * The reading faces' inline formulas at build time (dispatch 272): paperInlines.ts. Where each
 * formula is read, the census every enforced paper must close, and the build refusing an unbound
 * glyph by the name of its block.
 */
import { describe, expect, test } from "bun:test";
import { loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import {
  assertInlinesPublishable,
  checkPaperInlines,
  ENFORCED_INLINE_PAPERS,
  InlineExceptionsError,
  paperInlineHolders,
  parseInlineExceptions,
  scopeKey,
} from "./paperInlines.ts";

describe("where each inline formula is read", () => {
  test("an English unit is read in its German block's scope, and displays are not inline formulas", async () => {
    const edition = await loadBilingualEdition("mass-energy");
    if (!edition) throw new Error("no mass-energy edition");
    const { holders, occurrences } = paperInlineHolders("mass-energy", edition);
    const german = scopeKey({ paper: "mass-energy", anchor: "s0-p5", section: "s0" });
    expect(holders["s0-p5"]).toBe(german);
    // Its sentences, which the gloss and the result cards quote, and the English unit of one.
    expect(holders["s0-p5-s2"]).toBe(german);
    expect(holders["s0-p5-s1"]).toBe(german);
    // An equation block's display is coloured by content/display-terms, on both faces.
    expect(holders["eq-s0-d1"]).toBeUndefined();
    expect(occurrences.some((o) => o.where === "eq-s0-d1")).toBe(false);
    expect(occurrences.filter((o) => o.face === "german").length).toBeGreaterThan(0);
    expect(occurrences.filter((o) => o.face === "english").length).toBeGreaterThan(0);
  });
});

describe("the census every enforced paper closes", () => {
  test("every inline formula is coloured or plain by declaration, none refused", async () => {
    // Non-vacuity: the gate covers at least the reference slice.
    expect(ENFORCED_INLINE_PAPERS).toContain("mass-energy");
    for (const paper of ENFORCED_INLINE_PAPERS) {
      const { census, problems } = await checkPaperInlines(process.cwd(), paper);
      // The denominator, printed: German and English formulas, and how each resolved.
      console.log(`inline census ${paper}: ${JSON.stringify(census)}`);
      expect(census.formulas).toBeGreaterThan(0);
      expect(census.formulas).toBe(census.german + census.english);
      expect(census.formulas).toBe(census.coloured + census.plainDeclared + census.refused);
      expect(problems.map((p) => p.message)).toEqual([]);
      expect(census.refused).toBe(0);
    }
  });
});

describe("the build refuses an unbound glyph by the name of its block", () => {
  test("the plant: a paragraph printing q, which the concordance does not read, stops the build", async () => {
    const edition = await loadBilingualEdition("mass-energy");
    if (!edition) throw new Error("no mass-energy edition");
    const planted = {
      blocks: [
        ...edition.blocks,
        {
          ...(edition.blocks.find((b) => b.id === "s0-p5") as (typeof edition.blocks)[number]),
          id: "s0-p99",
          inlines: [{ kind: "math" as const, latex: "q" }],
          sentenceSpans: [],
        },
      ],
      units: edition.units,
    };
    const paper = await checkPaperInlines(process.cwd(), "mass-energy", { edition: planted });
    expect(paper.census.refused).toBe(1);
    expect(() => assertInlinesPublishable([paper], ["mass-energy"])).toThrow(
      "inline-terms-build-refused",
    );
    expect(() => assertInlinesPublishable([paper], ["mass-energy"])).toThrow("s0-p99");
    // A paper not yet enforced is reported by the build, not stopped by it.
    expect(() => assertInlinesPublishable([paper], [])).not.toThrow();
  });

  test("relativity (dispatch 277): a letter read in one section is refused in another, by its block", async () => {
    // Relativity's letters change meaning by section: A is a point where a clock stands in §§ 1, 2
    // and 4 (listed by paragraph in content/inline-terms/exceptions.yaml) and the light amplitude in
    // §§ 7 and 8 (the concordance). § 3 prints no A, so a § 3 paragraph that did has no reading.
    expect(ENFORCED_INLINE_PAPERS).toContain("special-relativity");
    const edition = await loadBilingualEdition("special-relativity");
    if (!edition) throw new Error("no special-relativity edition");
    const base = await checkPaperInlines(process.cwd(), "special-relativity", { edition });
    // The fixture's footing: the paper as printed refuses nothing, and names a point and an
    // amplitude with the one letter.
    expect(base.census.refused).toBe(0);
    const reads = (anchor: string, section: string) =>
      base.formulas[`${scopeKey({ paper: "special-relativity", anchor, section })}\u0000A`];
    expect(reads("s1-p7", "s1")?.terms).toEqual([]);
    expect(
      Object.values(base.formulas).some((f) =>
        f.terms.some((t) => t.quantityId === "lightAmplitudeStationary" && t.glyph === "A"),
      ),
    ).toBe(true);
    const planted = {
      blocks: [
        ...edition.blocks,
        {
          ...(edition.blocks.find((b) => b.id === "s3-p1") as (typeof edition.blocks)[number]),
          id: "s3-p99",
          inlines: [{ kind: "math" as const, latex: "A" }],
          sentenceSpans: [],
        },
      ],
      units: edition.units,
    };
    const paper = await checkPaperInlines(process.cwd(), "special-relativity", {
      edition: planted,
    });
    expect(paper.census.refused).toBe(1);
    expect(paper.problems.map((p) => [p.code, p.where, p.glyph])).toEqual([
      ["inline-terms-unbound-glyph", "s3-p99", "A"],
    ]);
    expect(() => assertInlinesPublishable([paper], ENFORCED_INLINE_PAPERS)).toThrow("s3-p99");
  });
});

describe("the exceptions list is checked", () => {
  const good = {
    paper: "light-quanta",
    glyph: "\\pi",
    scope: ["all"],
    reason: "The number π, a ratio of lengths, not a quantity.",
  };
  const code = (raw: unknown) => {
    try {
      parseInlineExceptions(raw, "fixture");
      return "accepted";
    } catch (error) {
      return error instanceof InlineExceptionsError ? error.code : String(error);
    }
  };
  test("each rule refuses with its own code", () => {
    expect(code({ exceptions: [good] })).toBe("accepted");
    expect(code({ exceptions: "no" })).toBe("inline-exceptions-not-a-list");
    expect(code({ exceptions: [{ ...good, paper: "" }] })).toBe("inline-exceptions-no-paper");
    expect(code({ exceptions: [{ ...good, glyph: "2\\pi" }] })).toBe(
      "inline-exceptions-glyph-not-one-atom",
    );
    expect(code({ exceptions: [{ ...good, scope: [] }] })).toBe("inline-exceptions-no-scope");
    expect(code({ exceptions: [{ ...good, reason: "a number" }] })).toBe(
      "inline-exceptions-no-reason",
    );
  });
});
