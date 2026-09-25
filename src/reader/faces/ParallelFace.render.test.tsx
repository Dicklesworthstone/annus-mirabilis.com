import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_EDITORIAL_NOTES,
  FIXTURE_REVIEW_RECORDS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { EnglishFace } from "./EnglishFace.tsx";
import { GermanFace } from "./GermanFace.tsx";
import { ParallelFace } from "./ParallelFace.tsx";

describe("ParallelFace render tests", () => {
  test("Brownian §§4–5 fixture renders on all three faces with anchors, printed equation numbers, footnotes, term annotations, and the date-line", () => {
    // 1. GermanFace renders anchors, printed equation numbers, footnotes, term annotations, and date-line
    const germanHtml = renderToStaticMarkup(
      <GermanFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
      />,
    );
    expect(germanHtml).toContain('id="bm-s4-p1"');
    expect(germanHtml).toContain('id="bm-s4-eq1"');
    expect(germanHtml).toContain('data-equation-label="1"');
    expect(germanHtml).toContain("(1)");
    expect(germanHtml).toContain('data-printed-notation="true"');
    expect(germanHtml).toContain('id="footnote-bm-s5-fn1"');
    expect(germanHtml).toContain("Fußnoten");
    expect(germanHtml).toContain('data-term-text="term-verschiebung"');
    expect(germanHtml).toContain("Verschiebung");
    expect(germanHtml).toContain("Bern, Mai 1905.");

    // 2. EnglishFace renders anchors, printed equation numbers, term annotations
    const englishHtml = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );
    expect(englishHtml).toContain('id="tr-bm-s4-p1-u1"');
    expect(englishHtml).toContain('id="tr-bm-s4-eq1"');
    expect(englishHtml).toContain('data-equation-id="eq-diffusion-1d"');
    expect(englishHtml).toContain('data-printed-notation="true"');
    expect(englishHtml).toContain('data-term-text="term-verschiebung"');
    expect(englishHtml).toContain("displacement");

    // 3. ParallelFace renders anchors, printed equation numbers, footnotes, term annotations, and date-line
    const parallelHtml = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );
    expect(parallelHtml).toContain('id="bm-s4-p1"');
    expect(parallelHtml).toContain('id="tr-bm-s4-p1-u1"');
    expect(parallelHtml).toContain('data-equation-label="1"');
    expect(parallelHtml).toContain("(1)");
    expect(parallelHtml).toContain('id="footnote-bm-s5-fn1"');
    expect(parallelHtml).toContain("Fußnoten");
    expect(parallelHtml).toContain('data-term-text="term-verschiebung"');
    expect(parallelHtml).toContain("Verschiebung");
    expect(parallelHtml).toContain("displacement");
    expect(parallelHtml).toContain("Bern, Mai 1905.");
  });
  test("renders both German source and English translation columns", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );

    expect(html).toContain('data-view="parallel"');
    expect(html).toContain('data-face="parallel"');
    expect(html).toContain('data-parallel-grid="true"');
    // One row per German block, each holding its German and, where there is one, its English:
    // the two columns are the two halves of every row (parallelRows.ts).
    const row = html.indexOf('data-parallel-row="bm-s4-p1"');
    expect(row).toBeGreaterThan(-1);
    const german = html.indexOf('data-parallel-half="german"', row);
    const english = html.indexOf('data-parallel-half="english"', row);
    expect(german).toBeGreaterThan(row);
    expect(english).toBeGreaterThan(german);
    expect(english).toBeLessThan(html.indexOf("data-parallel-row=", row + 1));
    expect(html).toContain("Deutscher Originaltext");
    expect(html).toContain("English Translation");
  });

  test("renders statically without JavaScript with complete bilingual content", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
      />,
    );

    // German text present
    expect(html).toContain("Es sei ein Zeitintervall τ gegeben.");
    // English text present
    expect(html).toContain("Let a time interval τ be given.");
    // Footnotes present
    expect(html).toContain("Fußnoten");
  });

  test("includes alignment guidance instructions", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
      />,
    );

    expect(html).toContain(
      "Press <kbd>j</kbd> / <kbd>k</kbd> to step through sentences in reading order.",
    );
  });

  test("renders 320 px stacked parallel layout with layout='stacked' and responsive attributes", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        layout="stacked"
      />,
    );

    expect(html).toContain('data-layout="stacked"');
    expect(html).toContain('data-stacked-layout="true"');
    expect(html).toContain('data-stacked-at-320="true"');
    expect(html).toContain("layout-stacked");
    expect(html).toContain("parallel-stacked");
    expect(html).toContain('data-parallel-half="german"');
    expect(html).toContain('data-parallel-half="english"');
  });

  test("JavaScript-disabled reading lane renders complete static bilingual content and notice", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
      />,
    );

    // noscript container present with data-no-js attribute
    expect(html).toContain("<noscript>");
    expect(html).toContain('data-no-js="true"');
    expect(html).toContain("no-js-reading-lane");
    expect(html).toContain("JavaScript is disabled");

    // Static text is fully accessible without JS
    expect(html).toContain("Es sei ein Zeitintervall τ gegeben.");
    expect(html).toContain("Let a time interval τ be given.");
    expect(html).toContain("bm-s4-p1-s1");
    expect(html).toContain("tr-bm-s4-p1-u1");
  });
});
