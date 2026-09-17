import { describe, expect, test } from "bun:test";
import {
  allPaperCoverage,
  coverageReport,
  coverageReportIsHonest,
  coverageReportJson,
  coverageReportMarkdown,
} from "../../content/editions/coverageReport.ts";
import { assertEditionContract } from "../../content/editions/editionContract.ts";
import {
  inspectAllLedgers,
  inspectLedgerPresence,
  PAPERS_WAITING_ON_CLOUD_OCR,
  translationCompleteness,
} from "../../content/editions/ledgerPresence.ts";
import { ROUTE_SLUGS } from "../../content/ids.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-edn-alignment-tooling-do1";

describe("no ledger present is never complete", () => {
  test("papers 1, 3, 4, and 5 have no ledger; a fake unit count still is not complete", () => {
    expect(PAPERS_WAITING_ON_CLOUD_OCR).toEqual([
      "light-quanta",
      "special-relativity",
      "mass-energy",
      "molecular-dimensions",
    ]);
    for (const slug of PAPERS_WAITING_ON_CLOUD_OCR) {
      const record = inspectLedgerPresence(slug);
      expect(record.presence).toBe("absent");
      expect(
        translationCompleteness({
          ledger: "absent",
          translationUnitCount: 400,
          germanAlignableCount: 400,
        }),
      ).toBe("not-applicable-no-ledger");
      const contract = assertEditionContract(slug, {
        englishIds: Array.from({ length: 12 }, (_, i) => `s0-p1-s${i + 1}`),
        germanIds: Array.from({ length: 12 }, (_, i) => `s0-p1-s${i + 1}`),
      });
      expect(contract.ledger).toBe("absent");
      expect(contract.outcome).toBe("not-available");
      expect(contract.translationCompleteness).toBe("not-applicable-no-ledger");
      expect(contract.translationCompleteness).not.toBe("complete");
      expect(contract.checks.some((c) => c.code === "ledger-absent")).toBe(true);
      expect(JSON.stringify(contract)).not.toMatch(/"complete"/);
      const report = coverageReport({
        slug,
        germanUnitCount: 50,
        translationUnitCount: 50,
      });
      expect(report.translation).toBe("not-applicable-no-ledger");
      expect(report.translation).not.toBe("complete");
      expect(coverageReportMarkdown(report).toLowerCase()).toContain("no ledger present");
    }
    logger.log({
      testId: "papers-1-3-4-5-no-ledger-not-complete",
      beadId: BEAD,
      extra: { check: "ledger-presence" },
      outcome: "passed",
      message: "papers 1, 3, 4, 5 are ledger-absent; padded unit counts never become complete",
    });
  });

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
