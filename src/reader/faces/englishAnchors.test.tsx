/**
 * Every in-page link on the English and parallel faces names an id the page has, and no id is
 * repeated.
 *
 * The fixture has the shape real content has under the id grammar (docs/CONTENT_IDS.md 3.3): an
 * English unit carries its German sentence's id, and the footnote's unit carries the footnote
 * block's id. Before this, the English face's marks linked #footnote-<id>, which only a German
 * face renders, and the parallel face repeated every aligned id.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type SourceBlock,
  type TranslationUnit,
  validateAlignment,
  validateSourceBlock,
  validateTranslationUnit,
} from "../../content/schemas/source.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";
import { FIXTURE_MASS_ENERGY_PAPER } from "../../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { EnglishFace } from "./EnglishFace.tsx";
import { ParallelFace } from "./ParallelFace.tsx";

const status = {
  transcription: "draft",
  mathTranscription: "not-applicable",
  translation: "draft",
  review: "draft",
} as const;
const locators = [{ pdfPageIndex: 1, printedPage: 639 }];
const block = (id: string, kind: "paragraph" | "footnote", inlines: SourceBlock["inlines"]) => {
  const text = inlines.map((n) => ("text" in n ? n.text : "mark" in n ? n.mark : "")).join("");
  return validateSourceBlock({
    id,
    kind,
    paper: "mass-energy",
    section: "s0",
    order: 1,
    locators,
    diplomaticText: text,
    inlines,
    sentenceSpans: [
      {
        id: kind === "footnote" ? id : `${id}-s1`,
        span: {
          start: 0,
          end: Array.from(text).length,
          blockRevision: 1,
          textDigest: spanTextDigest(text),
        },
      },
    ],
    revision: 1,
    status,
    lang: "de",
  });
};
const BLOCKS: readonly SourceBlock[] = [
  block("t-p1", "paragraph", [
    { kind: "text", text: "Die Untersuchung" },
    { kind: "footnote-mark", mark: "1)", footnoteId: "t-fn1" },
    { kind: "text", text: " und die andere" },
    { kind: "footnote-mark", mark: "2)", footnoteId: "t-fn2" },
    { kind: "text", text: " führen weiter." },
  ]),
  block("t-fn1", "footnote", [{ kind: "text", text: "A. Einstein, Ann. d. Phys. 17." }]),
  block("t-fn2", "footnote", [{ kind: "text", text: "Nicht übersetzt." }]),
];
const unit = (id: string, source: string, inlines: TranslationUnit["inlines"]) =>
  validateTranslationUnit({
    id,
    sourceRefs: [{ paper: "mass-energy", id: source }],
    inlines,
    translator: { id: "agent:test", kind: "model", modelId: "test" },
    revision: 1,
    reviewState: "machine-draft",
    lang: "en",
  });
// t-fn2 deliberately has no English unit: its mark must not link to nothing.
const UNITS: readonly TranslationUnit[] = [
  unit("t-p1-s1", "t-p1-s1", [
    { kind: "text", text: "The investigation" },
    { kind: "footnote-mark", mark: "1)", footnoteId: "t-fn1" },
    { kind: "text", text: " and the other" },
    { kind: "footnote-mark", mark: "2)", footnoteId: "t-fn2" },
    { kind: "text", text: " lead further." },
  ]),
  unit("t-fn1", "t-fn1", [{ kind: "text", text: "A. Einstein, Ann. d. Phys. 17." }]),
];
const ALIGNMENT = validateAlignment({
  id: "align-t",
  paper: "mass-energy",
  edges: [
    {
      source: { paper: "mass-energy", blockId: "t-p1", sentenceId: "t-p1-s1" },
      target: { translationUnitId: "t-p1-s1" },
    },
    { source: { paper: "mass-energy", blockId: "t-fn1" }, target: { translationUnitId: "t-fn1" } },
  ],
});

/** Every id on the page, every in-page link, the ids seen twice, and the links naming no id. */
function anchors(html: string) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] as string);
  const links = [...html.matchAll(/\shref="#([^"]*)"/g)].map((m) => m[1] as string);
  const all = new Set(ids);
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
  return { ids: all, links, repeated, dangling: links.filter((l) => !all.has(l)) };
}

describe("in-page links resolve and ids are unique", () => {
  test("the English face: a mark links to the unit that translates its footnote", () => {
    const html = renderToStaticMarkup(
      <EnglishFace paper={FIXTURE_MASS_ENERGY_PAPER} units={UNITS} alignment={ALIGNMENT} />,
    );
    const a = anchors(html);
    expect(a.links).toContain("t-fn1");
    expect(a.links).not.toContain("footnote-t-fn1");
    expect(a.dangling).toEqual([]);
    expect(a.repeated).toEqual([]);
    // A footnote with no English unit gets its mark but no link.
    expect(html).toContain('<span data-footnote-ref="t-fn2">[2)]</span>');
  });

  test("the parallel face: the English column has its own ids, and both columns' marks resolve", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_MASS_ENERGY_PAPER}
        blocks={BLOCKS}
        units={UNITS}
        alignment={ALIGNMENT}
      />,
    );
    const a = anchors(html);
    expect(a.repeated).toEqual([]);
    expect(a.dangling).toEqual([]);
    // The German sentence keeps its id; its English is namespaced, not dropped.
    expect(a.ids.has("t-p1-s1")).toBe(true);
    expect(a.ids.has("en-t-p1-s1")).toBe(true);
    expect(html).toContain('data-translation-unit-id="t-p1-s1"');
    // The German mark goes to the German footnote list; the English one to the English unit.
    expect(a.links).toContain("footnote-t-fn1");
    expect(a.links).toContain("en-t-fn1");
  });

  /*
    A CROSS-PAGE LINK IS INVISIBLE TO THE TEST ABOVE, which is how this shipped broken.

    The check above asks that every link the page emits resolves. The parallel face links its own
    marks to #footnote-<id>, so #s<n>-fn<k> is named by nobody on this page and its absence could
    not fail: a check inherits the silence of whatever it reads. What reads that anchor is another
    page. /capstones/special-relativity/ links /papers/special-relativity/view/parallel/#s1-fn1,
    the anchor docs/CONTENT_IDS.md 7.1 gives for a footnote block, and on the build of 2026-09-28
    it landed at the top of a 6,850-id page. Measured on that build: 95 pages published a bare
    id="s<n>-fn<k>" and the parallel face published 0, while publishing 94 bare id="s<n>-p<m>" for
    paragraph blocks, so footnotes were the one block kind whose canonical anchor this face
    dropped.

    So this test asks the question the linking page asks, not the question this page asks: is the
    footnote block's own id on the page? Drop `anchored` in ParallelFace.tsx and it goes red.
  */
  test("the parallel face publishes each footnote block's canonical anchor, for links from other pages", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_MASS_ENERGY_PAPER}
        blocks={BLOCKS}
        units={UNITS}
        alignment={ALIGNMENT}
      />,
    );
    const a = anchors(html);
    const footnotes = BLOCKS.filter((b) => b.kind === "footnote").map((b) => b.id);
    // Non-vacuity on purpose: the fixture must actually carry footnotes, or the loop below proves
    // nothing while passing. Two, and one of them (t-fn2) has no English unit.
    expect(footnotes).toEqual(["t-fn1", "t-fn2"]);
    for (const id of footnotes) {
      expect(a.ids.has(id)).toBe(true);
      // The marks' target keeps its own id; the canonical anchor is published beside it, not
      // instead of it, so a footnote backlink still works.
      expect(a.ids.has(`footnote-${id}`)).toBe(true);
    }
    // The paragraph block already did this; the two kinds now agree.
    expect(a.ids.has("t-p1")).toBe(true);
    // And the reason this face declined the anchor until 2026-09-28 was that its rows would repeat
    // ids. They do not: the English column is namespaced by ENGLISH_ANCHOR_PREFIX.
    expect(a.repeated).toEqual([]);
    expect(a.dangling).toEqual([]);
  });
});
