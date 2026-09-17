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

describe("EnglishFace render tests", () => {
  test("renders full English translation face with metadata and translator credits", () => {
    const html = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );

    expect(html).toContain('data-view="english"');
    expect(html).toContain('data-face="english"');
    expect(html).toContain('lang="en"');
    expect(html).toContain("On the Movement of Small Particles");
    expect(html).toContain("By A. Einstein");
    expect(html).toContain("Translated by A. D. Cowper");
  });

  test("renders unreviewed translation banner when draft units exist", () => {
    const html = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );

    expect(html).toContain('data-unreviewed-banner="true"');
    expect(html).toContain("Draft Translation");
    expect(html).toContain("This English translation is an in-progress draft");
  });

  test("renders all translation units in order", () => {
    const html = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );

    expect(html).toContain('data-translation-unit-id="tr-bm-s4-h1"');
    expect(html).toContain('data-translation-unit-id="tr-bm-s4-p1-u1"');
    expect(html).toContain('data-translation-unit-id="tr-bm-s4-p1-u2"');
    expect(html).toContain('data-translation-unit-id="tr-bm-s4-eq1"');
    expect(html).toContain('data-translation-unit-id="tr-bm-s5-h1"');
    expect(html).toContain('data-translation-unit-id="tr-bm-s5-p1-u1"');
  });
});
