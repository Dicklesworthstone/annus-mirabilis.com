/**
 * Each display is printed once, where the compositor put it (displayClaims.ts); the parallel face
 * labels its German column while the blocks are a draft, and cites the paper's own journal record.
 *
 * The fixture is the shape mass-energy's s0-p5 has: one sentence that runs through a display,
 * "... die Energie: [display] wobei V ...", with the display also present as its own equation
 * block. A second equation block that no paragraph claims is the control: it must still render.
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

const LATEX = "l^* = l \\frac{1 - \\frac{v}{V}}{2}";
const BEFORE = "Dann besitzt die Lichtmenge die Energie:";
const AFTER = " wobei V die Lichtgeschwindigkeit bedeutet.";
const TEXT = `${BEFORE}${AFTER}`;
const status = {
  transcription: "draft",
  mathTranscription: "draft",
  translation: "draft",
  review: "draft",
} as const;
const locators = [{ pdfPageIndex: 1, printedPage: 639 }];

const BLOCKS: readonly SourceBlock[] = [
  validateSourceBlock({
    id: "t-p1",
    kind: "paragraph",
    paper: "mass-energy",
    section: "s0",
    order: 1,
    locators,
    diplomaticText: TEXT,
    inlines: [
      { kind: "text", text: BEFORE },
      { kind: "math", latex: LATEX, display: true, equationId: "eq-t-d1" },
      { kind: "text", text: AFTER },
    ],
    sentenceSpans: [
      {
        id: "t-p1-s1",
        span: {
          start: 0,
          end: Array.from(TEXT).length,
          blockRevision: 1,
          textDigest: spanTextDigest(TEXT),
        },
      },
    ],
    revision: 1,
    status,
    lang: "de",
  }),
  validateSourceBlock({
    id: "eq-t-d1",
    kind: "equation",
    paper: "mass-energy",
    section: "s0",
    order: 2,
    containedIn: "t-p1",
    locators,
    diplomaticText: LATEX,
    inlines: [{ kind: "math", latex: LATEX, equationId: "eq-t-d1" }],
    sentenceSpans: [],
    revision: 1,
    status,
    lang: "de",
  }),
  validateSourceBlock({
    id: "eq-t-d2",
    kind: "equation",
    paper: "mass-energy",
    section: "s0",
    order: 3,
    locators,
    diplomaticText: "a = b",
    inlines: [{ kind: "math", latex: "a = b", equationId: "eq-t-d2" }],
    sentenceSpans: [],
    revision: 1,
    status,
    lang: "de",
  }),
];
const UNITS = [
  validateTranslationUnit({
    id: "t-p1-s1",
    sourceRefs: [{ paper: "mass-energy", id: "t-p1-s1" }],
    inlines: [{ kind: "text", text: "Then the quantity of light possesses the energy:" }],
    translator: { id: "agent:test", kind: "model", modelId: "test" },
    revision: 1,
    reviewState: "machine-draft",
    lang: "en",
  }),
];
const ALIGNMENT = validateAlignment({
  id: "align-t",
  paper: "mass-energy",
  edges: [
    {
      source: { paper: "mass-energy", blockId: "t-p1", sentenceId: "t-p1-s1" },
      target: { translationUnitId: "t-p1-s1" },
    },
  ],
});
const tex = (html: string, latex: string) =>
  html.split(
    `<annotation encoding="application/x-tex">${latex.replace(/&/g, "&amp;")}</annotation>`,
  ).length - 1;
/**
 * The parallel face's German side: every row's German half, in reading order. The face was two whole
 * columns and this sliced the German one out of the markup; it is now one row per German block with
 * that block's English (parallelRows.ts), so the German side is the German halves taken together.
 */
const germanHalves = (html: string) => {
  const { document } = new Window();
  document.body.innerHTML = html;
  return [...document.querySelectorAll('[data-parallel-half="german"]')]
    .map((half) => half.outerHTML)
    .join("");
};

describe("each display is printed once, in place", () => {
  test("the parallel face's German column prints the display inside its sentence, once", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_MASS_ENERGY_PAPER}
        blocks={BLOCKS}
        units={UNITS}
        alignment={ALIGNMENT}
      />,
    );
    const de = germanHalves(html);
    expect(tex(de, LATEX)).toBe(1);
    expect(de).not.toContain('data-block-wrapper="eq-t-d1"');
    // In place: inside the paragraph, after the words that introduce it and before "wobei".
    const at = de.indexOf(' id="eq-t-d1"'); // leading space: not data-block-id="eq-t-d1"
    expect(at).toBeGreaterThan(de.indexOf('<p id="t-p1"'));
    expect(at).toBeGreaterThan(de.indexOf("die Energie:"));
    expect(at).toBeLessThan(de.indexOf("wobei V"));
    expect(de.split(' id="eq-t-d1"').length - 1).toBe(1);
    expect(de.slice(at, at + 400)).toContain('class="katex-display"');
    // The control: an equation block no paragraph claims still stands alone.
    expect(de).toContain('data-block-wrapper="eq-t-d2"');
    expect(tex(de, "a = b")).toBe(1);
  });

  test("the German face prints it once too", () => {
    const html = renderToStaticMarkup(
      <GermanFace paper={FIXTURE_MASS_ENERGY_PAPER} blocks={BLOCKS} alignment={ALIGNMENT} />,
    );
    expect(tex(html, LATEX)).toBe(1);
    expect(html).not.toContain('data-block-wrapper="eq-t-d1"');
    expect(html).toContain('data-block-wrapper="eq-t-d2"');
  });
});

describe("the parallel face's labels and citation", () => {
  // The German column carried the source's "Machine draft, not reviewed" label while its blocks were
  // a draft. D-2026-09-25-no-review-status-banners withdrew it, so no column carries one.
  test("the German side carries no draft notice, however its blocks stand", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_MASS_ENERGY_PAPER}
        blocks={BLOCKS}
        units={UNITS}
        alignment={ALIGNMENT}
      />,
    );
    // Non-vacuity: the face rendered its rows, so the absences below are about a real page.
    expect(html).toContain("data-parallel-row=");
    expect(html).not.toContain("data-source-draft-notice");
    expect(html).not.toContain("parallel-notice");
    expect(html).not.toMatch(/Machine draft|not reviewed/);
  });

  test("the citation is the paper's own journal record", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_MASS_ENERGY_PAPER}
        blocks={BLOCKS}
        units={UNITS}
        alignment={ALIGNMENT}
      />,
    ).replace(/<!-- -->/g, "");
    // The fixture paper records (4) 18, 639-641, issue published 1905-11-21.
    expect(html).toContain("Annalen der Physik (4) 18, 639–641 (1905).");
    const german = renderToStaticMarkup(
      <GermanFace paper={FIXTURE_MASS_ENERGY_PAPER} blocks={BLOCKS} />,
    ).replace(/<!-- -->/g, "");
    expect(german).toContain("Annalen der Physik (4) 18, 639–641 (1905).");
  });
});
