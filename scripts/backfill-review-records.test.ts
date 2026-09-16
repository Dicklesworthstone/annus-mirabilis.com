import { describe, expect, it } from "bun:test";
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
    expect(record.reviewType).toBe("accessibility-codesign");
    expect(record.reviewer).toBe("a11y-fac-1");
    expect(record.sessionRef).toBe("docs/accessibility/rounds/20260916-brownian.md");
    expect(record.result).toBe("accepted");
    expect(record.scope[0]?.recordId).toBe("brownian-motion");
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

    expect(() => convertSessionReportToReviewRecord(report, registry)).toThrow(BackfillError);
    try {
      convertSessionReportToReviewRecord(report, registry);
    } catch (err: unknown) {
      expect((err as BackfillError).code).toBe("invalid-participant-code");
      expect((err as BackfillError).file).toBe("docs/accessibility/rounds/bad-code.md");
      expect((err as BackfillError).line).toBe(24);
    }
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

    expect(() => convertSessionReportToReviewRecord(report, registry)).toThrow(BackfillError);
    try {
      convertSessionReportToReviewRecord(report, registry);
    } catch (err: unknown) {
      expect((err as BackfillError).code).toBe("unknown-facilitator");
      expect((err as BackfillError).file).toBe("docs/accessibility/rounds/unknown-fac.md");
    }
  });
});
