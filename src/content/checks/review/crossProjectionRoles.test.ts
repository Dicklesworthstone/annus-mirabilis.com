import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOwners } from "../../owners/parseOwners.ts";
import {
  type CrossProjectionReviewRecord,
  validateCrossProjectionRecord,
} from "../../schemas/review.ts";
import {
  checkCrossProjectionReviewer,
  type ProjectionAuthorshipContext,
} from "./crossProjection.ts";

const FIXTURE_OWNERS = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| jemanuel | Jeffrey Emanuel | editorial-owner,implementation-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
| xproj-rev-valid | Independent Reviewer | cross-projection-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| phys-only-rev | Physics Only | physics-math-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| r2-editor-person | R2 Editor | cross-projection-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
`;

const registry = parseOwners(FIXTURE_OWNERS);

function getBaseRecord(reviewerId: string): CrossProjectionReviewRecord {
  return validateCrossProjectionRecord(
    {
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
    },
    { ownersRegistry: registry, skipOwnerRoleCheck: true },
  );
}

describe("crossProjectionRoles", () => {
  it("rejects reviewer id without cross-projection-reviewer role", () => {
    const record = getBaseRecord("phys-only-rev");
    const issues = checkCrossProjectionReviewer(record, [], registry);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.code, "cross-projection-invalid-role");
  });

  it("rejects reviewer who appears in editedBy authorship of paper's R2 reading", () => {
    const record = getBaseRecord("r2-editor-person");
    const contexts: ProjectionAuthorshipContext[] = [
      {
        projection: "reading-r2",
        anchor: "read-r2-s4",
        authorship: {
          draftedBy: [{ id: "author-1", kind: "human" }],
          editedBy: [{ id: "r2-editor-person", kind: "human" }],
        },
      },
    ];

    const issues = checkCrossProjectionReviewer(record, contexts, registry);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.code, "cross-projection-self-review");
    assert.equal(issues[0]?.projection, "reading-r2");
  });

  it("accepts an unrelated reviewer holding cross-projection-reviewer role", () => {
    const record = getBaseRecord("xproj-rev-valid");
    const contexts: ProjectionAuthorshipContext[] = [
      {
        projection: "reading-r2",
        anchor: "read-r2-s4",
        authorship: {
          draftedBy: [{ id: "author-1", kind: "human" }],
          editedBy: [{ id: "editor-other", kind: "human" }],
        },
      },
    ];

    const issues = checkCrossProjectionReviewer(record, contexts, registry);
    assert.equal(issues.length, 0);
  });
});
