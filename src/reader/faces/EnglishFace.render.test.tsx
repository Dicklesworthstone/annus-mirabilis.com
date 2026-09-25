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
  test("renders the English face's metadata, and no translator credit line", () => {
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
    // No "Translated by" line at all (D-2026-09-25-no-review-status-banners): the translator is in
    // each unit's record and the provenance receipt. The rights rule this line used to hold still
    // holds: AGENTS.md admits Cowper's 1926 Methuen translation only as a comparison witness, so no
    // face may attribute the site's translation to "A. D. Cowper".
    expect(html).not.toContain("Translated by");
    expect(html).not.toContain("Fixture Translator");
    expect(html).not.toContain("Cowper");
  });

  test("however many agents translated a paper, the face names none of them", () => {
    // Relativity was translated a part at a time, by two agents. The face credited them both in a
    // "Translated by" line; since D-2026-09-25-no-review-status-banners it credits no one.
    const first = { id: "agent:First", name: "First Translator", kind: "model" as const };
    const second = { id: "agent:Second", name: "Second Translator", kind: "model" as const };
    const n = FIXTURE_BROWNIAN_TRANSLATION_UNITS.length;
    const render = (units: typeof FIXTURE_BROWNIAN_TRANSLATION_UNITS) =>
      renderToStaticMarkup(
        <EnglishFace
          paper={FIXTURE_BROWNIAN_PAPER}
          units={units}
          alignment={FIXTURE_BROWNIAN_ALIGNMENT}
          reviewRecords={FIXTURE_REVIEW_RECORDS}
        />,
      );
    const two = FIXTURE_BROWNIAN_TRANSLATION_UNITS.map((u, i) => ({
      ...u,
      translator: i >= n - 2 ? second : first,
    }));
    const one = FIXTURE_BROWNIAN_TRANSLATION_UNITS.map((u) => ({ ...u, translator: first }));
    for (const html of [render(two), render(one)]) {
      expect(html).not.toContain("Translated by");
      expect(html).not.toContain("First Translator");
      expect(html).not.toContain("Second Translator");
    }
  });

  test("draft units and a person's review records show no banner and name no reviewer", () => {
    const html = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );

    // The fixture's review records accept 3 of its 6 units, reviewed by jemanuel. The banner said so
    // ("Translation partly reviewed"); now the face says nothing about review, which claims nothing.
    expect(html).not.toContain("data-unreviewed-banner");
    expect(html).not.toMatch(/partly reviewed|reviewed against the German|not yet reviewed/);
    expect(html).not.toContain("jemanuel");
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
