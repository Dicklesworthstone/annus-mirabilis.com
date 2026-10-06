/**
 * Refusal throw site test suite for crossProjection.ts (am-muyh).
 *
 * Covers lines 56 and 137 in src/content/checks/review/crossProjection.ts
 * with authentic accept/reject test pairs, asserting explicit refusal codes
 * and messages, with exact line citations.
 *
 * Zero mocks are used.
 */
import { describe, expect, test } from "bun:test";
import { parseOwners } from "../../owners/parseOwners.ts";
import type { CrossProjectionReviewRecord } from "../../schemas/review.ts";
import { checkCrossProjectionReviewer, checkCrossProjectionStaleness } from "./crossProjection.ts";

const FIXTURE_OWNERS = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| xproj-rev-valid | Independent Reviewer | cross-projection-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
`;

const registry = parseOwners(FIXTURE_OWNERS);

function createBaseRecord(reviewerId: string): CrossProjectionReviewRecord {
  return {
    id: "xproj-bm-02",
    reviewType: "cross-projection",
    reviewer: reviewerId,
    date: "2026-09-16",
    result: "accepted",
    claimId: "bm-claim-01",
    paper: "brownian-motion",
    claimStatement: "Statement of claim.",
    resultCardId: "card-01",
    contentRevision: 1,
    translationRevision: 1,
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
    scope: [],
  };
}

describe("crossProjection.ts refusal throw sites (am-muyh)", () => {
  // --------------------------------------------------------------------------
  // Site 1: line 56 - cross-projection-unknown-reviewer
  // --------------------------------------------------------------------------
  test("rejects unknown reviewer not in OWNERS.md (crossProjection.ts:56)", () => {
    const unknownRecord = createBaseRecord("unknown-reviewer-nobody");
    const issues = checkCrossProjectionReviewer(unknownRecord, [], registry);

    expect(issues.length).toBe(1);
    expect(issues[0]?.code).toBe("cross-projection-unknown-reviewer");
    expect(issues[0]?.message).toBe(
      'Reviewer "unknown-reviewer-nobody" is not found in docs/OWNERS.md.',
    );
    expect(issues[0]?.reviewerId).toBe("unknown-reviewer-nobody");
    expect(issues[0]?.claimId).toBe("bm-claim-01");

    // Accept: known reviewer with cross-projection-reviewer role
    const validRecord = createBaseRecord("xproj-rev-valid");
    const validIssues = checkCrossProjectionReviewer(validRecord, [], registry);
    expect(validIssues.some((i) => i.code === "cross-projection-unknown-reviewer")).toBe(false);
    expect(validIssues.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Site 1: line 127 - cross-projection-stale (contentRevision mismatch)
  //
  // The SIBLING of site 2 below, and nothing drove it (am-r3qt). `cross-projection-stale` is raised
  // twice, once for each revision, and a code with several sites is credited only by a citation - so
  // the contentRevision arm sat on the untested list while its twin was covered. The two are not
  // interchangeable: a record can go stale on the content while its translation is current, which is
  // the ordinary case when a source block is revised and the English has not been retouched.
  // --------------------------------------------------------------------------
  test("rejects when contentRevision does not match current compiled revision (crossProjection.ts:127)", () => {
    const record = createBaseRecord("xproj-rev-valid");

    // Reject: contentRevision mismatch (1 vs 2), translationRevision matches (1 vs 1), so exactly one
    // issue is raised and it is this site's, not its twin's.
    const staleIssues = checkCrossProjectionStaleness(record, {
      contentRevision: 2,
      translationRevision: 1,
    });
    expect(staleIssues.length).toBe(1);
    expect(staleIssues[0]?.code).toBe("cross-projection-stale");
    expect(staleIssues[0]?.message).toBe(
      "Cross-projection review contentRevision 1 does not match current compiled revision 2.",
    );
    expect(staleIssues[0]?.claimId).toBe("bm-claim-01");
    expect(staleIssues[0]?.expectedRevision).toBe(1);
    expect(staleIssues[0]?.actualRevision).toBe(2);

    // Accept: both current, so neither arm fires. Without this the assertion above would hold on an
    // implementation that reported staleness unconditionally.
    expect(
      checkCrossProjectionStaleness(record, { contentRevision: 1, translationRevision: 1 }).length,
    ).toBe(0);

    // And BOTH stale raises both, which is the only check that the two arms are independent rather
    // than one guard reported twice.
    expect(
      checkCrossProjectionStaleness(record, { contentRevision: 2, translationRevision: 2 }).length,
    ).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Site 2: line 137 - cross-projection-stale (translationRevision mismatch)
  // --------------------------------------------------------------------------
  test("rejects when translationRevision does not match current compiled revision (crossProjection.ts:137)", () => {
    const record = createBaseRecord("xproj-rev-valid");

    // Reject: translationRevision mismatch (1 vs 2), contentRevision matches (1 vs 1)
    const staleIssues = checkCrossProjectionStaleness(record, {
      contentRevision: 1,
      translationRevision: 2,
    });
    expect(staleIssues.length).toBe(1);
    expect(staleIssues[0]?.code).toBe("cross-projection-stale");
    expect(staleIssues[0]?.message).toBe(
      "Cross-projection review translationRevision 1 does not match current compiled revision 2.",
    );
    expect(staleIssues[0]?.claimId).toBe("bm-claim-01");
    expect(staleIssues[0]?.expectedRevision).toBe(1);
    expect(staleIssues[0]?.actualRevision).toBe(2);

    // Accept: both revisions match
    const freshIssues = checkCrossProjectionStaleness(record, {
      contentRevision: 1,
      translationRevision: 1,
    });
    expect(freshIssues.length).toBe(0);
  });
});
