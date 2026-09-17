import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkEntityReviewStatus,
  checkJourneyMoveSummaryReview,
} from "../checks/review/statuses.ts";
import { parseOwners } from "../owners/parseOwners.ts";
import { ReviewValidationError, validateReviewRecord } from "./review.ts";

const FIXTURE_OWNERS = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| jemanuel | Jeffrey Emanuel | editorial-owner,implementation-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
| rev-de-1 | German Reviewer | german-source-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-phys-1 | Physics Reviewer | physics-math-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-tour-1 | Tour Tester | tour-tester | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-device-1 | Device Tester | real-device-tester | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| trans-1 | Translator Person | translator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-task-1 | Transfer Reviewer | transfer-task-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| open-german-source-brownian-motion | | german-source-reviewer | brownian-motion | open: recruiting | not-applicable | jemanuel | 2026-09-16 |
`;

const registry = parseOwners(FIXTURE_OWNERS);

describe("Review Schema and Status Checks", () => {
  it("passes accepted German source review covering translationRevision: 3 and detects staleness at revision 4", () => {
    const rawRecord = {
      id: "rev-bm-01",
      reviewType: "german-source",
      reviewer: "rev-de-1",
      date: "2026-09-16",
      result: "accepted",
      scope: [
        {
          recordId: "bm-s1-p1",
          translationRevision: 3,
          unitHash: "hash-rev-3",
        },
      ],
    };

    const validated = validateReviewRecord(rawRecord, { ownersRegistry: registry });
    assert.equal(validated.id, "rev-bm-01");

    // Entity at revision 3 -> status check passes
    const entityRev3 = {
      id: "bm-s1-p1",
      type: "translation-unit",
      translationRevision: 3,
      reviewState: "reviewed",
      unitHash: "hash-rev-3",
    };
    const issuesRev3 = checkEntityReviewStatus(entityRev3, [validated], registry, "german-source");
    assert.equal(issuesRev3.length, 0);

    // Entity advances to revision 4 -> status check fails as stale
    const entityRev4 = {
      id: "bm-s1-p1",
      type: "translation-unit",
      translationRevision: 4,
      reviewState: "reviewed",
      unitHash: "hash-rev-4",
    };
    const issuesRev4 = checkEntityReviewStatus(entityRev4, [validated], registry, "german-source");
    assert.equal(issuesRev4.length, 1);
    assert.equal(issuesRev4[0]?.code, "review-record-stale");
  });

  it("passes accepted-with-changes covering revision 5 only when unit is at revision 5", () => {
    const recordWithChanges = validateReviewRecord(
      {
        id: "rev-bm-02",
        reviewType: "german-source",
        reviewer: "rev-de-1",
        date: "2026-09-16",
        result: "accepted-with-changes",
        scope: [{ recordId: "bm-s1-p2", translationRevision: 4 }],
        acceptedRevisions: {
          "bm-s1-p2": 5,
        },
      },
      { ownersRegistry: registry },
    );

    // At revision 4 (pre-changes) -> fails stale
    const entityRev4 = {
      id: "bm-s1-p2",
      type: "translation-unit",
      translationRevision: 4,
      reviewState: "reviewed",
    };
    const issues4 = checkEntityReviewStatus(
      entityRev4,
      [recordWithChanges],
      registry,
      "german-source",
    );
    assert.equal(issues4.length, 1);
    assert.equal(issues4[0]?.code, "review-record-stale");

    // At revision 5 (post-changes accepted revision) -> passes
    const entityRev5 = {
      id: "bm-s1-p2",
      type: "translation-unit",
      translationRevision: 5,
      reviewState: "reviewed",
    };
    const issues5 = checkEntityReviewStatus(
      entityRev5,
      [recordWithChanges],
      registry,
      "german-source",
    );
    assert.equal(issues5.length, 0);
  });

  it("fails as stale when unitHash does not match", () => {
    const record = validateReviewRecord(
      {
        id: "rev-bm-03",
        reviewType: "german-source",
        reviewer: "rev-de-1",
        date: "2026-09-16",
        result: "accepted",
        scope: [{ recordId: "bm-s1-p3", translationRevision: 1, unitHash: "hash-aaa" }],
      },
      { ownersRegistry: registry },
    );

    const entity = {
      id: "bm-s1-p3",
      type: "translation-unit",
      translationRevision: 1,
      unitHash: "hash-bbb-modified",
      reviewState: "reviewed",
    };
    const issues = checkEntityReviewStatus(entity, [record], registry, "german-source");
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.code, "review-record-stale");
  });

  it("rejects model: reviewer id", () => {
    assert.throws(
      () =>
        validateReviewRecord({
          id: "rev-model-1",
          reviewType: "german-source",
          reviewer: "model:gpt",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "bm-s1-p1" }],
        }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "model-reviewer",
    );
  });

  it("planted negative: a record that claims review without a reviewer is refused", () => {
    assert.throws(
      () =>
        validateReviewRecord({
          id: "rev-no-reviewer",
          reviewType: "german-source",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "bm-s1-p1" }],
        }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-reviewer",
    );
    assert.throws(
      () =>
        validateReviewRecord({
          id: "rev-empty-reviewer",
          reviewType: "german-source",
          reviewer: "   ",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "bm-s1-p1" }],
        }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-reviewer",
    );
  });

  it("planted negative: an unfilled recruiting slot cannot sign a review", () => {
    assert.throws(
      () =>
        validateReviewRecord(
          {
            id: "rev-open-slot",
            reviewType: "german-source",
            reviewer: "open-german-source-brownian-motion",
            date: "2026-09-16",
            result: "accepted",
            scope: [{ recordId: "bm-s1-p1" }],
          },
          { ownersRegistry: registry },
        ),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "reviewer-not-assigned",
    );
  });

  it("planted negative: an agent id cannot sign a review", () => {
    assert.throws(
      () =>
        validateReviewRecord({
          id: "rev-agent-1",
          reviewType: "physics-math",
          reviewer: "agent:IcyCardinal",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "arg-01" }],
        }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "model-reviewer",
    );
  });

  it("rejects unknown reviewer id", () => {
    assert.throws(
      () =>
        validateReviewRecord(
          {
            id: "rev-unknown-1",
            reviewType: "german-source",
            reviewer: "not-in-owners-table",
            date: "2026-09-16",
            result: "accepted",
            scope: [{ recordId: "bm-s1-p1" }],
          },
          { ownersRegistry: registry },
        ),
      ReviewValidationError,
    );
  });

  it("rejects reviewer with tour-tester role attempting a physics-math review", () => {
    assert.throws(
      () =>
        validateReviewRecord(
          {
            id: "rev-wrong-role-1",
            reviewType: "physics-math",
            reviewer: "rev-tour-1", // only tour-tester
            date: "2026-09-16",
            result: "accepted",
            scope: [{ recordId: "arg-01" }],
          },
          { ownersRegistry: registry },
        ),
      ReviewValidationError,
    );
  });

  it("rejects reviewer with only real-device-tester or translator role attempting any review", () => {
    assert.throws(
      () =>
        validateReviewRecord(
          {
            id: "rev-device-err",
            reviewType: "german-source",
            reviewer: "rev-device-1",
            date: "2026-09-16",
            result: "accepted",
            scope: [{ recordId: "bm-s1-p1" }],
          },
          { ownersRegistry: registry },
        ),
      ReviewValidationError,
    );

    assert.throws(
      () =>
        validateReviewRecord(
          {
            id: "rev-trans-err",
            reviewType: "german-source",
            reviewer: "trans-1",
            date: "2026-09-16",
            result: "accepted",
            scope: [{ recordId: "bm-s1-p1" }],
          },
          { ownersRegistry: registry },
        ),
      ReviewValidationError,
    );
  });

  it("passes transfer-task review signed by transfer-task-reviewer", () => {
    const record = validateReviewRecord(
      {
        id: "rev-task-01",
        reviewType: "transfer-task",
        reviewer: "rev-task-1",
        date: "2026-09-16",
        result: "accepted",
        scope: [{ recordId: "task-01", contentRevision: 1 }],
      },
      { ownersRegistry: registry },
    );
    assert.equal(record.reviewType, "transfer-task");
    assert.equal(record.reviewer, "rev-task-1");
  });

  it("checks discovery journey move.r0Summary reviewState and staleness", () => {
    const journey = {
      id: "journey-bm-01",
      type: "journey",
      revision: 1,
      move: {
        r0Summary: {
          reviewState: "reviewed",
        },
      },
    };

    // 1. Without record -> fails missing
    const issuesNoRec = checkJourneyMoveSummaryReview(journey, [], registry);
    assert.equal(issuesNoRec.length, 1);
    assert.equal(issuesNoRec[0]?.code, "review-record-missing");

    // 2. With valid physics-math record -> passes
    const physRecord = validateReviewRecord(
      {
        id: "rev-journey-phys-1",
        reviewType: "physics-math",
        reviewer: "rev-phys-1",
        date: "2026-09-16",
        result: "accepted",
        scope: [{ recordId: "journey-bm-01", contentRevision: 1 }],
      },
      { ownersRegistry: registry },
    );

    const issuesWithRec = checkJourneyMoveSummaryReview(journey, [physRecord], registry);
    assert.equal(issuesWithRec.length, 0);

    // 3. Journey revision bumped -> fails stale
    const journeyRev2 = {
      ...journey,
      revision: 2,
    };
    const issuesStale = checkJourneyMoveSummaryReview(journeyRev2, [physRecord], registry);
    assert.equal(issuesStale.length, 1);
    assert.equal(issuesStale[0]?.code, "review-record-stale");
  });
});
