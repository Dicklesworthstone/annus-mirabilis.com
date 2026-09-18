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

describe("ParallelFace readiness contract", () => {
  test("main parallel face is a ready reader root with pinned face name", () => {
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

    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="parallel"');
    expect(html).toContain('data-face="parallel"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });

  test("section-scoped parallel face preserves all readiness contract attributes and pinned face name", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
        sectionId="section-1"
      />,
    );

    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="parallel"');
    expect(html).toContain('data-face="parallel"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });

  test("stacked responsive parallel layout preserves all readiness contract attributes and pinned face name", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        layout="stacked"
      />,
    );

    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="parallel"');
    expect(html).toContain('data-face="parallel"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });
});
