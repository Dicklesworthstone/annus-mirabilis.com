import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkEntityReviewStatus,
  checkJourneyMoveSummaryReview,
} from "../checks/review/statuses.ts";
import { parseOwners } from "../owners/parseOwners.ts";
import {
  ReviewValidationError,
  validateCrossProjectionRecord,
  validateReviewRecord,
  validateReviewScopeEntry,
} from "./review.ts";

const FIXTURE_OWNERS = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| jemanuel | Jeffrey Emanuel | editorial-owner,implementation-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
| rev-de-1 | German Reviewer | german-source-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-phys-1 | Physics Reviewer | physics-math-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-tour-1 | Tour Tester | tour-tester | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-device-1 | Device Tester | real-device-tester | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| trans-1 | Translator Person | translator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-task-1 | Transfer Reviewer | transfer-task-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-xproj-1 | Cross Proj Reviewer | cross-projection-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
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

  it("rejects unknown reviewer id (review.ts:166)", () => {
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
      (err: unknown) => err instanceof ReviewValidationError && err.code === "unknown-reviewer",
    );
  });

  it("rejects reviewer with tour-tester role attempting a physics-math review (review.ts:194)", () => {
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
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "invalid-reviewer-role",
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
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "invalid-reviewer-role",
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
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "invalid-reviewer-role",
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

describe("Review Schema Refusal Throw Sites (am-muyh)", () => {
  function getValidCrossProjectionRecord(): Record<string, unknown> {
    return {
      id: "xproj-valid-1",
      reviewType: "cross-projection",
      reviewer: "rev-xproj-1",
      date: "2026-09-16",
      result: "accepted",
      claimId: "bm-claim-01",
      paper: "brownian-motion",
      claimStatement: "The displacement law describes root-mean-square displacement.",
      resultCardId: "card-bm-01",
      contentRevision: 1,
      translationRevision: 1,
      projections: [
        { projection: "source-german", anchor: "s4-p1", verdict: "unchanged" },
        { projection: "translation-english", anchor: "s4-p1-tr", verdict: "unchanged" },
        { projection: "reading-r0", anchor: "r0-s4", verdict: "unchanged" },
        { projection: "reading-r2", anchor: "r2-s4", verdict: "unchanged" },
        { projection: "reading-r3", anchor: "r3-s4", verdict: "absent" },
        { projection: "equation", anchor: "eq-bm-04", verdict: "unchanged" },
        { projection: "instrument", anchor: "bm-01", verdict: "unchanged" },
        { projection: "results-card", anchor: "card-bm-01", verdict: "unchanged" },
        { projection: "print", anchor: "ch-bm-04", verdict: "unchanged" },
        { projection: "accessible", anchor: "tbl-bm-04", verdict: "unchanged" },
        { projection: "tour", anchor: "tour-bm-15", verdict: "absent" },
      ],
      findings: [],
      outcome: "accepted",
      scope: [{ recordId: "bm-claim-01" }],
    };
  }

  function getValidStandardReviewRecord(): Record<string, unknown> {
    return {
      id: "rev-std-valid-1",
      reviewType: "german-source",
      reviewer: "rev-de-1",
      date: "2026-09-16",
      result: "accepted",
      scope: [{ recordId: "bm-s1-p1", translationRevision: 1 }],
    };
  }

  // 1. Scope Entry validation
  it("invalid-scope-entry: rejects non-object scope entry (review.ts:212)", () => {
    assert.throws(
      () => validateReviewScopeEntry(null),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-scope-entry",
    );
    assert.throws(
      () => validateReviewScopeEntry("not-an-object"),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-scope-entry",
    );

    // Accept counterpart
    const valid = validateReviewScopeEntry({ recordId: "rec-1" });
    assert.equal(valid.recordId, "rec-1");
  });

  it("missing-scope-record-id: rejects scope entry with empty recordId (review.ts:217)", () => {
    assert.throws(
      () => validateReviewScopeEntry({ recordId: "" }),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "missing-scope-record-id",
    );
    assert.throws(
      () => validateReviewScopeEntry({ recordId: "   " }),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "missing-scope-record-id",
    );

    // Accept counterpart
    const valid = validateReviewScopeEntry({
      recordId: "rec-valid",
      contentRevision: 2,
      translationRevision: 1,
      modelVersion: 1,
      unitHash: "hash-123",
    });
    assert.equal(valid.recordId, "rec-valid");
    assert.equal(valid.contentRevision, 2);
  });

  // 2. Reviewer role checks
  it("invalid-reviewer-role: rejects reviewer lacking cross-projection-reviewer role (review.ts:181)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.reviewer = "rev-de-1"; // holds german-source-reviewer, not cross-projection-reviewer
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "invalid-reviewer-role",
    );

    // Accept counterpart
    raw.reviewer = "rev-xproj-1";
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.reviewer, "rev-xproj-1");
  });

  // 3. Cross-Projection Record Validation
  it("invalid-record: rejects non-object cross-projection record payload (review.ts:251)", () => {
    assert.throws(
      () => validateCrossProjectionRecord(null),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-record",
    );
    assert.throws(
      () => validateCrossProjectionRecord("not-an-object"),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-record",
    );

    // Accept counterpart
    const accepted = validateCrossProjectionRecord(getValidCrossProjectionRecord(), {
      ownersRegistry: registry,
    });
    assert.equal(accepted.id, "xproj-valid-1");
  });

  it("missing-id: rejects cross-projection record with empty id (review.ts:257)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.id = "";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-id",
    );

    // Accept counterpart
    raw.id = "xproj-accepted-id";
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.id, "xproj-accepted-id");
  });

  it("invalid-review-type: rejects non-cross-projection type in validateCrossProjectionRecord (review.ts:262)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.reviewType = "german-source";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-review-type",
    );

    // Accept counterpart
    raw.reviewType = "cross-projection";
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.reviewType, "cross-projection");
  });

  it("missing-reviewer: rejects cross-projection record with empty reviewer (review.ts:278)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.reviewer = "";
    raw.reviewerId = "";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-reviewer",
    );

    // Accept counterpart
    raw.reviewer = "rev-xproj-1";
    delete raw.reviewerId;
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.reviewer, "rev-xproj-1");
  });

  it("invalid-date: rejects non-ISO date in cross-projection record (review.ts:290)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.date = "2026/09/16";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-date",
    );

    // Accept counterpart
    raw.date = "2026-09-16";
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.date, "2026-09-16");
  });

  it("invalid-result: rejects invalid result in cross-projection record (review.ts:299)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.result = "partially-accepted";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-result",
    );

    // Accept counterpart
    raw.result = "accepted-with-changes";
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.result, "accepted-with-changes");
  });

  it("missing-claim-id: rejects cross-projection record with empty claimId (review.ts:308)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.claimId = "";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-claim-id",
    );

    // Accept counterpart
    raw.claimId = "claim-valid-1";
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.claimId, "claim-valid-1");
  });

  it("missing-paper: rejects cross-projection record with empty paper (review.ts:317)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.paper = "";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-paper",
    );

    // Accept counterpart
    raw.paper = "brownian-motion";
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.paper, "brownian-motion");
  });

  it("missing-claim-statement: rejects cross-projection record with empty claimStatement (review.ts:326)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.claimStatement = "   ";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "missing-claim-statement",
    );

    // Accept counterpart
    raw.claimStatement = "Valid claim statement.";
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.claimStatement, "Valid claim statement.");
  });

  it("missing-result-card-id: rejects cross-projection record with empty resultCardId (review.ts:335)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.resultCardId = "";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "missing-result-card-id",
    );

    // Accept counterpart
    raw.resultCardId = "card-bm-01";
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.resultCardId, "card-bm-01");
  });

  it("missing-content-revision: rejects cross-projection record with empty contentRevision (review.ts:344)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.contentRevision = "";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "missing-content-revision",
    );

    // Accept counterpart
    raw.contentRevision = 2;
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.contentRevision, 2);
  });

  it("missing-translation-revision: rejects cross-projection record with empty translationRevision (review.ts:353)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.translationRevision = "";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "missing-translation-revision",
    );

    // Accept counterpart
    raw.translationRevision = 3;
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.translationRevision, 3);
  });

  it("missing-projections: rejects cross-projection record with non-array projections (review.ts:362)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.projections = "not-array";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-projections",
    );

    // Accept counterpart
    raw.projections = getValidCrossProjectionRecord().projections;
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.projections.length, 11);
  });

  it("unknown-projection: rejects unknown projection in projections list (review.ts:378)", () => {
    const raw = getValidCrossProjectionRecord();
    const projections = [...(raw.projections as Array<Record<string, unknown>>)];
    projections[0] = {
      projection: "unknown-projection-layer",
      anchor: "s4-p1",
      verdict: "unchanged",
    };
    raw.projections = projections;
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "unknown-projection",
    );

    // Accept counterpart
    raw.projections = getValidCrossProjectionRecord().projections;
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.projections[0]?.projection, "source-german");
  });

  it("duplicate-projection: rejects duplicate projection in projections list (review.ts:386)", () => {
    const raw = getValidCrossProjectionRecord();
    const projections = [...(raw.projections as Array<Record<string, unknown>>)];
    projections[1] = { ...projections[0] };
    raw.projections = projections;
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "duplicate-projection",
    );

    // Accept counterpart
    raw.projections = getValidCrossProjectionRecord().projections;
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.projections.length, 11);
  });

  it("missing-anchor: rejects projection with empty anchor (review.ts:395)", () => {
    const raw = getValidCrossProjectionRecord();
    const projections = (raw.projections as Array<Record<string, unknown>>).map((p) =>
      p.projection === "source-german" ? { ...p, anchor: "   " } : p,
    );
    raw.projections = projections;
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-anchor",
    );

    // Accept counterpart
    raw.projections = getValidCrossProjectionRecord().projections;
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.projections[0]?.anchor, "s4-p1");
  });

  it("invalid-verdict: rejects projection with invalid verdict (review.ts:404)", () => {
    const raw = getValidCrossProjectionRecord();
    const projections = (raw.projections as Array<Record<string, unknown>>).map((p) =>
      p.projection === "source-german" ? { ...p, verdict: "unsupported-verdict" } : p,
    );
    raw.projections = projections;
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-verdict",
    );

    // Accept counterpart
    raw.projections = getValidCrossProjectionRecord().projections;
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.projections[0]?.verdict, "unchanged");
  });

  it("invalid-finding-projection: rejects finding with unknown projection (review.ts:452)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.outcome = "findings-open";
    raw.findings = [
      {
        projection: "bogus-projection",
        anchor: "r0-s4",
        kind: "qualification-dropped",
        description: "Dropped qualifier",
        owningBeadId: "am-bm-s4-s5-uqbb",
      },
    ];
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "invalid-finding-projection",
    );

    // Accept counterpart with matching weakened verdict
    raw.projections = (raw.projections as Array<Record<string, unknown>>).map((p) =>
      p.projection === "reading-r0" ? { ...p, verdict: "weakened" } : p,
    );
    raw.findings = [
      {
        projection: "reading-r0",
        anchor: "r0-s4",
        kind: "qualification-dropped",
        description: "Dropped qualifier",
        owningBeadId: "am-bm-s4-s5-uqbb",
      },
    ];
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.findings.length, 1);
  });

  it("missing-finding-anchor: rejects finding with empty anchor (review.ts:461)", () => {
    const raw = getValidCrossProjectionRecord();
    const findingsList: Array<Record<string, unknown>> = [
      {
        projection: "reading-r0",
        anchor: "   ",
        kind: "qualification-dropped",
        description: "Dropped qualifier",
        owningBeadId: "am-bm-s4-s5-uqbb",
      },
    ];
    raw.projections = (raw.projections as Array<Record<string, unknown>>).map((p) =>
      p.projection === "reading-r0" ? { ...p, verdict: "weakened" } : p,
    );
    raw.outcome = "findings-open";
    raw.findings = findingsList;
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "missing-finding-anchor",
    );

    // Accept counterpart
    findingsList[0] = { ...(findingsList[0] as Record<string, unknown>), anchor: "read-r0-s4" };
    raw.findings = findingsList;
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.findings[0]?.anchor, "read-r0-s4");
  });

  it("missing-finding-description: rejects finding with empty description (review.ts:479)", () => {
    const raw = getValidCrossProjectionRecord();
    const findingsList: Array<Record<string, unknown>> = [
      {
        projection: "reading-r0",
        anchor: "read-r0-s4",
        kind: "qualification-dropped",
        description: "",
        owningBeadId: "am-bm-s4-s5-uqbb",
      },
    ];
    raw.projections = (raw.projections as Array<Record<string, unknown>>).map((p) =>
      p.projection === "reading-r0" ? { ...p, verdict: "weakened" } : p,
    );
    raw.outcome = "findings-open";
    raw.findings = findingsList;
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) =>
        err instanceof ReviewValidationError && err.code === "missing-finding-description",
    );

    // Accept counterpart
    findingsList[0] = {
      ...(findingsList[0] as Record<string, unknown>),
      description: "Valid finding description.",
    };
    raw.findings = findingsList;
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.findings[0]?.description, "Valid finding description.");
  });

  it("invalid-outcome: rejects cross-projection record with invalid outcome (review.ts:520)", () => {
    const raw = getValidCrossProjectionRecord();
    raw.outcome = "tentative-outcome";
    assert.throws(
      () => validateCrossProjectionRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-outcome",
    );

    // Accept counterpart
    raw.outcome = "accepted";
    const accepted = validateCrossProjectionRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.outcome, "accepted");
  });

  // 4. Standard Review Record Validation
  it("invalid-record: rejects non-object standard review record (review.ts:571)", () => {
    assert.throws(
      () => validateReviewRecord(null),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-record",
    );
    assert.throws(
      () => validateReviewRecord("not-an-object"),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-record",
    );

    // Accept counterpart
    const accepted = validateReviewRecord(getValidStandardReviewRecord(), {
      ownersRegistry: registry,
    });
    assert.equal(accepted.id, "rev-std-valid-1");
  });

  it("invalid-review-type: rejects unknown reviewType in validateReviewRecord (review.ts:577)", () => {
    const raw = getValidStandardReviewRecord();
    raw.reviewType = "nonexistent-review-type";
    assert.throws(
      () => validateReviewRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-review-type",
    );

    // Accept counterpart
    raw.reviewType = "german-source";
    const accepted = validateReviewRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.reviewType, "german-source");
  });

  it("missing-id: rejects standard review record with empty id (review.ts:590)", () => {
    const raw = getValidStandardReviewRecord();
    raw.id = "   ";
    assert.throws(
      () => validateReviewRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-id",
    );

    // Accept counterpart
    raw.id = "rev-std-valid-1";
    const accepted = validateReviewRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.id, "rev-std-valid-1");
  });

  it("invalid-date: rejects non-ISO date in standard review record (review.ts:607)", () => {
    const raw = getValidStandardReviewRecord();
    raw.date = "2026/09/16";
    assert.throws(
      () => validateReviewRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-date",
    );

    // Accept counterpart
    raw.date = "2026-09-16";
    const accepted = validateReviewRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.date, "2026-09-16");
  });

  it("invalid-result: rejects invalid result in standard review record (review.ts:616)", () => {
    const raw = getValidStandardReviewRecord();
    raw.result = "tentative";
    assert.throws(
      () => validateReviewRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "invalid-result",
    );

    // Accept counterpart
    raw.result = "accepted";
    const accepted = validateReviewRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.result, "accepted");
  });

  it("missing-scope: rejects standard review record with empty scope (review.ts:624)", () => {
    const raw = getValidStandardReviewRecord();
    raw.scope = [];
    assert.throws(
      () => validateReviewRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-scope",
    );
    raw.scope = "not-array";
    assert.throws(
      () => validateReviewRecord(raw, { ownersRegistry: registry }),
      (err: unknown) => err instanceof ReviewValidationError && err.code === "missing-scope",
    );

    // Accept counterpart
    raw.scope = [{ recordId: "bm-s1-p1" }];
    const accepted = validateReviewRecord(raw, { ownersRegistry: registry });
    assert.equal(accepted.scope.length, 1);
  });
});
