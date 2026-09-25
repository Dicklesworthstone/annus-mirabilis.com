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

// A unit shows its text and no review state: no chip, whether reviewed or a machine draft, and no
// "Alternative translations" disclosure (D-2026-09-25-no-review-status-banners,
// D-2026-09-25-one-best-translation). The state stays in data attributes, for the audit.
describe("TranslationUnit render tests", () => {
  test("a reviewed unit renders with lang='en' and no review chip", () => {
    const unit = getUnit("tr-bm-s4-h1");
    const reviewRecord = FIXTURE_REVIEW_RECORDS.find((r) =>
      r.scope.some((s) => s.recordId === unit.id),
    );
    expect(reviewRecord).toBeDefined();
    const html = renderToStaticMarkup(<TranslationUnit unit={unit} reviewRecord={reviewRecord} />);

    expect(html).toContain('lang="en"');
    expect(html).toContain('data-translation-unit-id="tr-bm-s4-h1"');
    expect(html).toContain("§ 4. On the Irregular Movement");
    expect(html).not.toContain("data-review-badge");
    expect(html).not.toContain("review-badge");
    expect(html).not.toContain(">Reviewed<");
  });

  test("a machine-draft unit renders its text and no draft chip", () => {
    const unit = getUnit("tr-bm-s4-p1-u2");
    const html = renderToStaticMarkup(<TranslationUnit unit={unit} />);

    expect(html).toContain("We shall assume that each individual particle");
    expect(html).not.toContain("data-review-badge");
    expect(html).not.toContain("Machine draft");
  });

  test("a unit with a recorded alternative renders no alternatives disclosure", () => {
    const unit = getUnit("tr-bm-s4-p1-u2");
    // Non-vacuity: the fixture unit does carry an alternative, so its absence below is the rule.
    expect(unit.unresolvedAlternatives.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(<TranslationUnit unit={unit} />);

    expect(html).not.toContain("Alternative translations");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("We assume that every single particle undergoes a shift Δ.");
  });
});
