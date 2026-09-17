import type { ReviewRecord } from "../../content/schemas/review.ts";
import type { TranslationUnit } from "../../content/schemas/source.ts";

export interface ReviewBadgeInfo {
  readonly label: string;
  readonly reviewClass: "reviewed" | "in-progress" | "draft";
  readonly isReviewed: boolean;
  readonly isStale: boolean;
  readonly description: string;
  readonly reviewer?: string | undefined;
  readonly date?: string | undefined;
}

/**
 * Computes the review badge information for a translation unit.
 *
 * Strict Rule: "Reviewed" is only emitted when an accepted, non-stale review record covers
 * the unit's current revision. A stale review record (where unit.revision > record.translationRevision)
 * falls back to a draft state rather than keeping a reviewed badge.
 */
export function evaluateUnitReviewState(
  unit: TranslationUnit,
  reviewRecord?: ReviewRecord | undefined,
): ReviewBadgeInfo {
  // If a review record is supplied:
  if (reviewRecord) {
    const isAccepted = reviewRecord.result === "accepted";

    // Check if review record covers this unit and revision in scope or acceptedRevisions
    let recordCoveredRevision: number | undefined;
    if (reviewRecord.reviewType === "cross-projection") {
      const scopeEntry = reviewRecord.scope.find((s) => s.recordId === unit.id);
      recordCoveredRevision =
        typeof scopeEntry?.translationRevision === "number"
          ? scopeEntry.translationRevision
          : typeof reviewRecord.translationRevision === "number"
            ? reviewRecord.translationRevision
            : undefined;
    } else {
      const scopeEntry = reviewRecord.scope.find((s) => s.recordId === unit.id);
      recordCoveredRevision =
        typeof scopeEntry?.translationRevision === "number"
          ? scopeEntry.translationRevision
          : typeof reviewRecord.acceptedRevisions?.[unit.id] === "number"
            ? (reviewRecord.acceptedRevisions[unit.id] as number)
            : undefined;
    }

    if (isAccepted) {
      if (recordCoveredRevision !== undefined && recordCoveredRevision < unit.revision) {
        // Revision bump after review -> stale record!
        return {
          label: "Draft (stale review)",
          reviewClass: "draft",
          isReviewed: false,
          isStale: true,
          description: `Previous review (rev ${recordCoveredRevision}) invalidated by revision ${unit.revision}.`,
          reviewer: reviewRecord.reviewer,
          date: reviewRecord.date,
        };
      }

      return {
        label: "Reviewed",
        reviewClass: "reviewed",
        isReviewed: true,
        isStale: false,
        description: `Reviewed by ${reviewRecord.reviewer} on ${reviewRecord.date}.`,
        reviewer: reviewRecord.reviewer,
        date: reviewRecord.date,
      };
    }

    // Review record not accepted
    return {
      label: "Edited draft",
      reviewClass: "in-progress",
      isReviewed: false,
      isStale: false,
      description: `Review in progress by ${reviewRecord.reviewer}.`,
      reviewer: reviewRecord.reviewer,
      date: reviewRecord.date,
    };
  }

  // If no review record is provided, evaluate based on unit's own reviewState
  if (unit.reviewState === "reviewed") {
    // If unit has an editor attribution
    if (unit.editor) {
      const reviewer = unit.editor.name || unit.editor.id || "Reviewer";
      return {
        label: "Reviewed",
        reviewClass: "reviewed",
        isReviewed: true,
        isStale: false,
        description: `Reviewed by ${reviewer}.`,
        reviewer,
      };
    }

    // A unit marked "reviewed" without explicit reviewer attribution is treated as draft
    return {
      label: "Machine draft",
      reviewClass: "draft",
      isReviewed: false,
      isStale: false,
      description: "Draft translation pending formal review record.",
    };
  }

  if (unit.reviewState === "corrected" || unit.reviewState === "in-progress") {
    return {
      label: "Edited draft",
      reviewClass: "in-progress",
      isReviewed: false,
      isStale: false,
      description: "Edited draft translation.",
    };
  }

  // Default: draft / machine draft
  return {
    label: "Machine draft",
    reviewClass: "draft",
    isReviewed: false,
    isStale: false,
    description: "Machine draft translation.",
  };
}

/**
 * Returns true if the paper's translation contains any unreviewed or draft units,
 * which requires rendering the unreviewed translation banner.
 */
export function isPaperTranslationUnreviewed(
  units: readonly TranslationUnit[],
  reviewRecords?: readonly ReviewRecord[] | undefined,
): boolean {
  if (units.length === 0) return true;

  const recordsMap = new Map<string, ReviewRecord>();
  if (reviewRecords) {
    for (const r of reviewRecords) {
      for (const s of r.scope) {
        recordsMap.set(s.recordId, r);
      }
    }
  }

  return units.some((u) => {
    const record = recordsMap.get(u.id);
    const badge = evaluateUnitReviewState(u, record);
    return !badge.isReviewed;
  });
}
