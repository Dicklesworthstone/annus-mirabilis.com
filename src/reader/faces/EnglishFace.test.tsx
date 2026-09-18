import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_EDITORIAL_NOTES,
  FIXTURE_REVIEW_RECORDS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { EnglishFace } from "./EnglishFace.tsx";

describe("EnglishFace readiness contract", () => {
  test("EnglishFace root container emits all three harness readiness attributes", () => {
    const html = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );

    // 1. data-reader-root: marks the reader root element for the browser harness
    expect(html).toContain("data-reader-root");
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);

    // 2. data-ready="true": signals readiness to the harness without arbitrary sleeps
    expect(html).toContain('data-ready="true"');

    // 3. data-view="english": identifies the English reading face specifically
    expect(html).toContain('data-view="english"');
    expect(html).toContain('data-face="english"');
  });

  test("section-scoped EnglishFace preserves all three readiness contract attributes", () => {
    const html = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        sectionId="section-1"
      />,
    );

    expect(html).toContain("data-reader-root");
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="english"');
  });

  test("data-view explicitly identifies the 'english' face rather than a generic or alternate face", () => {
    const html = renderToStaticMarkup(
      <EnglishFace paper={FIXTURE_BROWNIAN_PAPER} units={FIXTURE_BROWNIAN_TRANSLATION_UNITS} />,
    );

    const viewMatch = html.match(/data-view="([^"]+)"/);
    expect(viewMatch).not.toBeNull();
    expect(viewMatch?.[1]).toBe("english");
  });

  test("data-ready is explicitly set to 'true'", () => {
    const html = renderToStaticMarkup(
      <EnglishFace paper={FIXTURE_BROWNIAN_PAPER} units={FIXTURE_BROWNIAN_TRANSLATION_UNITS} />,
    );

    const readyMatch = html.match(/data-ready="([^"]+)"/);
    expect(readyMatch).not.toBeNull();
    expect(readyMatch?.[1]).toBe("true");
  });
});
