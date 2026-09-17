import { describe, expect, test } from "bun:test";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import {
  FIXTURE_MASS_ENERGY_GLOSS_UNITS,
  FIXTURE_MASS_ENERGY_TRANSLATION_UNITS,
} from "../../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { evaluateUnitReviewState, isPaperTranslationUnreviewed } from "./reviewState.ts";

describe("glossReviewState: review state validation for gloss units and translations", () => {
  const reviewedUnit = FIXTURE_MASS_ENERGY_TRANSLATION_UNITS[0]; // tr-me-p1-u1, rev 1
  if (!reviewedUnit) throw new Error("Missing reviewedUnit");
  const draftUnit = FIXTURE_MASS_ENERGY_TRANSLATION_UNITS[2]; // tr-me-p2-u1, draft
  if (!draftUnit) throw new Error("Missing draftUnit");
  const glossDraft = FIXTURE_MASS_ENERGY_GLOSS_UNITS.find((g) => g.sentenceId === "me-p2-s1");
  if (!glossDraft) throw new Error("Missing glossDraft");

  const validRecord: ReviewRecord = {
    id: "rev-me-p1-u1",
    reviewType: "physics-math",
    reviewer: "jemanuel",
    scope: [
      {
        recordId: "tr-me-p1-u1",
        translationRevision: 1,
      },
    ],
    date: "2026-09-15",
    result: "accepted",
    acceptedRevisions: {
      "tr-me-p1-u1": 1,
    },
  };

  const staleRecord: ReviewRecord = {
    id: "rev-me-p1-stale",
    reviewType: "physics-math",
    reviewer: "jemanuel",
    scope: [
      {
        recordId: "tr-me-p1-u1",
        translationRevision: 0,
      },
    ],
    date: "2026-09-01",
    result: "accepted",
    acceptedRevisions: {
      "tr-me-p1-u1": 0,
    },
  };

  test("translation unit with valid accepted review record shows Reviewed", () => {
    const badge = evaluateUnitReviewState(reviewedUnit, validRecord);
    expect(badge.label).toBe("Reviewed");
    expect(badge.isReviewed).toBe(true);
    expect(badge.isStale).toBe(false);
  });

  test("translation unit with stale review record (bumped revision) falls back to draft", () => {
    const badge = evaluateUnitReviewState(reviewedUnit, staleRecord);
    expect(badge.label).toBe("Draft (stale review)");
    expect(badge.isReviewed).toBe(false);
    expect(badge.isStale).toBe(true);
  });

  test("draft unit without review record shows Machine draft or Edited draft", () => {
    const badge = evaluateUnitReviewState(draftUnit);
    expect(badge.isReviewed).toBe(false);
    expect(badge.label).toContain("draft");
  });

  test("gloss unit without human editor or review is in draft review state", () => {
    expect(glossDraft.reviewState).toBe("draft");
    expect(glossDraft.attribution.id).toBe("agent:claude-3-5-sonnet");
  });

  test("isPaperTranslationUnreviewed returns true when draft units exist in paper", () => {
    const hasUnreviewed = isPaperTranslationUnreviewed(FIXTURE_MASS_ENERGY_TRANSLATION_UNITS, [
      validRecord,
    ]);
    expect(hasUnreviewed).toBe(true);
  });
});
