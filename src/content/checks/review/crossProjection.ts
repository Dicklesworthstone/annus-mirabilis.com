/**
 * Cross-projection review record validation and checks.
 * Specification: am-edit-review-records-hofz (§4.3, §10.4, §17.1, §17.2, §17.7)
 */

import { loadOwnersRegistry, type OwnersRegistry } from "../../owners/parseOwners.ts";
import {
  type AuthorshipBlock,
  type AuthorshipEntry,
  authorshipOf,
  validateAuthorshipBlock,
} from "../../schemas/authorship.ts";
import type {
  CrossProjectionProjection,
  CrossProjectionReviewRecord,
} from "../../schemas/review.ts";

export type CrossProjectionIssue = Readonly<{
  code:
    | "cross-projection-unknown-reviewer"
    | "cross-projection-invalid-role"
    | "cross-projection-self-review"
    | "cross-projection-stale"
    | "cross-projection-missing-finding"
    | "cross-projection-invalid-bead-id";
  message: string;
  projection?: CrossProjectionProjection | undefined;
  reviewerId?: string | undefined;
  claimId?: string | undefined;
  expectedRevision?: number | string | undefined;
  actualRevision?: number | string | undefined;
}>;

export type ProjectionAuthorshipContext = Readonly<{
  projection: CrossProjectionProjection;
  anchor: string;
  authorship?: AuthorshipBlock | Record<string, unknown> | undefined;
  record?: unknown;
}>;

/**
 * Checks reviewer roles and self-review conflicts across all 11 projections.
 */
export function checkCrossProjectionReviewer(
  record: CrossProjectionReviewRecord,
  projectionContexts: readonly ProjectionAuthorshipContext[],
  ownersRegistry: OwnersRegistry = loadOwnersRegistry(),
): readonly CrossProjectionIssue[] {
  const issues: CrossProjectionIssue[] = [];
  const reviewerId = record.reviewer;

  // 1. Check reviewer exists in OWNERS.md
  const owner = ownersRegistry.getOwner(reviewerId);
  if (!owner) {
    issues.push({
      code: "cross-projection-unknown-reviewer",
      message: `Reviewer "${reviewerId}" is not found in docs/OWNERS.md.`,
      reviewerId,
      claimId: record.claimId,
    });
    return issues;
  }

  // 2. Check reviewer holds cross-projection-reviewer role
  if (!ownersRegistry.hasRole(reviewerId, "cross-projection-reviewer")) {
    issues.push({
      code: "cross-projection-invalid-role",
      message: `Reviewer "${reviewerId}" does not hold role "cross-projection-reviewer".`,
      reviewerId,
      claimId: record.claimId,
    });
  }

  // 3. Self-review check across projections
  for (const ctx of projectionContexts) {
    let block: AuthorshipBlock | null = null;
    if (ctx.authorship) {
      try {
        block = validateAuthorshipBlock(ctx.authorship);
      } catch {
        // Ignore
      }
    } else if (ctx.record) {
      try {
        block = authorshipOf(ctx.record);
      } catch {
        // Ignore
      }
    }

    if (block) {
      const allEntries: AuthorshipEntry[] = [
        ...block.draftedBy,
        ...(block.translatedBy ?? []),
        ...(block.editedBy ?? []),
      ];

      if (allEntries.some((e) => e.id === reviewerId)) {
        issues.push({
          code: "cross-projection-self-review",
          message: `Reviewer "${reviewerId}" authored projection "${ctx.projection}" at anchor "${ctx.anchor}".`,
          projection: ctx.projection,
          reviewerId,
          claimId: record.claimId,
        });
      }
    }
  }

  return issues;
}

/**
 * Checks staleness of cross-projection review record against compiled revisions.
 */
export function checkCrossProjectionStaleness(
  record: CrossProjectionReviewRecord,
  currentRevisions: {
    contentRevision: number | string;
    translationRevision: number | string;
  },
): readonly CrossProjectionIssue[] {
  const issues: CrossProjectionIssue[] = [];

  if (String(record.contentRevision) !== String(currentRevisions.contentRevision)) {
    issues.push({
      code: "cross-projection-stale",
      message: `Cross-projection review contentRevision ${record.contentRevision} does not match current compiled revision ${currentRevisions.contentRevision}.`,
      claimId: record.claimId,
      expectedRevision: record.contentRevision,
      actualRevision: currentRevisions.contentRevision,
    });
  }

  if (String(record.translationRevision) !== String(currentRevisions.translationRevision)) {
    issues.push({
      code: "cross-projection-stale",
      message: `Cross-projection review translationRevision ${record.translationRevision} does not match current compiled revision ${currentRevisions.translationRevision}.`,
      claimId: record.claimId,
      expectedRevision: record.translationRevision,
      actualRevision: currentRevisions.translationRevision,
    });
  }

  return issues;
}
