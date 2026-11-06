import { describe, expect, test } from "bun:test";
import {
  buildPassageProjections,
  mergePassageProjections,
  type PassageProjection,
  type PassageProjectionInput,
} from "./passageProjections.ts";

const PAPER = "brownian-motion";
const block = (id: string, sentences: readonly string[] = [`${id}-s1`]) => ({
  id,
  paper: PAPER,
  kind: "paragraph" as const,
  section: "s1",
  sentenceSpans: sentences.map((sentenceId) => ({ id: sentenceId })),
});
const unit = (id: string, source: string, paper = PAPER) => ({
  id,
  sourceRefs: [{ paper, id: source }],
});
const argument = (id: string, experiments: readonly string[] = []) => ({
  id,
  paper: PAPER,
  section: "s1",
  title: `Explanation of ${id}`,
  experiments,
});
const binding = (id: string, passages: readonly string[], unexplained = false) => ({
  unit: id,
  passages,
  label: `Printed ${id}`,
  r0: "The paragraph's overview.",
  unexplained,
});
const instrument = (id: string, argumentIds: readonly string[] = [], source = "s1") => ({
  id,
  title: `Laboratory ${id}`,
  argumentIds,
  sourceRefs: [{ paper: PAPER, id: source }],
});
const jump = (id: string, targetAnchor: string) => ({
  id,
  label: "Read the argument",
  paperId: PAPER,
  section: "s1",
  targetAnchor,
  pointer: "This is the corresponding argument in the paper.",
});
const edge = (blockId: string, translationUnitId: string, sentenceId?: string) => ({
  source: { paper: PAPER, blockId, sentenceId },
  target: { translationUnitId },
});
const fixture = (overrides: Partial<PassageProjectionInput> = {}): PassageProjectionInput => ({
  paperId: PAPER,
  blocks: [block("s1-p1"), block("s1-p2")],
  units: [unit("en-first", "s1-p1-s1"), unit("en-second", "s1-p2-s1")],
  bindings: [binding("s1-p1", ["arg-one"]), binding("s1-p2", ["arg-two"])],
  arguments: [argument("arg-one", ["bm-05"]), argument("arg-two")],
  instruments: [instrument("bm-05", ["arg-one"])],
  journeyJumps: [jump("jump-one", "arg-one")],
  ...overrides,
});
const hrefs = (projection: PassageProjection | undefined, key: keyof PassageProjection) =>
  projection?.[key].map((link) => link.href) ?? [];
const german = (id: string) => `/papers/${PAPER}/view/german/#${id}`;
const english = (id: string) => `/papers/${PAPER}/view/english/#${id}`;
const explanation = (id: string) => `/papers/${PAPER}/#${id}`;

describe("passage projections: exact authored relationships", () => {
  test("a bound paragraph reaches its two texts, explanation, instrument and journey passage", () => {
    const index = buildPassageProjections(fixture());
    const first = index.bySourceBlock["s1-p1"];
    expect(hrefs(first, "german")).toEqual([german("s1-p1")]);
    expect(hrefs(first, "english")).toEqual([english("en-first")]);
    expect(hrefs(first, "explanation")).toEqual([explanation("arg-one")]);
    expect(hrefs(first, "instrument")).toEqual(["/lab/bm-05/"]);
    expect(hrefs(first, "journey")).toEqual([`/discover/${PAPER}/#jump-one`]);
    expect(first?.german[0]?.label).toBe("Printed s1-p1");
    expect(first?.explanation[0]?.label).toBe("Explanation of arg-one");
    expect(hrefs(index.byArgument["arg-one"], "german")).toEqual([german("s1-p1")]);
    expect(hrefs(index.byTranslationUnit["en-first"], "german")).toEqual([german("s1-p1")]);
  });

  test("many-to-many alignment keeps every source and lands at English reading order", () => {
    const input = fixture({
      units: [unit("first-in-english", "s1-p1-s1"), unit("shared-english", "s1-p1-s1")],
      alignment: {
        id: "alignment",
        paper: PAPER,
        // Edge order deliberately differs from the translated reading order.
        edges: [
          edge("s1-p2", "shared-english", "s1-p2-s1"),
          edge("s1-p1", "shared-english", "s1-p1-s1"),
          edge("s1-p1", "first-in-english", "s1-p1-s1"),
          edge("s1-p1", "shared-english", "s1-p1-s1"),
        ],
      },
    });
    const index = buildPassageProjections(input);
    expect(hrefs(index.bySourceBlock["s1-p1"], "english")).toEqual([english("first-in-english")]);
    expect(hrefs(index.bySourceBlock["s1-p2"], "english")).toEqual([english("shared-english")]);
    const shared = index.byTranslationUnit["shared-english"];
    expect(hrefs(shared, "german")).toEqual([german("s1-p1"), german("s1-p2")]);
    expect(hrefs(shared, "explanation")).toEqual([explanation("arg-one"), explanation("arg-two")]);
    const paragraph = mergePassageProjections([
      index.byTranslationUnit["first-in-english"],
      shared,
    ]);
    expect(hrefs(paragraph, "german")).toEqual([german("s1-p1"), german("s1-p2")]);
    expect(hrefs(paragraph, "english")).toEqual([
      english("first-in-english"),
      english("shared-english"),
    ]);
    expect(hrefs(paragraph, "instrument")).toEqual(["/lab/bm-05/"]);
  });

  test("a paragraph with several translated sentences has one English paragraph destination", () => {
    const index = buildPassageProjections(
      fixture({
        blocks: [block("s1-p1", ["source-a", "source-b"])],
        units: [unit("english-a", "source-a"), unit("english-b", "source-b")],
      }),
    );
    const paragraph = mergePassageProjections([
      index.byTranslationUnit["english-a"],
      index.byTranslationUnit["english-b"],
    ]);
    expect(hrefs(paragraph, "english")).toEqual([english("english-a")]);
    expect(paragraph.english[0]?.label).toBe("Printed s1-p1");
  });

  test("an explicitly contained translated display shares its paragraph menu without changing display targets", () => {
    const index = buildPassageProjections(
      fixture({
        blocks: [
          block("s1-p1"),
          { ...block("eq-one", []), kind: "equation", containedIn: "s1-p1" },
        ],
        units: [unit("english-text", "s1-p1-s1"), unit("english-equation", "eq-one")],
      }),
    );
    const paragraph = mergePassageProjections([
      index.byTranslationUnit["english-text"],
      index.byTranslationUnit["english-equation"],
    ]);
    expect(hrefs(paragraph, "german")).toEqual([german("s1-p1")]);
    expect(hrefs(paragraph, "english")).toEqual([english("english-text")]);
    expect(hrefs(paragraph, "explanation")).toEqual([explanation("arg-one")]);
    expect(hrefs(index.bySourceBlock["eq-one"], "german")).toEqual([german("eq-one")]);
    expect(hrefs(index.bySourceBlock["eq-one"], "english")).toEqual([english("english-equation")]);
  });

  for (const caseName of ["missing", "foreign", "nonparagraph"] as const) {
    test(`a translated display with a ${caseName} containment parent keeps its own exact targets`, () => {
      const parent =
        caseName === "foreign"
          ? { ...block("parent"), paper: "mass-energy" }
          : { ...block("parent"), kind: "heading" as const };
      const index = buildPassageProjections(
        fixture({
          blocks: [
            ...(caseName === "missing" ? [] : [parent]),
            { ...block("eq-one", []), kind: "equation", containedIn: "parent" },
          ],
          units: [unit("english-equation", "eq-one")],
        }),
      );
      expect(hrefs(index.byTranslationUnit["english-equation"], "german")).toEqual([
        german("eq-one"),
      ]);
      expect(hrefs(index.byTranslationUnit["english-equation"], "english")).toEqual([
        english("english-equation"),
      ]);
      expect(hrefs(index.byTranslationUnit["english-equation"], "explanation")).toEqual([]);
    });
  }

  test("without alignment, only exact block or owned sentence references establish translation", () => {
    const index = buildPassageProjections(
      fixture({
        units: [
          unit("exact-block", "s1-p1"),
          unit("exact-sentence", "s1-p2-s1"),
          unit("guessed-sentence", "s1-p2-s99"),
          unit("foreign-unit", "s1-p1", "mass-energy"),
          unit("same-section", "s1"),
        ],
      }),
    );
    expect(hrefs(index.bySourceBlock["s1-p1"], "english")).toEqual([english("exact-block")]);
    expect(hrefs(index.bySourceBlock["s1-p2"], "english")).toEqual([english("exact-sentence")]);
    expect(hrefs(index.byTranslationUnit["guessed-sentence"], "german")).toEqual([]);
    expect(hrefs(index.byTranslationUnit["same-section"], "german")).toEqual([]);
    expect(index.byTranslationUnit["foreign-unit"]).toBeUndefined();
  });

  test("dangling or invalid alignment is unavailable instead of falling back to a plausible source", () => {
    const index = buildPassageProjections(
      fixture({
        alignment: {
          id: "broken-alignment",
          paper: PAPER,
          edges: [
            edge("missing-block", "en-first"),
            edge("s1-p2", "en-second", "s1-p1-s1"),
            edge("s1-p1", "missing-unit", "s1-p1-s1"),
          ],
        },
      }),
    );
    expect(hrefs(index.bySourceBlock["s1-p1"], "english")).toEqual([]);
    expect(hrefs(index.bySourceBlock["s1-p2"], "english")).toEqual([]);
    expect(hrefs(index.byTranslationUnit["en-first"], "german")).toEqual([]);
    expect(index.bySourceBlock["missing-block"]).toBeUndefined();
    expect(index.byTranslationUnit["missing-unit"]).toBeUndefined();
  });

  test("an alignment edge cannot borrow the same block id from another paper", () => {
    const index = buildPassageProjections(
      fixture({
        alignment: {
          id: "cross-paper",
          paper: PAPER,
          edges: [
            {
              source: { paper: "mass-energy", blockId: "s1-p1" },
              target: { translationUnitId: "en-first" },
            },
          ],
        },
      }),
    );
    expect(hrefs(index.bySourceBlock["s1-p1"], "english")).toEqual([]);
    expect(hrefs(index.byTranslationUnit["en-first"], "german")).toEqual([]);
    expect(hrefs(index.bySourceBlock["s1-p2"], "english")).toEqual([english("en-second")]);
  });

  test("unbound and explicitly unexplained text never acquires an explanation from its section", () => {
    const index = buildPassageProjections(
      fixture({ bindings: [binding("s1-p1", ["arg-one"], true)] }),
    );
    for (const id of ["s1-p1", "s1-p2"]) {
      expect(hrefs(index.bySourceBlock[id], "explanation")).toEqual([]);
      expect(hrefs(index.bySourceBlock[id], "instrument")).toEqual([]);
      expect(hrefs(index.bySourceBlock[id], "journey")).toEqual([]);
    }
    expect(hrefs(index.byArgument["arg-one"], "german")).toEqual([]);
  });

  test("bindings to missing or foreign arguments publish no invented explanation target", () => {
    const index = buildPassageProjections(
      fixture({
        arguments: [argument("arg-one"), { ...argument("arg-two"), paper: "mass-energy" }],
        bindings: [binding("s1-p1", ["arg-missing"]), binding("s1-p2", ["arg-two"])],
      }),
    );
    expect(hrefs(index.bySourceBlock["s1-p1"], "explanation")).toEqual([]);
    expect(hrefs(index.bySourceBlock["s1-p2"], "explanation")).toEqual([]);
    expect(index.byArgument["arg-two"]).toBeUndefined();
  });

  test("instruments require a registered record and a precise source or argument relation", () => {
    const index = buildPassageProjections(
      fixture({
        arguments: [argument("arg-one", ["bm-05", "not-registered", "bm-08"]), argument("arg-two")],
        instruments: [
          instrument("bm-05"), // Explicitly named by the argument.
          instrument("bm-06", ["arg-one"]), // Reverse argument link in the manifest.
          instrument("bm-07", [], "s1-p1-s1"), // An exact source sentence.
          instrument("bm-02"), // Same section only: not a paragraph relationship.
          instrument("not-registered", ["arg-one"], "s1-p1"),
          {
            ...instrument("bm-03", [], "s1-p1"),
            sourceRefs: [{ paper: "mass-energy", id: "s1-p1" }],
          },
          instrument("avogadro-lab", ["arg-one"]), // Still in preparation.
        ],
      }),
    );
    expect(hrefs(index.bySourceBlock["s1-p1"], "instrument")).toEqual([
      "/lab/bm-05/",
      "/lab/bm-06/",
      "/lab/bm-07/",
    ]);
    expect(hrefs(index.bySourceBlock["s1-p2"], "instrument")).toEqual([]);
  });

  test("sharing a source paragraph does not give one argument the other argument's instruments", () => {
    const index = buildPassageProjections(
      fixture({ bindings: [binding("s1-p1", ["arg-one", "arg-two"])] }),
    );
    expect(hrefs(index.byArgument["arg-one"], "instrument")).toEqual(["/lab/bm-05/"]);
    expect(hrefs(index.byArgument["arg-two"], "instrument")).toEqual([]);
    expect(hrefs(index.byArgument["arg-two"], "journey")).toEqual([]);
    expect(hrefs(index.byArgument["arg-two"], "german")).toEqual([german("s1-p1")]);
  });

  test("only exact, same-paper journey anchors with the correct argument section are offered", () => {
    const index = buildPassageProjections(
      fixture({
        journeyJumps: [
          jump("real-jump", "arg-one"),
          jump("real-jump", "arg-one"),
          jump("section-only", "s1"),
          jump("missing-argument", "arg-missing"),
          { ...jump("wrong-paper", "arg-one"), paperId: "mass-energy" },
          { ...jump("wrong-section", "arg-one"), section: "s2" },
        ],
      }),
    );
    expect(hrefs(index.bySourceBlock["s1-p1"], "journey")).toEqual([
      `/discover/${PAPER}/#real-jump`,
    ]);
    expect(hrefs(index.byArgument["arg-two"], "journey")).toEqual([]);
  });

  test("a missing German block has no source or English projection, even if its binding exists", () => {
    const index = buildPassageProjections(fixture({ blocks: [] }));
    expect(Object.keys(index.bySourceBlock)).toEqual([]);
    expect(hrefs(index.byArgument["arg-one"], "german")).toEqual([]);
    expect(hrefs(index.byArgument["arg-one"], "english")).toEqual([]);
    expect(hrefs(index.byArgument["arg-one"], "explanation")).toEqual([explanation("arg-one")]);
    expect(hrefs(index.byTranslationUnit["en-first"], "german")).toEqual([]);
  });

  test("merging keeps available groups in first-seen order, deduplicates hrefs and tolerates missing entries", () => {
    const index = buildPassageProjections(fixture());
    const combined = mergePassageProjections([
      undefined,
      index.bySourceBlock["s1-p2"],
      index.bySourceBlock["s1-p1"],
      index.bySourceBlock["s1-p2"],
    ]);
    expect(hrefs(combined, "german")).toEqual([german("s1-p2"), german("s1-p1")]);
    expect(hrefs(combined, "explanation")).toEqual([
      explanation("arg-two"),
      explanation("arg-one"),
    ]);
    expect(mergePassageProjections([])).toEqual({
      german: [],
      english: [],
      explanation: [],
      instrument: [],
      journey: [],
    });
  });
});
