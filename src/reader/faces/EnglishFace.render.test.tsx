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
    // NOT "A. D. Cowper", and this is a rights rule rather than a fixture detail.
    // AGENTS.md admits Cowper's 1926 Methuen translation only as a comparison witness
    // cited in a provenance receipt, never as the site's own translation - so a reader
    // face that renders "Translated by A. D. Cowper" is publishing an attribution the
    // project has decided it will not make. f8ffe801 corrected the fixture to
    // fixture-translator and deliberately left this assertion to the reader face's
    // owner rather than rewriting it silently. Restoring the old name reintroduces the
    // rights problem, not a passing test.
    expect(html).toContain("Translated by Fixture Translator");
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
    // The banner states what the units record (reviewState.ts translationReviewSummary): who
    // translated, and how many units a review accepted. This used to pin "This English
    // translation is an in-progress draft", whose "has not yet completed full human review"
    // implied a review under way when none had happened.
    expect(html).toContain("Translation partly reviewed");
    expect(html).toContain(
      "3 of its 6 sentences and displays have been reviewed against the German by jemanuel",
    );
    expect(html).not.toContain("has not yet completed full human review");
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
