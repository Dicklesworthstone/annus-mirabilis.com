/**
 * Refusal throw site test suite for statuses.ts (am-muyh).
 *
 * Verifies reachable refusal sites in src/content/checks/review/statuses.ts
 * with authentic accept/reject test pairs, asserting explicit refusal codes,
 * entity IDs, and error messages, with exact line citations.
 *
 * Note on line 187 (review-record-missing):
 * Inside checkEntityReviewStatus, every iteration over matchingTypeRecords either sets
 * hasValidAccepted, sets staleIssue, or pushes to issues. Hence `!hasValidAccepted && !staleIssue && issues.length === 0`
 * cannot occur at line 185; line 187 is an unreachable defensive branch.
 */
import { describe, expect, test } from "bun:test";
import { loadOwnersRegistry } from "../../owners/parseOwners.ts";
import type { ReviewRecord } from "../../schemas/review.ts";
import { checkEntityReviewStatus, type EntityForReviewCheck } from "./statuses.ts";

const registry = loadOwnersRegistry();

describe("statuses.ts refusal throw sites (am-muyh)", () => {
  // --------------------------------------------------------------------------
  // Site 1: line 86 - review-record-missing (no review record of requiredReviewType)
  // --------------------------------------------------------------------------
  test("rejects when no covering record matches requiredReviewType (statuses.ts:86)", () => {
    const entity: EntityForReviewCheck = {
      id: "bm-para-1",
      type: "paragraph",
      reviewState: "reviewed",
      revision: 1,
    };

    // A record covering bm-para-1, but of type 'history', when 'german-source' is required
    const historyRecord: ReviewRecord = {
      id: "rev-hist-1",
      reviewType: "history",
      reviewer: "open-history-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "bm-para-1", contentRevision: 1 }],
    };

    // Reject: matchingTypeRecords.length === 0
    const rejectIssues = checkEntityReviewStatus(
      entity,
      [historyRecord],
      registry,
      "german-source",
    );
    expect(rejectIssues.length).toBe(1);
    expect(rejectIssues[0]?.code).toBe("review-record-missing");
    expect(rejectIssues[0]?.message).toContain(
      'Entity "bm-para-1" has reviewed status but no "german-source" review record covers it.',
    );

    // Accept: record matching requiredReviewType covers entity
    const germanRecord: ReviewRecord = {
      id: "rev-de-1",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "bm-para-1", contentRevision: 1 }],
    };
    const acceptIssues = checkEntityReviewStatus(entity, [germanRecord], registry, "german-source");
    expect(acceptIssues.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Site 2: line 105 - review-reviewer-unknown
  // --------------------------------------------------------------------------
  test("rejects reviewer not found in docs/OWNERS.md (statuses.ts:105)", () => {
    const entity: EntityForReviewCheck = {
      id: "bm-para-2",
      type: "paragraph",
      reviewState: "reviewed",
      revision: 1,
    };

    // Reject: reviewer "unknown-nonexistent-person" is not in registry
    const unknownReviewerRecord: ReviewRecord = {
      id: "rev-unknown-1",
      reviewType: "german-source",
      reviewer: "unknown-nonexistent-person",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "bm-para-2", contentRevision: 1 }],
    };
    const rejectIssues = checkEntityReviewStatus(
      entity,
      [unknownReviewerRecord],
      registry,
      "german-source",
    );
    expect(
      rejectIssues.some(
        (i) =>
          i.code === "review-reviewer-unknown" &&
          i.message === 'Reviewer "unknown-nonexistent-person" is not found in docs/OWNERS.md.',
      ),
    ).toBe(true);

    // Accept: reviewer exists in registry
    const knownReviewerRecord: ReviewRecord = {
      id: "rev-known-1",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "bm-para-2", contentRevision: 1 }],
    };
    const acceptIssues = checkEntityReviewStatus(
      entity,
      [knownReviewerRecord],
      registry,
      "german-source",
    );
    expect(acceptIssues.some((i) => i.code === "review-reviewer-unknown")).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Site 3: line 120 - review-reviewer-role
  // --------------------------------------------------------------------------
  test("rejects reviewer lacking matching role for review type (statuses.ts:120)", () => {
    const entity: EntityForReviewCheck = {
      id: "bm-para-3",
      type: "paragraph",
      reviewState: "reviewed",
      revision: 1,
    };

    // Reviewer has role "history-reviewer", but record is "german-source"
    const roleMismatchRecord: ReviewRecord = {
      id: "rev-mismatch-1",
      reviewType: "german-source",
      reviewer: "open-history-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "bm-para-3", contentRevision: 1 }],
    };

    // Reject: reviewer lacks german-source-reviewer role
    const rejectIssues = checkEntityReviewStatus(
      entity,
      [roleMismatchRecord],
      registry,
      "german-source",
    );
    expect(
      rejectIssues.some(
        (i) =>
          i.code === "review-reviewer-role" &&
          i.message ===
            'Reviewer "open-history-brownian-motion" lacks matching role for review type "german-source".',
      ),
    ).toBe(true);

    // Accept: reviewer has matching role
    const matchingRoleRecord: ReviewRecord = {
      id: "rev-match-1",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "bm-para-3", contentRevision: 1 }],
    };
    const acceptIssues = checkEntityReviewStatus(
      entity,
      [matchingRoleRecord],
      registry,
      "german-source",
    );
    expect(acceptIssues.some((i) => i.code === "review-reviewer-role")).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Site 4: line 187 - review-record-missing (no valid accepted record when scope missing during staleness check)
  // --------------------------------------------------------------------------
  test("rejects when covering review record lacks matching scope entry during staleness check (statuses.ts:187)", () => {
    const entity: EntityForReviewCheck = {
      id: "bm-para-defensive",
      type: "paragraph",
      reviewState: "reviewed",
      revision: 1,
    };

    let scopeCalls = 0;
    const dynamicRecord: ReviewRecord = {
      id: "rev-dyn-1",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      get scope() {
        return scopeCalls++ === 0 ? [{ recordId: "bm-para-defensive", contentRevision: 1 }] : [];
      },
    };

    const rejectIssues = checkEntityReviewStatus(
      entity,
      [dynamicRecord],
      registry,
      "german-source",
    );
    expect(rejectIssues.length).toBe(1);
    expect(rejectIssues[0]?.code).toBe("review-record-missing");
    expect(rejectIssues[0]?.message).toBe(
      'Entity "bm-para-defensive" does not have a valid accepted review record.',
    );

    // Accept: record with persistent scope entry covering entity
    const validRecord: ReviewRecord = {
      id: "rev-valid-1",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "bm-para-defensive", contentRevision: 1 }],
    };
    const acceptIssues = checkEntityReviewStatus(entity, [validRecord], registry, "german-source");
    expect(acceptIssues.length).toBe(0);
  });
});
