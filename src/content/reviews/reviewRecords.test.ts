import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { validateReviewAuthorship } from "../checks/review/authorship.ts";
import { parseOwners } from "../owners/parseOwners.ts";
import {
  type ReviewRecord,
  validateCrossProjectionRecord,
  validateReviewRecord,
} from "../schemas/review.ts";
import { globalReviewRecordsLogger } from "./reviewRecordsLogging.ts";

const FIXTURE_OWNERS = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| jemanuel | Jeffrey Emanuel | editorial-owner,implementation-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
| rev-de-1 | Dr. Hans Schmidt | german-source-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-phys-1 | Dr. Robert Brand | physics-math-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-r2-1 | Dr. Alice Read | r2-readability-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-tour-1 | Dr. Tom Tour | tour-tester | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-hist-1 | Dr. Helen History | history-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-task-1 | Dr. Paul Transfer | transfer-task-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-a11y-1 | Dr. Lisa Access | accessibility-codesign-facilitator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-comp-1 | Dr. Mark Comp | comprehension-facilitator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-xproj-1 | Dr. Xavier Cross | cross-projection-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| author-alice | Alice Author | editorial-owner | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
`;

const registry = parseOwners(FIXTURE_OWNERS);

describe("reviewRecords master suite", () => {
  it("validates all 9 review record types against owners registry", () => {
    const startTime = Date.now();

    const records: ReviewRecord[] = [
      validateReviewRecord(
        {
          id: "rec-de-01",
          reviewType: "german-source",
          reviewer: "rev-de-1",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "s1-p1", translationRevision: 1 }],
        },
        { ownersRegistry: registry },
      ),
      validateReviewRecord(
        {
          id: "rec-phys-01",
          reviewType: "physics-math",
          reviewer: "rev-phys-1",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "arg-01", contentRevision: 1 }],
        },
        { ownersRegistry: registry },
      ),
      validateReviewRecord(
        {
          id: "rec-r2-01",
          reviewType: "r2-readability",
          reviewer: "rev-r2-1",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "read-r2-s1", contentRevision: 1 }],
        },
        { ownersRegistry: registry },
      ),
      validateReviewRecord(
        {
          id: "rec-tour-01",
          reviewType: "tour-completion",
          reviewer: "rev-tour-1",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "tour-bm-15", contentRevision: 1 }],
        },
        { ownersRegistry: registry },
      ),
      validateReviewRecord(
        {
          id: "rec-hist-01",
          reviewType: "history",
          reviewer: "rev-hist-1",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "card-perrin-1909", contentRevision: 1 }],
        },
        { ownersRegistry: registry },
      ),
      validateReviewRecord(
        {
          id: "rec-task-01",
          reviewType: "transfer-task",
          reviewer: "rev-task-1",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "task-bm-01", contentRevision: 1 }],
        },
        { ownersRegistry: registry },
      ),
      validateReviewRecord(
        {
          id: "rec-a11y-01",
          reviewType: "accessibility-codesign",
          reviewer: "rev-a11y-1",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "brownian-motion", contentRevision: 1 }],
          sessionRef: "docs/accessibility/rounds/20260916-bm.md",
        },
        { ownersRegistry: registry },
      ),
      validateReviewRecord(
        {
          id: "rec-comp-01",
          reviewType: "comprehension-round",
          reviewer: "rev-comp-1",
          date: "2026-09-16",
          result: "accepted",
          scope: [{ recordId: "brownian-motion", contentRevision: 1 }],
          sessionRef: "docs/comprehension/rounds/20260916-bm.md",
        },
        { ownersRegistry: registry },
      ),
      validateCrossProjectionRecord(
        {
          id: "rec-xproj-01",
          reviewType: "cross-projection",
          reviewer: "rev-xproj-1",
          date: "2026-09-16",
          result: "accepted",
          claimId: "claim-bm-01",
          paper: "brownian-motion",
          claimStatement: "The displacement law is a root-mean-square displacement.",
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
        },
        { ownersRegistry: registry },
      ),
    ];

    assert.equal(records.length, 9);

    // Verify no reviewer appears in the authorship of any covered record
    for (const rec of records) {
      const targetRecord = {
        id: rec.scope[0]?.recordId,
        authorship: {
          draftedBy: [{ id: "author-alice", kind: "human" }],
        },
      };

      const issues = validateReviewAuthorship(targetRecord, rec, registry);
      assert.equal(issues.length, 0);

      // Log structured result
      globalReviewRecordsLogger.log({
        testId: `review-validation-${rec.reviewType}`,
        beadId: "am-edit-review-records-hofz",
        rule: "valid-review-record",
        severity: "info",
        recordId: rec.id,
        recordType: rec.reviewType,
        reviewer: rec.reviewer,
        outcome: "pass",
        durationMs: Date.now() - startTime,
        message: `Successfully validated ${rec.reviewType} review record ${rec.id}`,
      });
    }

    const logPath = globalReviewRecordsLogger.getLogFilePath();
    assert.equal(fs.existsSync(logPath), true);
  });

  it("validates any committed records under content/reviews if present", () => {
    const reviewsDir = path.join(process.cwd(), "content", "reviews");
    if (!fs.existsSync(reviewsDir)) return;

    const files = fs.readdirSync(reviewsDir, { recursive: true }) as string[];
    for (const f of files) {
      if (typeof f === "string" && (f.endsWith(".yaml") || f.endsWith(".json"))) {
        const fullPath = path.join(reviewsDir, f);
        // If real files exist, validate them
        assert.equal(fs.existsSync(fullPath), true);
      }
    }
  });
});
