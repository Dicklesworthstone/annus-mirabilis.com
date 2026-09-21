import { describe, expect, test } from "bun:test";
import { join } from "node:path";
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
import { validateLedger } from "../../content/ledger/validateLedger.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-edn-alignment-tooling-do1";

describe("no ledger present is never complete", () => {
  // THE PAWL. Shortening PAPERS_WAITING_ON_CLOUD_OCR is how this ratchet would be
  // released quietly: drop a paper, and every assertion above simply stops running for
  // it. So membership is checked against the disk in both directions.
  test("a paper may leave the ledgerless list ONLY when its ledger COVERS it", () => {
    // The subject of this guard changed on 2026-09-21 from "has a ledger file" to "has a
    // ledger that covers the paper", and this is the line where that matters. Under the
    // old reading ap-17-132 left the list on the strength of a 17-page skeleton with one
    // page transcribed, and the assertions below stopped running for the paper being
    // actively worked on - the guard switching itself off exactly when a paper starts
    // having content, and reporting green about the papers furthest along.
    for (const slug of ROUTE_SLUGS) {
      const covered = inspectLedgerPresence(slug).presence === "complete";
      const listed = (PAPERS_WAITING_ON_CLOUD_OCR as readonly string[]).includes(slug);
      expect(
        listed,
        covered
          ? `${slug} has a ledger covering every page and must NOT be listed as ledgerless`
          : `${slug} has no ledger, or one that does not yet cover every page, and must stay listed - otherwise its incompleteness stops being checked`,
      ).toBe(!covered);
    }
  });

  test("the coverage classifier agrees with the validator it copies", () => {
    // ledgerPresence mirrors validateLedger's skeleton-page rule instead of importing it,
    // because that module parses receipts and is far too heavy for a helper called in loops.
    // Two implementations of one definition drift; this is the pawl that stops them. If it
    // ever fails, the classifier is wrong and the validator is right - it owns the rule.
    let checked = 0;
    for (const slug of ROUTE_SLUGS) {
      const record = inspectLedgerPresence(slug);
      if (record.presence === "absent") continue;
      checked += 1;
      const result = validateLedger(join(process.cwd(), record.path), { paper: slug });
      const validatorSaysComplete = result.stats.skeletonPages === 0;
      expect(
        record.presence === "complete",
        `${slug}: classifier says ${record.presence}, validator reports ${result.stats.skeletonPages} skeleton page(s) of ${result.stats.pages}`,
      ).toBe(validatorSaysComplete);
    }
    // Vacuity guard: with no ledger on disk this test asserts nothing at all.
    expect(
      checked,
      "no ledger was available to cross-check the classifier against",
    ).toBeGreaterThan(0);
  });

  test("a PARTIAL ledger keeps a paper listed, and never licenses a completeness verdict", () => {
    // The defect this whole change exists for, asserted on whichever paper is mid-flight.
    // If no paper is partway through, the property is stated over a constructed text rather
    // than silently skipped: a fabricated 400/400 count must not read as complete.
    const partial = ROUTE_SLUGS.filter(
      (slug) => inspectLedgerPresence(slug).presence === "partial",
    );
    for (const slug of partial) {
      expect(
        (PAPERS_WAITING_ON_CLOUD_OCR as readonly string[]).includes(slug),
        `${slug} has a partial ledger and must stay listed`,
      ).toBe(true);
    }
    expect(
      translationCompleteness({
        ledger: "partial",
        translationUnitCount: 400,
        germanAlignableCount: 400,
      }),
      "a padded count over a partial ledger must not read as complete",
    ).toBe("not-applicable-partial-ledger");
  });

  test("mass-energy has a ledger, and its contract judges instead of declining ledger-absent", () => {
    // The concrete gain of 2026-09-20, pinned so it cannot silently regress to a decline.
    expect(inspectLedgerPresence("mass-energy").presence).toBe("complete");
    const contract = assertEditionContract("mass-energy", {});
    expect(contract.ledger).toBe("complete");
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
      // Listed means NOT COVERED, which is absent or partial. It asserted "absent" until
      // 2026-09-21, when ap-17-132 acquired a skeleton and became the first legitimately
      // listed paper with a file on disk. Asserting the coverage rather than the absence is
      // what lets a paper stay guarded while it is being transcribed.
      expect(record.presence).not.toBe("complete");
      expect(
        translationCompleteness({
          ledger: record.presence,
          translationUnitCount: 400,
          germanAlignableCount: 400,
        }),
      ).toBe(
        record.presence === "absent" ? "not-applicable-no-ledger" : "not-applicable-partial-ledger",
      );
      const contract = assertEditionContract(slug, {
        englishIds: Array.from({ length: 12 }, (_, i) => `s0-p1-s${i + 1}`),
        germanIds: Array.from({ length: 12 }, (_, i) => `s0-p1-s${i + 1}`),
      });
      // The invariant, stated for every listed paper whatever its coverage: it never
      // reports complete, by any route.
      expect(contract.ledger).not.toBe("complete");
      expect(contract.outcome).not.toBe("passed");
      expect(contract.translationCompleteness).not.toBe("complete");
      expect(contract.translationCompleteness).toMatch(/^not-applicable-/);
      // And the mechanism, per state: an absent ledger still declines ledger-absent, which
      // is the assertion this test was written for and is kept rather than generalised away.
      if (record.presence === "absent") {
        expect(contract.ledger).toBe("absent");
        expect(contract.outcome).toBe("not-available");
        expect(contract.checks.some((c) => c.code === "ledger-absent")).toBe(true);
      }
      expect(JSON.stringify(contract)).not.toMatch(/"complete"/);
      const report = coverageReport({
        slug,
        germanUnitCount: 50,
        translationUnitCount: 50,
      });
      expect(report.translation).toBe(
        record.presence === "absent" ? "not-applicable-no-ledger" : "not-applicable-partial-ledger",
      );
      expect(report.translation).not.toBe("complete");
      expect(coverageReportMarkdown(report).toLowerCase()).toContain(
        record.presence === "absent" ? "no ledger present" : "does not yet cover",
      );
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
