import { describe, expect, test } from "bun:test";
import {
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_REVIEW_RECORDS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { evaluateUnitReviewState, isPaperTranslationUnreviewed } from "./reviewState.ts";

function getUnit(id: string) {
  const unit = FIXTURE_BROWNIAN_TRANSLATION_UNITS.find((u) => u.id === id);
  if (!unit) throw new Error(`Missing unit fixture: ${id}`);
  return unit;
}

function getRecord(index: number) {
  const record = FIXTURE_REVIEW_RECORDS[index];
  if (!record) throw new Error(`Missing review record fixture at index: ${index}`);
  return record;
}

describe("reviewState: unit evaluation and stale review fallback", () => {
  const reviewedUnit = FIXTURE_BROWNIAN_TRANSLATION_UNITS[0];
  if (!reviewedUnit) throw new Error("Missing reviewedUnit fixture");
  const draftUnit = getUnit("tr-bm-s4-p1-u2");
  const validRecord = getRecord(0);
  const staleRecord = getRecord(1);
  const bumpedUnit = getUnit("tr-bm-s5-p1-u1");

  test("valid accepted review record emits 'Reviewed' with reviewer and date", () => {
    const badge = evaluateUnitReviewState(reviewedUnit, validRecord);
    expect(badge.label).toBe("Reviewed");
    expect(badge.isReviewed).toBe(true);
    expect(badge.isStale).toBe(false);
    expect(badge.reviewer).toBe("jemanuel");
    expect(badge.date).toBe("2026-09-15");
    expect(badge.description).toContain("Reviewed by jemanuel on 2026-09-15");
  });

  test("stale review record (unit revision bumped after review) falls back to draft state", () => {
    const badge = evaluateUnitReviewState(bumpedUnit, staleRecord);
    expect(badge.isReviewed).toBe(false);
    expect(badge.isStale).toBe(true);
    expect(badge.label).toBe("Draft (stale review)");
    expect(badge.description).toContain("invalidated by revision 1");
  });

  test("unit without review record or editor shows Machine draft", () => {
    const badge = evaluateUnitReviewState(draftUnit);
    expect(badge.label).toBe("Machine draft");
    expect(badge.isReviewed).toBe(false);
    expect(badge.isStale).toBe(false);
  });

  test("in-progress / corrected unit shows Edited draft", () => {
    const inProgUnit = getUnit("tr-bm-s5-h1");
    const badge = evaluateUnitReviewState(inProgUnit);
    expect(badge.label).toBe("Edited draft");
    expect(badge.isReviewed).toBe(false);
  });

  test("isPaperTranslationUnreviewed returns true when draft units exist", () => {
    const hasUnreviewed = isPaperTranslationUnreviewed(
      FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      FIXTURE_REVIEW_RECORDS,
    );
    expect(hasUnreviewed).toBe(true);
  });

  test("isPaperTranslationUnreviewed returns false only when all units have valid accepted reviews", () => {
    const allReviewedUnits = [reviewedUnit];
    const isUnreviewed = isPaperTranslationUnreviewed(allReviewedUnits, [validRecord]);
    expect(isUnreviewed).toBe(false);
  });
});
