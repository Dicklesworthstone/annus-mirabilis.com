/**
 * ONE NAME, ONE ID, WHICHEVER PASS DRAWS IT (dispatch 280, step 1b).
 *
 * A reading face resolves its formulas at build time and an explanation panel resolves its own as
 * the page renders, and both print on one page: relativity's § 8 prints k in the source paragraph
 * and again in the panel that explains its display. Pointing at either must light both, so the id
 * is derived from the reading and the section, not counted. These hold the derivation to that, and
 * hold the notes to saying one thing per name.
 */
import { describe, expect, test } from "bun:test";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import { loadDisplayTerms } from "./displayTerms.ts";
import {
  InlineLabelsError,
  inlineLabelId,
  inlineLabelNotes,
  paperLabelNotes,
  paperSections,
  signSource,
} from "./inlineLabels.ts";
import type { InlineException } from "./inlineTerms.ts";

const entry = (id: string, scope: string[], meaning: string, latex = "K"): ConcordanceEntry =>
  ({
    id,
    scope,
    glyph: { unicode: latex, latex, variant: "plain" },
    meaning,
    binding: { nonQuantityKind: "coordinate-system-label" },
  }) as unknown as ConcordanceEntry;

const exception = (paper: string, glyph: string, scope: string[], note: string): InlineException =>
  ({
    paper,
    glyph,
    scope,
    reason: `${glyph} names no quantity here, and is left in the ink.`,
    note,
  }) as InlineException;

describe("the id a name is drawn under", () => {
  test("the same reading in the same section, every time; a different section, a different id", () => {
    expect(inlineLabelId("sr.k.movingSystem", "s8")).toBe(inlineLabelId("sr.k.movingSystem", "s8"));
    expect(inlineLabelId("sr.k.movingSystem", "s8")).not.toBe(
      inlineLabelId("sr.k.movingSystem", "s3"),
    );
    expect(inlineLabelId("sr.K.stationarySystem", "s8")).not.toBe(
      inlineLabelId("sr.k.movingSystem", "s8"),
    );
    // Short, because it is printed once per marked letter on a face held to a byte budget.
    expect(inlineLabelId("sr.k.movingSystem", "s8").length).toBeLessThanOrEqual(9);
    expect(inlineLabelId("sr.k.movingSystem", "s8").startsWith("L")).toBe(true);
  });

  test("relativity's real names, read from its own notation, are all distinct", () => {
    const concordance = loadConcordanceForPaper("special-relativity").entries;
    const sections = paperSections(concordance);
    // Not vacuous: the paper has sections, and names to read in them.
    expect(sections).toContain("s8");
    const declared = concordance.filter((e) => !("quantityId" in e.binding));
    expect(declared.length).toBeGreaterThan(0);
    const ids = declared.flatMap((e) => sections.map((s) => inlineLabelId(e.id, s)));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("what each name says", () => {
  test("a declared entry says its meaning, in each section it holds in, and nowhere else", () => {
    const notes = inlineLabelNotes(
      "special-relativity",
      [entry("sr.k.movingSystem", ["sr-s3", "sr-s8"], "The moving coordinate system", "k")],
      [],
    );
    expect(notes[inlineLabelId("sr.k.movingSystem", "s3")]).toBe("The moving coordinate system");
    expect(notes[inlineLabelId("sr.k.movingSystem", "s8")]).toBe("The moving coordinate system");
    expect(notes[inlineLabelId("sr.k.movingSystem", "s5")]).toBeUndefined();
  });

  test("a sign says what the paper already says of that glyph, and its own reason only where nothing does", () => {
    const concordance = [entry("sr.pseudo", ["sr-s1", "sr-s2"], "The moving system", "k")];
    const notes = inlineLabelNotes(
      "light-quanta",
      concordance,
      [exception("light-quanta", "\\pi", ["all"], "The number π.")],
      [
        { glyph: "\\pi", reason: "the number π" },
        { glyph: "e", reason: "the base of the natural logarithms" },
      ],
    );
    // The listed sign's note outranks the display-terms reason, so π says one thing on a page.
    expect(notes[inlineLabelId(signSource("\\pi"), "s1")]).toBe("The number π.");
    // A sign the paper says nothing else of keeps the reason its file gives.
    expect(notes[inlineLabelId(signSource("e"), "s1")]).toBe("the base of the natural logarithms");
  });

  test("two readings under one id are refused, named", () => {
    // The guard the derivation needs: were two names to collide they would light together and say
    // one another's words. The real derivation has no collision a search finds (200 million tries
    // against one id found none), so the test reaches the guard the only way there is: an id
    // function that gives every name the same id.
    const one = entry("sr.K.stationarySystem", ["sr-s1"], "The stationary system", "K");
    const two = entry("sr.k.movingSystem", ["sr-s1"], "The moving system", "k");
    const always = () => "L1";
    // Its footing: with the real derivation these two are distinct and both are kept.
    const apart = inlineLabelNotes("special-relativity", [one, two], []);
    expect(Object.keys(apart).length).toBe(2);
    let caught: unknown;
    try {
      inlineLabelNotes("special-relativity", [one, two], [], [], always);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InlineLabelsError);
    expect((caught as InlineLabelsError).code).toBe("inline-label-id-collision");
    expect(String((caught as Error).message)).toContain("sr.k.movingSystem");
    // One reading read twice is not a collision: the same name in the same section keeps its id.
    expect(() => inlineLabelNotes("special-relativity", [one, one], [], [], always)).not.toThrow();
  });

  test("the papers' own names, as the islands ship them, all say something", () => {
    for (const paper of ["light-quanta", "brownian-motion", "special-relativity"]) {
      const notes = paperLabelNotes(paper, process.cwd());
      const ids = Object.keys(notes);
      console.log(`[label notes] ${paper}: ${ids.length} names`);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.filter((id) => !notes[id]?.trim())).toEqual([]);
    }
  });

  test("a sign declared under one display is named too, not only the file's own list", () => {
    // The test above reads the map's own contents, so a name MISSING from it passes there. This
    // one names the population instead: every glyph a display-terms file declares no quantity,
    // wherever it is declared. Before paperLabelNotes read the displays' lists, Brownian's l and ν
    // (declared under eq-s2-d1) had no note, and § 2's paragraph marked both.
    for (const paper of ["light-quanta", "brownian-motion", "special-relativity"]) {
      const file = loadDisplayTerms(process.cwd(), paper);
      const declared = [
        ...(file?.notQuantities ?? []),
        ...(file?.displays ?? []).flatMap((display) => display.notQuantities),
      ].map((sign) => sign.glyph);
      const notes = paperLabelNotes(paper, process.cwd());
      const said = new Set(Object.keys(notes));
      const silent = [...new Set(declared)].filter(
        (glyph) =>
          !paperSections(loadConcordanceForPaper(paper).entries).some((section) =>
            said.has(inlineLabelId(signSource(glyph), section)),
          ),
      );
      console.log(
        `[display signs] ${paper}: ${new Set(declared).size} declared, ${silent.length} silent`,
      );
      expect(new Set(declared).size).toBeGreaterThan(0);
      expect(silent).toEqual([]);
    }
  });
});
