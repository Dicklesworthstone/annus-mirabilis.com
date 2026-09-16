import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type CrossProjectionReviewRecord,
  validateCrossProjectionRecord,
} from "../../schemas/review.ts";
import { checkCrossProjectionStaleness } from "./crossProjection.ts";

function getBaseRecord(): CrossProjectionReviewRecord {
  return validateCrossProjectionRecord(
    {
      id: "xproj-bm-03",
      reviewType: "cross-projection",
      reviewer: "xproj-rev-valid",
      date: "2026-09-16",
      result: "accepted",
      claimId: "bm-claim-01",
      paper: "brownian-motion",
      claimStatement: "Statement of claim.",
      resultCardId: "card-01",
      contentRevision: 2,
      translationRevision: 3,
      projections: [
        { projection: "source-german", anchor: "s4-p1", verdict: "unchanged" },
        { projection: "translation-english", anchor: "s4-p1-tr", verdict: "unchanged" },
        { projection: "reading-r0", anchor: "read-r0-s4", verdict: "unchanged" },
        { projection: "reading-r2", anchor: "read-r2-s4", verdict: "unchanged" },
        { projection: "reading-r3", anchor: "read-r3-s4", verdict: "absent" },
        { projection: "equation", anchor: "eq-bm-04", verdict: "unchanged" },
        { projection: "instrument", anchor: "lab-bm-01", verdict: "unchanged" },
        { projection: "results-card", anchor: "card-bm-01", verdict: "unchanged" },
        { projection: "print", anchor: "print-bm-ch4", verdict: "unchanged" },
        { projection: "accessible", anchor: "table-bm-01", verdict: "unchanged" },
        { projection: "tour", anchor: "tour-bm-fifteen", verdict: "absent" },
      ],
      findings: [],
      outcome: "accepted",
    },
    { skipOwnerRoleCheck: true },
  );
}

describe("crossProjectionStale", () => {
  it("reports stale when translationRevision is behind compiled corpus with both revisions in message", () => {
    const record = getBaseRecord();
    const currentRevisions = {
      contentRevision: 2,
      translationRevision: 4, // Record has 3, corpus is at 4
    };

    const issues = checkCrossProjectionStaleness(record, currentRevisions);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.code, "cross-projection-stale");
    assert.equal(issues[0]?.message.includes("3"), true);
    assert.equal(issues[0]?.message.includes("4"), true);
    assert.equal(issues[0]?.expectedRevision, 3);
    assert.equal(issues[0]?.actualRevision, 4);
  });

  it("passes when revisions match compiled corpus", () => {
    const record = getBaseRecord();
    const currentRevisions = {
      contentRevision: 2,
      translationRevision: 3,
    };

    const issues = checkCrossProjectionStaleness(record, currentRevisions);
    assert.equal(issues.length, 0);
  });
});
