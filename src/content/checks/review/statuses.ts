/**
 * Compiler checks on entity review statuses and discovery journey move summaries.
 * Specification: am-edit-review-records-hofz (§4.3, §10.4, §17.2)
 */

import {
  loadOwnersRegistry,
  type OwnersRegistry,
  ROLE_TO_REVIEW_TYPE,
} from "../../owners/parseOwners.ts";
import type { ReviewRecord, ReviewType } from "../../schemas/review.ts";

export type StatusCheckIssue = Readonly<{
  code:
    | "review-record-missing"
    | "review-record-stale"
    | "review-reviewer-unknown"
    | "review-reviewer-role"
    | "review-scope-nonexistent-target"
    | "review-self-review";
  message: string;
  entityId: string;
  reviewType?: ReviewType | undefined;
  expectedRevision?: number | string | undefined;
  actualRevision?: number | string | undefined;
}>;

export type EntityForReviewCheck = Readonly<{
  id: string;
  type: string;
  revision?: number | string | undefined;
  contentRevision?: number | string | undefined;
  translationRevision?: number | string | undefined;
  reviewState?: string | undefined;
  status?: string | undefined;
  unitHash?: string | undefined;
  move?:
    | {
        r0Summary?: {
          reviewState?: string | undefined;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }
    | undefined;
}>;

/**
 * Checks review records for a given entity that has a "reviewed" status/reviewState.
 */
export function checkEntityReviewStatus(
  entity: EntityForReviewCheck,
  records: readonly ReviewRecord[],
  ownersRegistry: OwnersRegistry = loadOwnersRegistry(),
  requiredReviewType?: ReviewType,
): readonly StatusCheckIssue[] {
  const issues: StatusCheckIssue[] = [];

  // Determine if entity is in 'reviewed' state
  const isReviewed = entity.reviewState === "reviewed" || entity.status === "reviewed";

  if (!isReviewed) {
    return issues;
  }

  // Find review records covering this entity
  const coveringRecords = records.filter((r) => r.scope.some((s) => s.recordId === entity.id));

  if (coveringRecords.length === 0) {
    issues.push({
      code: "review-record-missing",
      message: `Entity "${entity.id}" has reviewed status but no review record covers it.`,
      entityId: entity.id,
      reviewType: requiredReviewType,
    });
    return issues;
  }

  // Filter by matching review type if specified
  const matchingTypeRecords = requiredReviewType
    ? coveringRecords.filter((r) => r.reviewType === requiredReviewType)
    : coveringRecords;

  if (matchingTypeRecords.length === 0) {
    issues.push({
      code: "review-record-missing",
      message: `Entity "${entity.id}" has reviewed status but no "${requiredReviewType}" review record covers it.`,
      entityId: entity.id,
      reviewType: requiredReviewType,
    });
    return issues;
  }

  // Check valid covering record
  let hasValidAccepted = false;
  let staleIssue: StatusCheckIssue | null = null;

  for (const record of matchingTypeRecords) {
    const reviewer = record.reviewer;

    // 1. Reviewer unknown
    const owner = ownersRegistry.getOwner(reviewer);
    if (!owner) {
      issues.push({
        code: "review-reviewer-unknown",
        message: `Reviewer "${reviewer}" is not found in docs/OWNERS.md.`,
        entityId: entity.id,
      });
      continue;
    }

    // 2. Reviewer role
    const roles = ownersRegistry.rolesOf(reviewer);
    const allowedTypes = roles
      .map((role) => ROLE_TO_REVIEW_TYPE[role as keyof typeof ROLE_TO_REVIEW_TYPE])
      .filter(Boolean);

    if (!allowedTypes.includes(record.reviewType)) {
      issues.push({
        code: "review-reviewer-role",
        message: `Reviewer "${reviewer}" lacks matching role for review type "${record.reviewType}".`,
        entityId: entity.id,
      });
      continue;
    }

    // 3. Result check
    if (record.result !== "accepted" && record.result !== "accepted-with-changes") {
      staleIssue = {
        code: "review-record-stale",
        message: `Review record "${record.id}" for entity "${entity.id}" has outcome "${record.result}".`,
        entityId: entity.id,
      };
      continue;
    }

    // 4. Staleness check
    const scopeEntry = record.scope.find((s) => s.recordId === entity.id);
    if (!scopeEntry) continue;

    const currentRevision = entity.revision ?? entity.translationRevision ?? entity.contentRevision;

    const recordedRevision =
      record.result === "accepted-with-changes" &&
      record.acceptedRevisions &&
      record.acceptedRevisions[entity.id] !== undefined
        ? record.acceptedRevisions[entity.id]
        : (scopeEntry.translationRevision ?? scopeEntry.contentRevision);

    if (
      currentRevision !== undefined &&
      recordedRevision !== undefined &&
      String(currentRevision) !== String(recordedRevision)
    ) {
      staleIssue = {
        code: "review-record-stale",
        message: `Review record "${record.id}" covers revision ${recordedRevision} but entity "${entity.id}" is at revision ${currentRevision}.`,
        entityId: entity.id,
        expectedRevision: recordedRevision,
        actualRevision: currentRevision,
      };
      continue;
    }

    if (
      entity.unitHash !== undefined &&
      scopeEntry.unitHash !== undefined &&
      scopeEntry.unitHash !== entity.unitHash
    ) {
      staleIssue = {
        code: "review-record-stale",
        message: `Review record "${record.id}" unitHash mismatch for entity "${entity.id}".`,
        entityId: entity.id,
      };
      continue;
    }

    hasValidAccepted = true;
    break;
  }

  if (!hasValidAccepted) {
    if (staleIssue) {
      issues.push(staleIssue);
    } else if (issues.length === 0) {
      issues.push({
        code: "review-record-missing",
        message: `Entity "${entity.id}" does not have a valid accepted review record.`,
        entityId: entity.id,
      });
    }
  }

  return issues;
}

/**
 * Checks review status for journey move.r0Summary.
 */
export function checkJourneyMoveSummaryReview(
  journey: EntityForReviewCheck,
  records: readonly ReviewRecord[],
  ownersRegistry: OwnersRegistry = loadOwnersRegistry(),
): readonly StatusCheckIssue[] {
  const issues: StatusCheckIssue[] = [];
  const r0SummaryState = journey.move?.r0Summary?.reviewState;

  if (r0SummaryState !== "reviewed") {
    return issues;
  }

  // Must be covered by a physics-math review record
  return checkEntityReviewStatus(
    {
      id: journey.id,
      type: "journey",
      revision: journey.revision ?? journey.contentRevision,
      reviewState: "reviewed",
    },
    records,
    ownersRegistry,
    "physics-math",
  );
}
