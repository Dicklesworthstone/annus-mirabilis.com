import { describe, expect, test } from "bun:test";
import {
  allPaperCoverage,
  coverageReportIsHonest,
  coverageReportJson,
  coverageReportMarkdown,
} from "../../content/editions/coverageReport.ts";
import { assertEditionContract } from "../../content/editions/editionContract.ts";
import {
  inspectAllLedgers,
  translationCompleteness,
} from "../../content/editions/ledgerPresence.ts";
import { ROUTE_SLUGS } from "../../content/ids.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-edn-alignment-tooling-do1";

describe("no ledger present is never complete", () => {
  test("every paper without a ledger file is typed absent, not complete", () => {
    const records = inspectAllLedgers();
    expect(records).toHaveLength(5);
    for (const record of records) {
      expect(ROUTE_SLUGS).toContain(record.slug);
      if (record.presence === "absent") {
        const completeness = translationCompleteness({
          ledger: "absent",
          translationUnitCount: 0,
          germanAlignableCount: 0,
        });
        expect(completeness).toBe("not-applicable-no-ledger");
        expect(completeness).not.toBe("complete");
        const contract = assertEditionContract(record.slug);
        expect(contract.ledger).toBe("absent");
        expect(contract.outcome).toBe("not-available");
        expect(contract.translationCompleteness).not.toBe("complete");
        expect(contract.checks.some((c) => c.code === "ledger-absent")).toBe(true);
        expect(JSON.stringify(contract)).not.toMatch(/"complete"/);
      }
    }
    logger.log({
      testId: "ledger-absent-not-complete",
      beadId: BEAD,
      extra: { check: "ledger-presence" },
      outcome: "passed",
      message: "absent ledgers report not-available; never complete",
    });
  });

  test("coverage reports have no percent sign and no score keys", () => {
    for (const report of allPaperCoverage()) {
      const md = coverageReportMarkdown(report);
      const json = coverageReportJson(report);
      expect(md.includes("%")).toBe(false);
      expect(coverageReportIsHonest(md, json)).toBe(true);
      if (report.ledger === "absent") {
        expect(report.translation).toBe("not-applicable-no-ledger");
        expect(report.translation).not.toBe("complete");
        expect(md.toLowerCase()).toContain("no ledger present");
      }
    }
  });
});
