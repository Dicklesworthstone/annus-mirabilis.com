/**
 * A display a FOOTNOTE prints is printed once on the parallel face, inside that footnote, and its
 * English sits in the footnote's row (ParallelFace.tsx, parallelRows.ts).
 *
 * WHY THIS EXISTS. Light quanta's s1-fn3 prints three displays inside its text. The parallel face
 * counted which displays are claimed only after it had set the footnotes aside, so a footnote's
 * displays were claimed by nothing: each was printed inside the footnote AND as a German row of its
 * own, repeating its id, and its English landed in that stray row in the running text instead of
 * beside the footnote. Mass-energy's footnotes print no display, so nothing had met this.
 *
 * The negative a naive implementation fails: the pre-fix face prints the display's TeX twice on
 * the German side, keeps a data-block-wrapper row for it, and puts its English before the
 * footnotes heading.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type SourceBlock,
  validateAlignment,
  validateSourceBlock,
  validateTranslationUnit,
} from "../../content/schemas/source.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";
import { FIXTURE_MASS_ENERGY_PAPER } from "../../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { GermanFace } from "./GermanFace.tsx";
import { ParallelFace } from "./ParallelFace.tsx";

const LATEX = "Z = \\sum_{\\nu = 1}^{\\infty} A_\\nu";
const status = {
  transcription: "draft",
  mathTranscription: "draft",
  translation: "draft",
  review: "draft",
} as const;
const locators = [{ pdfPageIndex: 1, printedPage: 135 }];
const span = (id: string, text: string) => ({
  id,
  span: {
    start: 0,
    end: Array.from(text).length,
    blockRevision: 1,
    textDigest: spanTextDigest(text),
  },
});
const P_TEXT = "Er fand es.1)";
const FN_BEFORE = "Wir entwickeln in eine Reihe";
const FN_AFTER = " wobei A positiv ist.";
const FN_TEXT = `${FN_BEFORE}${FN_AFTER}`;

const BLOCKS: readonly SourceBlock[] = [
  validateSourceBlock({
    id: "t-p1",
    kind: "paragraph",
    paper: "mass-energy",
    section: "s0",
    order: 1,
    locators,
    diplomaticText: P_TEXT,
    inlines: [
      { kind: "text", text: "Er fand es." },
      { kind: "footnote-mark", mark: "1)", footnoteId: "s0-fn1" },
    ],
    sentenceSpans: [span("t-p1-s1", P_TEXT)],
    revision: 1,
    status,
    lang: "de",
  }),
  validateSourceBlock({
    id: "s0-fn1",
    kind: "footnote",
    paper: "mass-energy",
    section: "s0",
    order: 2,
    locators,
    originalLabel: "1)",
    diplomaticText: FN_TEXT,
    inlines: [
      { kind: "text", text: FN_BEFORE },
      { kind: "math", latex: LATEX, display: true, equationId: "eq-t-d1" },
      { kind: "text", text: FN_AFTER },
    ],
    sentenceSpans: [span("s0-fn1", FN_TEXT)],
    revision: 1,
    status,
    lang: "de",
  }),
  validateSourceBlock({
    id: "eq-t-d1",
    kind: "equation",
    paper: "mass-energy",
    section: "s0",
    order: 3,
    containedIn: "s0-fn1",
    locators,
    diplomaticText: LATEX,
    inlines: [{ kind: "math", latex: LATEX, equationId: "eq-t-d1" }],
    sentenceSpans: [],
    revision: 1,
    status,
    lang: "de",
  }),
];
const unit = (id: string, source: string, inlines: unknown[]) =>
  validateTranslationUnit({
    id,
    sourceRefs: [{ paper: "mass-energy", id: source }],
    inlines,
    translator: { id: "agent:test", kind: "model", modelId: "test" },
    revision: 1,
    reviewState: "machine-draft",
    lang: "en",
  });
const UNITS = [
  unit("t-p1-s1", "t-p1-s1", [
    { kind: "text", text: "He found it." },
    { kind: "footnote-mark", mark: "1)", footnoteId: "s0-fn1" },
  ]),
  unit("s0-fn1a", "s0-fn1", [{ kind: "text", text: "We expand in a series" }]),
  unit("eq-t-d1", "eq-t-d1", [{ kind: "math", latex: LATEX, equationId: "eq-t-d1" }]),
  unit("s0-fn1b", "s0-fn1", [{ kind: "text", text: "where A is positive." }]),
];
const ALIGNMENT = validateAlignment({
  id: "align-t",
  paper: "mass-energy",
  edges: [
    {
      source: { paper: "mass-energy", blockId: "t-p1", sentenceId: "t-p1-s1" },
      target: { translationUnitId: "t-p1-s1" },
    },
    {
      source: { paper: "mass-energy", blockId: "s0-fn1" },
      target: { translationUnitId: "s0-fn1a" },
    },
    {
      source: { paper: "mass-energy", blockId: "eq-t-d1" },
      target: { translationUnitId: "eq-t-d1" },
    },
    {
      source: { paper: "mass-energy", blockId: "s0-fn1" },
      target: { translationUnitId: "s0-fn1b" },
    },
  ],
});

const tex = (html: string) =>
  html.split(`<annotation encoding="application/x-tex">${LATEX}</annotation>`).length - 1;

describe("a display a footnote prints, on the parallel face", () => {
  const html = renderToStaticMarkup(
    <ParallelFace
      paper={FIXTURE_MASS_ENERGY_PAPER}
      blocks={BLOCKS}
      units={UNITS}
      alignment={ALIGNMENT}
    />,
  );
  const { document } = new Window();
  document.body.innerHTML = html;
  const german = [...document.querySelectorAll('[data-parallel-half="german"]')]
    .map((h) => h.outerHTML)
    .join("");

  test("the German side prints it once, inside the footnote, and gives it no row of its own", () => {
    expect(tex(german)).toBe(1);
    expect(german).not.toContain('data-block-wrapper="eq-t-d1"');
    const footnotes = german.indexOf('data-footnote-id="s0-fn1"');
    expect(footnotes).toBeGreaterThan(-1);
    expect(german.indexOf("<annotation")).toBeGreaterThan(footnotes);
  });

  test("its English is in the footnote's row, between the footnote's two halves", () => {
    const heading = html.indexOf('id="footnotes-heading"');
    const a = html.indexOf('data-translation-unit-id="s0-fn1a"');
    const d = html.indexOf('data-translation-unit-id="eq-t-d1"');
    const b = html.indexOf('data-translation-unit-id="s0-fn1b"');
    expect(heading).toBeGreaterThan(-1);
    expect([a, d, b].every((i) => i > heading)).toBe(true);
    expect(a).toBeLessThan(d);
    expect(d).toBeLessThan(b);
    expect(document.querySelectorAll('[data-parallel-row="eq-t-d1"]').length).toBe(0);
  });

  test("no id repeats on the page", () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
});

describe("a display a footnote prints, on the German face", () => {
  test("it is printed once, inside the footnote, with no block of its own", () => {
    const html = renderToStaticMarkup(
      <GermanFace paper={FIXTURE_MASS_ENERGY_PAPER} blocks={BLOCKS} alignment={ALIGNMENT} />,
    );
    expect(tex(html)).toBe(1);
    expect(html).not.toContain('data-block-wrapper="eq-t-d1"');
    expect(html.indexOf("<annotation")).toBeGreaterThan(html.indexOf('data-footnote-id="s0-fn1"'));
  });
});
