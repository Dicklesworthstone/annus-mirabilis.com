import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_REVIEW_RECORDS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { TranslationUnit } from "./TranslationUnit.tsx";

function getUnit(id: string) {
  const unit = FIXTURE_BROWNIAN_TRANSLATION_UNITS.find((u) => u.id === id);
  if (!unit) throw new Error(`Missing fixture translation unit ${id}`);
  return unit;
}

describe("TranslationUnit render tests", () => {
  test("renders translation unit with lang='en' and review badge", () => {
    const unit = getUnit("tr-bm-s4-h1");
    const reviewRecord = FIXTURE_REVIEW_RECORDS.find((r) =>
      r.scope.some((s) => s.recordId === unit.id),
    );
    const html = renderToStaticMarkup(<TranslationUnit unit={unit} reviewRecord={reviewRecord} />);

    expect(html).toContain('lang="en"');
    expect(html).toContain('data-translation-unit-id="tr-bm-s4-h1"');
    expect(html).toContain('data-review-badge="Reviewed"');
    expect(html).toContain("badge-reviewed");
    expect(html).toContain("§ 4. On the Irregular Movement");
  });

  test("renders machine draft unit with draft badge", () => {
    const unit = getUnit("tr-bm-s4-p1-u2");
    const html = renderToStaticMarkup(<TranslationUnit unit={unit} />);

    expect(html).toContain('data-review-badge="Machine draft"');
    expect(html).toContain("badge-draft");
    expect(html).toContain("We shall assume that each individual particle");
  });

  test("renders unresolved alternatives disclosure when present", () => {
    const unit = getUnit("tr-bm-s4-p1-u2");
    const html = renderToStaticMarkup(<TranslationUnit unit={unit} />);

    expect(html).toContain("Alternative translations (1)");
    expect(html).toContain("We assume that every single particle undergoes a shift Δ.");
    expect(html).toContain("More direct literal phrasing of &#x27;erfahre&#x27;");
  });
});
