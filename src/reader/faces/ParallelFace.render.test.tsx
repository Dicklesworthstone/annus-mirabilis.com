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
import { ParallelFace } from "./ParallelFace.tsx";

describe("ParallelFace render tests", () => {
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
    expect(html).toContain('data-parallel-column="german"');
    expect(html).toContain('data-parallel-column="english"');
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
    expect(html).toContain('data-parallel-column="german"');
    expect(html).toContain('data-parallel-column="english"');
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
