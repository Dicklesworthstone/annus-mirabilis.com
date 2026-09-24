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
});
