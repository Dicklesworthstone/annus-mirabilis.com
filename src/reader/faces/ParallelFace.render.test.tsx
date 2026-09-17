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

    expect(html).toContain("Press <kbd>j</kbd> / <kbd>k</kbd> to step through sentences in reading order.");
  });
});
