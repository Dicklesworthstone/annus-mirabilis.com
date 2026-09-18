/**
 * Refusal throw site test suite for editionReviewState.ts (am-muyh).
 *
 * Covers lines 124 and 136 in src/content/checks/review/editionReviewState.ts
 * with authentic accept/reject test pairs, asserting explicit refusal codes
 * and messages, with exact line citations.
 *
 * Zero mocks are used.
 */
import { describe, expect, test } from "bun:test";
import type { ReviewStateCheckContext } from "../../editions/reviewState.ts";
import type { ReviewRecord } from "../../schemas/review.ts";
import { createRecordBackedReviewStateCheck, ReviewStore } from "./editionReviewState.ts";

describe("editionReviewState.ts refusal throw sites (am-muyh)", () => {
  // --------------------------------------------------------------------------
  // Site 1: line 124 - review-record-stale (revision mismatch)
  // --------------------------------------------------------------------------
  test("rejects unit when review record covers older revision (editionReviewState.ts:124)", () => {
    const store = new ReviewStore();
    const record: ReviewRecord = {
      id: "rev-unit-stale",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "unit-10", translationRevision: 1 }],
    };
    store.register(record);
    const check = createRecordBackedReviewStateCheck(store);

    // Reject: unit is at revision 2, but record covers revision 1
    const rejectContext: ReviewStateCheckContext = {
      unitId: "unit-10",
      paper: "brownian-motion",
      layer: "german",
      reviewState: "reviewed",
      revision: 2,
    };
    const rejectResult = check(rejectContext);
    expect(rejectResult.ok).toBe(false);
    if (!rejectResult.ok) {
      expect(rejectResult.code).toBe("review-record-stale");
      expect(rejectResult.message).toBe(
        'Review record "rev-unit-stale" covers revision 1 but unit "unit-10" is at revision 2.',
      );
    }

    // Accept: unit is at revision 1 matching record
    const acceptContext: ReviewStateCheckContext = {
      unitId: "unit-10",
      paper: "brownian-motion",
      layer: "german",
      reviewState: "reviewed",
      revision: 1,
    };
    const acceptResult = check(acceptContext);
    expect(acceptResult.ok).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 2: line 136 - review-record-stale (unitHash mismatch)
  // --------------------------------------------------------------------------
  test("rejects unit when review record unitHash does not match (editionReviewState.ts:136)", () => {
    const store = new ReviewStore();
    const record: ReviewRecord = {
      id: "rev-unit-hash",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [
        {
          recordId: "unit-20",
          translationRevision: 1,
          unitHash: "sha256-hash-initial",
        },
      ],
    };
    store.register(record);
    const check = createRecordBackedReviewStateCheck(store);

    // Reject: unitHash in context differs from recorded unitHash
    const rejectContext: ReviewStateCheckContext = {
      unitId: "unit-20",
      paper: "brownian-motion",
      layer: "german",
      reviewState: "reviewed",
      revision: 1,
      unitHash: "sha256-hash-modified",
    };
    const rejectResult = check(rejectContext);
    expect(rejectResult.ok).toBe(false);
    if (!rejectResult.ok) {
      expect(rejectResult.code).toBe("review-record-stale");
      expect(rejectResult.message).toBe(
        'Review record "rev-unit-hash" unitHash mismatch for unit "unit-20".',
      );
    }

    // Accept: unitHash matches scopeEntry
    const acceptContext: ReviewStateCheckContext = {
      unitId: "unit-20",
      paper: "brownian-motion",
      layer: "german",
      reviewState: "reviewed",
      revision: 1,
      unitHash: "sha256-hash-initial",
    };
    const acceptResult = check(acceptContext);
    expect(acceptResult.ok).toBe(true);
  });
});
