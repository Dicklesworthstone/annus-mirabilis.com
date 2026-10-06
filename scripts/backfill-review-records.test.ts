import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOwners } from "../src/content/owners/parseOwners.ts";
import {
  BackfillError,
  convertSessionReportToReviewRecord,
  type RawSessionReport,
} from "./backfill-review-records.ts";

const FIXTURE_OWNERS = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| jemanuel | Jeffrey Emanuel | editorial-owner,implementation-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
| a11y-fac-1 | Dr. Lisa Ray | accessibility-codesign-facilitator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| comp-fac-1 | Dr. Mark Taylor | comprehension-facilitator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
`;

const registry = parseOwners(FIXTURE_OWNERS);

describe("backfill-review-records", () => {
  it("converts a well-formed session report into a review record citing sessionRef", () => {
    const report: RawSessionReport = {
      filePath: "docs/accessibility/rounds/20260916-brownian.md",
      paper: "brownian-motion",
      reviewType: "accessibility-codesign",
      facilitatorId: "a11y-fac-1",
      date: "2026-09-16",
      participantCodes: [
        { code: "brownian-motion-nonvisual-20260916-01", line: 12 },
        { code: "brownian-motion-no-algebra-20260916-02", line: 13 },
      ],
      scope: [{ recordId: "brownian-motion", contentRevision: 1 }],
      notes: "Completed co-design round with 2 participants.",
    };

    const record = convertSessionReportToReviewRecord(report, registry);
    assert.equal(record.reviewType, "accessibility-codesign");
    assert.equal(record.reviewer, "a11y-fac-1");
    assert.equal(record.sessionRef, "docs/accessibility/rounds/20260916-brownian.md");
    assert.equal(record.result, "accepted");
    assert.equal(record.scope[0]?.recordId, "brownian-motion");
  });

  it("refuses report when participant code has invalid date format (e.g. 2027-04-12-3) with file and line", () => {
    const report: RawSessionReport = {
      filePath: "docs/accessibility/rounds/bad-code.md",
      paper: "brownian-motion",
      reviewType: "accessibility-codesign",
      facilitatorId: "a11y-fac-1",
      date: "2026-09-16",
      participantCodes: [{ code: "brownian-motion-nonvisual-2027-04-12-3", line: 24 }],
      scope: [{ recordId: "brownian-motion" }],
    };

    assert.throws(
      () => convertSessionReportToReviewRecord(report, registry),
      (err: unknown) => {
        return (
          err instanceof BackfillError &&
          err.code === "invalid-participant-code" &&
          err.file === "docs/accessibility/rounds/bad-code.md" &&
          err.line === 24
        );
      },
    );
  });

  it("refuses report when facilitator id is absent from owners table", () => {
    const report: RawSessionReport = {
      filePath: "docs/accessibility/rounds/unknown-fac.md",
      paper: "brownian-motion",
      reviewType: "accessibility-codesign",
      facilitatorId: "unknown-facilitator-id",
      date: "2026-09-16",
      participantCodes: [{ code: "brownian-motion-nonvisual-20260916-01", line: 10 }],
      scope: [{ recordId: "brownian-motion" }],
    };

    assert.throws(
      () => convertSessionReportToReviewRecord(report, registry),
      (err: unknown) => {
        return (
          err instanceof BackfillError &&
          err.code === "unknown-facilitator" &&
          err.file === "docs/accessibility/rounds/unknown-fac.md"
        );
      },
    );
  });

  /**
   * `invalid-facilitator-role` (backfill-review-records.ts:72) is the gate between a session report
   * and a review record that claims it (am-r3qt). Under AGENTS.md a human-gate round is accepted
   * only on a qualified facilitator's name, and this is the check that the name in the report is
   * that person - not merely someone in docs/OWNERS.md.
   *
   * Both arms are driven, because the expected role is chosen by reviewType and a converter that
   * looked up the wrong one would still refuse SOMETHING: a comprehension facilitator must not be
   * accepted for an accessibility co-design round, and the fixture registry holds one of each so
   * the two can be told apart.
   */
  const base = {
    filePath: "docs/accessibility/rounds/20260916-brownian.md",
    paper: "brownian-motion",
    date: "2026-09-16",
    participantCodes: [{ code: "brownian-motion-nonvisual-20260916-01", line: 12 }],
    scope: [{ recordId: "brownian-motion", contentRevision: 1 }],
    notes: "Completed round with 1 participant.",
  } as const;

  for (const [reviewType, facilitatorId, expectedRole] of [
    ["accessibility-codesign", "comp-fac-1", "accessibility-codesign-facilitator"],
    ["comprehension", "a11y-fac-1", "comprehension-facilitator"],
  ] as const)
    it(`a ${reviewType} round is refused when its facilitator holds the other role`, () => {
      assert.throws(
        () =>
          convertSessionReportToReviewRecord(
            { ...base, reviewType, facilitatorId } as RawSessionReport,
            registry,
          ),
        (error: unknown) => {
          assert.ok(error instanceof BackfillError);
          assert.equal(error.code, "invalid-facilitator-role");
          assert.match(error.message, new RegExp(`lacks required role "${expectedRole}"`));
          assert.match(error.message, new RegExp(facilitatorId));
          return true;
        },
      );
    });

  it("each facilitator is accepted for the round their role names", () => {
    // The negative: a converter that refused every facilitator would pass both cases above, and
    // the refusal would then be about the check rather than about the role.
    for (const [reviewType, facilitatorId] of [
      ["accessibility-codesign", "a11y-fac-1"],
      ["comprehension", "comp-fac-1"],
    ] as const)
      assert.doesNotThrow(() =>
        convertSessionReportToReviewRecord(
          { ...base, reviewType, facilitatorId } as RawSessionReport,
          registry,
        ),
      );
  });
});
