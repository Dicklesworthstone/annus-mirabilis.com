/**
 * Refusal throw site test suite for editionReviewState.ts (am-muyh).
 *
 * Covers lines 51, 99, 124 and 136 in src/content/checks/review/editionReviewState.ts
 * with authentic accept/reject test pairs, asserting explicit refusal codes
 * and messages, with exact line citations.
 *
 * THE MESSAGE IS LOAD-BEARING IN EVERY CASE HERE, not decoration. Two codes are
 * repeated across sites - `review-record-missing` at :51 and :147, and
 * `review-record-stale` at :99, :124 and :136 - so a test asserting only `code` is
 * satisfied by any of its siblings and pins nothing. Under am-ksl3 an uncited site
 * under a repeated code is never credited, and the citations above are what earn it.
 *
 * :147 IS DELIBERATELY NOT COVERED, because it cannot fire. See the asserted
 * unreachability claim at the end of this file; it is a claim with a premise rather
 * than a prose note, so it turns red if the premise stops holding.
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
  // --------------------------------------------------------------------------
  // Site 3: line 51 - review-record-missing (no german-source record for the unit)
  //
  // Distinguished from its sibling at :147 by the MESSAGE alone; both carry
  // review-record-missing. Observed before this was written:
  //   :51   No german-source review record found covering unit "...".
  //   :147  No valid german-source review record accepts unit "...".
  // --------------------------------------------------------------------------
  test("rejects a unit with no german-source review record (editionReviewState.ts:51)", () => {
    const store = new ReviewStore();
    const check = createRecordBackedReviewStateCheck(store);

    // Reject: the store holds nothing for this unit.
    const rejectResult = check({
      unitId: "unit-absent",
      paper: "brownian-motion",
      layer: "german",
      reviewState: "reviewed",
    } as ReviewStateCheckContext);
    expect(rejectResult.ok).toBe(false);
    if (!rejectResult.ok) {
      expect(rejectResult.code).toBe("review-record-missing");
      // The :147 sibling would say "No valid ... accepts"; this arm says "found covering".
      expect(rejectResult.message).toBe(
        'No german-source review record found covering unit "unit-absent".',
      );
    }

    // Reject for the same reason when records exist but none is scoped to this unit:
    // ReviewStore indexes by scopeEntry.recordId, so such a record is not returned at
    // all and the unit still reaches :51 rather than the trailing fallback.
    const other: ReviewRecord = {
      id: "rev-other-unit",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "some-other-unit", translationRevision: 1 }],
    };
    store.register(other);
    const stillMissing = check({
      unitId: "unit-absent",
      paper: "brownian-motion",
      layer: "german",
      reviewState: "reviewed",
    } as ReviewStateCheckContext);
    expect(stillMissing.ok).toBe(false);
    if (!stillMissing.ok) {
      expect(stillMissing.message).toBe(
        'No german-source review record found covering unit "unit-absent".',
      );
    }

    // Accept: an in-scope accepted record for the same unit clears the arm.
    const covering: ReviewRecord = {
      id: "rev-covering",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "unit-absent", translationRevision: 1 }],
    };
    store.register(covering);
    const acceptResult = check({
      unitId: "unit-absent",
      paper: "brownian-motion",
      layer: "german",
      reviewState: "reviewed",
      revision: 1,
    } as ReviewStateCheckContext);
    expect(acceptResult.ok).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 4: line 99 - review-record-stale (record result is not an acceptance)
  //
  // Shares review-record-stale with :124 (revision mismatch) and :136 (unitHash
  // mismatch), and those two are reached LATER in the same iteration, so only the
  // message separates this arm from them.
  // --------------------------------------------------------------------------
  test("rejects a unit whose review record was not accepted (editionReviewState.ts:99)", () => {
    const store = new ReviewStore();
    const rejected: ReviewRecord = {
      id: "rev-rejected",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "rejected",
      scope: [{ recordId: "unit-30", translationRevision: 1 }],
    };
    store.register(rejected);
    const check = createRecordBackedReviewStateCheck(store);

    // Reject: revision and unitHash both MATCH, so :124 and :136 have nothing to fire
    // on and the refusal can only have come from :99.
    const rejectResult = check({
      unitId: "unit-30",
      paper: "brownian-motion",
      layer: "german",
      reviewState: "reviewed",
      revision: 1,
    } as ReviewStateCheckContext);
    expect(rejectResult.ok).toBe(false);
    if (!rejectResult.ok) {
      expect(rejectResult.code).toBe("review-record-stale");
      expect(rejectResult.message).toBe(
        'Review record "rev-rejected" for unit "unit-30" has result "rejected".',
      );
      expect(rejectResult.message).not.toContain("covers revision");
      expect(rejectResult.message).not.toContain("unitHash mismatch");
    }

    // Accept: the same record at an accepting result clears the arm.
    const acceptedStore = new ReviewStore();
    acceptedStore.register({ ...rejected, id: "rev-accepted", result: "accepted-with-changes" });
    const acceptResult = createRecordBackedReviewStateCheck(acceptedStore)({
      unitId: "unit-30",
      paper: "brownian-motion",
      layer: "german",
      reviewState: "reviewed",
      revision: 1,
    } as ReviewStateCheckContext);
    expect(acceptResult.ok).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 5: line 147 - review-record-missing, and NOTHING CAN REACH IT
  //
  // The trailing fallback after the loop. Every path through the loop body returns;
  // the single exception is the `continue` when the record carries no scope entry for
  // this unit, so that `continue` is the only route to :147.
  //
  // It cannot fire, and the reason lives in the PRODUCER rather than in this function:
  // ReviewStore.register indexes recordsByUnitId keyed by scopeEntry.recordId, so every
  // record getRecordsForUnit(u) returns necessarily carries a scope entry naming u, and
  // record.scope.find(...) at :105 never returns undefined.
  //
  // That is a premise, not a proof, so it is ASSERTED here rather than asserted in
  // prose. If anyone re-keys the index - or returns records from a second source that
  // does not maintain the invariant - this test goes red and :147 becomes live and
  // owed. A note saying "unreachable" would not have noticed. (am-r3qt: two
  // unreachability notes in this pass were wrong precisely because they stated a
  // conclusion whose premise nobody re-checked.)
  // --------------------------------------------------------------------------
  test("editionReviewState.ts:147 is unreachable: the store's index guarantees a scope entry", () => {
    const store = new ReviewStore();
    store.register({
      id: "rev-multi",
      reviewType: "german-source",
      reviewer: "open-german-source-brownian-motion",
      date: "2026-09-16",
      result: "accepted",
      scope: [
        { recordId: "unit-A", translationRevision: 1 },
        { recordId: "unit-B", translationRevision: 1 },
      ],
    } as ReviewRecord);

    // The invariant, over a record scoped to TWO units and a unit scoped to none.
    for (const unitId of ["unit-A", "unit-B", "unit-C"]) {
      for (const record of store.getRecordsForUnit(unitId)) {
        expect(record.scope.some((entry) => entry.recordId === unitId)).toBe(true);
      }
    }

    // Non-vacuity: the loop above must actually iterate, or it proves nothing.
    expect(store.getRecordsForUnit("unit-A").length).toBe(1);
    expect(store.getRecordsForUnit("unit-B").length).toBe(1);
    expect(store.getRecordsForUnit("unit-C").length).toBe(0);
  });
});
