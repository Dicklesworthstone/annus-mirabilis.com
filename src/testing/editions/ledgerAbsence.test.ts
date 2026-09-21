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
  // THE PAWL. Shortening PAPERS_WAITING_ON_CLOUD_OCR is how this ratchet would be
  // released quietly: drop a paper, and every assertion above simply stops running for
  // it. So membership is checked against the disk in both directions.
  test("a paper may leave the ledgerless list ONLY when a ledger really exists", () => {
    for (const slug of ROUTE_SLUGS) {
      const present = inspectLedgerPresence(slug).presence === "present";
      const listed = (PAPERS_WAITING_ON_CLOUD_OCR as readonly string[]).includes(slug);
      expect(
        listed,
        present
          ? `${slug} has a ledger on disk and must NOT be listed as ledgerless`
          : `${slug} has NO ledger on disk and must be listed as ledgerless, or its absence stops being checked`,
      ).toBe(!present);
    }
  });

  test("mass-energy has a ledger, and its contract judges instead of declining ledger-absent", () => {
    // The concrete gain of 2026-09-20, pinned so it cannot silently regress to a decline.
    expect(inspectLedgerPresence("mass-energy").presence).toBe("present");
    const contract = assertEditionContract("mass-energy", {});
    expect(contract.ledger).toBe("present");
    expect(contract.checks.some((c) => c.code === "ledger-absent")).toBe(false);
    // Checks 2 and 4 read the ledger and now reach a real verdict on real material.
    expect(contract.checks.find((c) => c.checkNumber === 2)?.outcome).toBe("passed");
    expect(contract.checks.find((c) => c.checkNumber === 4)?.outcome).toBe("passed");
    // And it is still NOT a reviewed ledger: no check that needs a human has passed.
    expect(contract.checks.find((c) => c.checkNumber === 14)?.outcome).toBe("not-available");
  });

  test("every ledgerless paper has no ledger; a fake unit count still is not complete", () => {
    // Three membership changes so far, in both directions, none of them a relaxation.
    // mass-energy LEFT on 2026-09-20 on gaining a ledger; brownian-motion JOINED the same day
    // because it had none and was not listed, so nothing below had ever run for it; and
    // brownian-motion LEFT on 2026-09-21 on gaining ap-17-549-reviewed.txt. The pawl above found
    // the second and the third by checking membership against the disk in both directions.
    //
    // THE LITERAL LIST THAT USED TO SIT HERE IS GONE, and its absence is the point. It restated
    // PAPERS_WAITING_ON_CLOUD_OCR a second time, so every membership change broke this test for a
    // reason that was not a defect, and the count was in the test's NAME as well - a third place
    // to edit. The pawl above already derives the whole list from the disk: it asserts, for every
    // paper, that listed === !present. Pinning the literal beside it added no guarantee and two
    // more places to be wrong.
    expect(PAPERS_WAITING_ON_CLOUD_OCR.length).toBeGreaterThan(0);
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
