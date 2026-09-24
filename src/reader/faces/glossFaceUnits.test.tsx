/**
 * The gloss face glosses every alignable unit, sets each display after the sentence that prints
 * it, and links nothing the page lacks.
 *
 * It glossed paragraph sentences only. A masthead, footnote or closing line, which the id grammar
 * aligns as one unit under its block id, was rendered as plain German, so 6 of mass-energy's 34
 * gloss units never reached the page. Every equation block stood after its whole paragraph, and
 * the footnote list's "back to reference" links named ref- ids this face never renders.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type GlossUnit,
  type SourceBlock,
  validateGlossUnit,
  validateSourceBlock,
} from "../../content/schemas/source.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";
import { FIXTURE_MASS_ENERGY_PAPER } from "../../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { GlossFace } from "./GlossFace.tsx";

const status = {
  transcription: "draft",
  mathTranscription: "draft",
  translation: "draft",
  review: "draft",
} as const;
const span = (id: string, text: string, start: number, end: number) => ({
  id,
  span: { start, end, blockRevision: 1, textDigest: spanTextDigest(text) },
});
const block = (over: Record<string, unknown>): SourceBlock => {
  const inlines = over.inlines as SourceBlock["inlines"];
  const text = inlines.map((n) => ("text" in n ? n.text : "")).join("");
  return validateSourceBlock({
    paper: "mass-energy",
    order: 1,
    locators: [{ pdfPageIndex: 1, printedPage: 639 }],
    diplomaticText: text,
    sentenceSpans: [],
    revision: 1,
    status,
    lang: "de",
    ...over,
  });
};
const S1 = "Dann gilt:";
const S2 = "Das folgt.";
const P1 = `${S1} ${S2}`;
const BLOCKS: SourceBlock[] = [
  block({
    id: "t-title",
    kind: "masthead",
    inlines: [{ kind: "text", text: "Ein Titel" }],
    sentenceSpans: [span("t-title", "Ein Titel", 0, 9)],
  }),
  block({
    id: "t-p1",
    kind: "paragraph",
    section: "s0",
    inlines: [
      { kind: "text", text: S1 },
      { kind: "math", latex: "a = b", display: true, equationId: "eq-t-d1" },
      { kind: "text", text: ` ${S2}` },
    ],
    sentenceSpans: [
      span("t-p1-s1", P1, 0, S1.length),
      span("t-p1-s2", P1, S1.length + 1, P1.length),
    ],
  }),
  block({
    id: "eq-t-d1",
    kind: "equation",
    containedIn: "t-p1",
    inlines: [{ kind: "math", latex: "a = b", equationId: "eq-t-d1" }],
  }),
  block({
    id: "eq-t-d2",
    kind: "equation",
    inlines: [{ kind: "math", latex: "c = d", equationId: "eq-t-d2" }],
  }),
  block({
    id: "t-fn1",
    kind: "footnote",
    originalLabel: "1)",
    inlines: [{ kind: "text", text: "Eine Fußnote." }],
    sentenceSpans: [span("t-fn1", "Eine Fußnote.", 0, 13)],
  }),
  block({
    id: "closing-dateline",
    kind: "closing",
    inlines: [{ kind: "text", text: "Bern, 1905." }],
    sentenceSpans: [span("closing-dateline", "Bern, 1905.", 0, 11)],
  }),
];
const gloss = (sentenceId: string, text: string, pairs: [string, string][]): GlossUnit =>
  validateGlossUnit({
    sentenceId,
    revision: 1,
    sourceRevision: 1,
    sourceTextDigest: spanTextDigest(text),
    lang: "en",
    sourceLang: "de",
    attribution: { id: "agent:test", kind: "model", modelId: "test" },
    reviewState: "machine-draft",
    tokens: pairs.map(([german, english]) => ({ german, english })),
  });
const GLOSS: GlossUnit[] = [
  gloss("t-title", "Ein Titel", [
    ["Ein", "a"],
    ["Titel", "title"],
  ]),
  gloss("t-p1-s1", S1, [
    ["Dann", "then"],
    ["gilt", "holds"],
  ]),
  gloss("t-p1-s2", S2, [
    ["Das", "that"],
    ["folgt", "follows"],
  ]),
  gloss("t-fn1", "Eine Fußnote.", [
    ["Eine", "a"],
    ["Fußnote", "footnote"],
  ]),
  gloss("closing-dateline", "Bern, 1905.", [
    ["Bern", "Bern"],
    ["1905.", "1905"],
  ]),
];

describe("the gloss face glosses every alignable unit", () => {
  const html = renderToStaticMarkup(
    <GlossFace
      paper={FIXTURE_MASS_ENERGY_PAPER}
      blocks={BLOCKS}
      glossUnits={GLOSS}
      modalityClasses={[]}
    />,
  );
  const sentences = [
    ...html.matchAll(/<section class="gloss-sentence[^"]*"[^>]*data-sentence-id="([^"]+)"/g),
  ].map((m) => m[1]);

  test("masthead, footnote and closing units are glossed like sentences", () => {
    expect([...sentences].sort()).toEqual(GLOSS.map((g) => g.sentenceId).sort());
    expect(html).not.toContain("data-coverage-notice");
    const fn = html.slice(html.indexOf('id="footnote-t-fn1"'));
    expect(fn.slice(0, fn.indexOf("</li>"))).toContain('data-sentence-id="t-fn1"');
  });

  test("a display is set after the sentence that prints it, once; an unclaimed one stands alone", () => {
    const at = (s: string) => html.indexOf(s);
    expect(html.split('data-block-id="eq-t-d1"').length - 1).toBe(1);
    expect(at('data-sentence-id="t-p1-s1"')).toBeLessThan(at('data-block-id="eq-t-d1"'));
    expect(at('data-block-id="eq-t-d1"')).toBeLessThan(at('data-sentence-id="t-p1-s2"'));
    expect(html.split('data-block-id="eq-t-d2"').length - 1).toBe(1);
  });

  test("no in-page link names an id the page lacks, and no id repeats", () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const links = [...html.matchAll(/\shref="#([^"]*)"/g)].map((m) => m[1]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    expect(links.filter((l) => !ids.includes(l))).toEqual([]);
  });
});
