#!/usr/bin/env bun

/**
 * THE OCR GUARD, RUNNABLE (am-jb4c).
 *
 * AGENTS.md: "NEVER RUN OCR ON THIS MACHINE ... This prohibition is permanent and has no
 * convenience, deadline, fallback, or 'small batch' exception." The scanner and its denylist have
 * existed for some time; what did not exist was a way to RUN them. The only caller was
 * scripts/ocr-guard.test.ts, so the check was real but invisible: anyone looking for
 * scripts/ocr-guard.ts, which is the name every other gate in this repository follows, found
 * nothing, and the gate registry had no step to point at.
 *
 * This is that entry point. It scans the repository, subtracts the one pinned open question, and
 * exits non-zero on anything else.
 *
 * THE PIN HAS ONE HOME, which is why this script adds no list of its own. The known violation and
 * the reasoning behind it live in scripts/sources/ocrGuard.ts, and both this and the test read the
 * same constant through `undeclaredViolations`. A second copy here would be a second place to quiet
 * a finding, and the pin's own note says a second entry is a second decision and belongs to the
 * owner.
 *
 * WHAT IT PRINTS, AND WHY THE COUNT IS PART OF THE VERDICT: the number of files scanned beside the
 * number of violations. A scan that examined nothing exits 0 and reads exactly like a clean
 * repository, so a scanned count of zero is a FAILURE here rather than a pass.
 *
 * AND WHAT IT PERSISTS (am-uxh9). Everything above went to stdout only, so this gate could not be
 * audited after the fact at all: a run's violations, its pinned open question and its scanned count
 * existed until the terminal scrolled. That is the bead's Class A defect, and it is worth more here
 * than on most gates, because the rule this one enforces is the single rule in AGENTS.md with no
 * exception, and because a violation of it is UNDETECTABLE DOWNSTREAM - a page transcribed from a
 * forbidden source and one transcribed from the plates are indistinguishable in the finished ledger.
 * The moment of the scan is the only place the question can be asked, so the scan's own answer is
 * the only thing that can be kept.
 *
 * Every path writes: the refusals, the failure, and the pass. A quiet pass that leaves no trace
 * cannot later be told apart from a gate that never ran, which is the same reasoning the three
 * Class A repairs on am-uxh9 recorded for perf-budget-diff.
 */

import { TestLogger } from "../src/testing/log/logger.ts";
import { reportPopulation } from "./gate-census/population.ts";
import {
  KNOWN_UNRESOLVED_VIOLATIONS,
  scanRepositoryForForbiddenOcr,
  undeclaredViolations,
} from "./sources/ocrGuard.ts";

async function main(): Promise<void> {
  const logger = new TestLogger("ocr-guard");
  const result = await scanRepositoryForForbiddenOcr();
  const undeclared = undeclaredViolations(result.violations);
  const pinnedSeen = result.violations.length - undeclared.length;

  console.log(
    `[ocr-guard] ${result.scannedFileCount} file(s) scanned; ${result.violations.length} violation(s), ` +
      `${pinnedSeen} of them the pinned open question, ${undeclared.length} undeclared`,
  );
  // The same number in the census's one grammar, so a reader across gates can ask whether any of them
  // examined nothing (am-rc1001-bridge-plan-pcjk.9). Printed BEFORE the verdict and on every path,
  // because a census that could only read a passing run could not tell a failing gate from a vacuous
  // one. The minimum is about 25% of the 4080 measured on 2026-10-06: a repository that lost three
  // quarters of its tracked sources is not a repository this scan has examined.
  const censusVacuous = reportPopulation({
    gate: "ocr-guard",
    examined: result.scannedFileCount,
    noun: "tracked source files",
    minimum: 1000,
  });
  if (censusVacuous) {
    const reason =
      "REFUSED: the scan examined fewer files than its declared minimum, so a clean " +
      "result would be a statement about a population this repository does not have.";
    console.error(`[ocr-guard] ${reason}`);
    logger.log({ testId: "ocr-guard-population", outcome: "failed", message: reason });
    await logger.flush();
    process.exit(1);
  }

  // A scan over nothing is not a clean scan. Checked before the verdict, not after.
  if (result.scannedFileCount === 0) {
    const reason =
      "REFUSED: the scan examined 0 files, so it establishes nothing. " +
      "A guard that measured an empty population exits clean and reads as a clean repository.";
    console.error(`[ocr-guard] ${reason}`);
    logger.log({ testId: "ocr-guard-population", outcome: "failed", message: reason });
    await logger.flush();
    process.exit(1);
  }

  for (const violation of undeclared) {
    console.error(
      `[ocr-guard] ${violation.file}:${violation.line}: [${violation.pattern}] ${violation.reason}\n` +
        `    ${violation.snippet.trim()}`,
    );
    // The row carries the snippet, because the file and line go stale the moment anything above them
    // moves and the snippet is what lets a later reader tell a real call from a renamed neighbour.
    logger.log({
      testId: `${violation.file}:${violation.line}`,
      outcome: "failed",
      message: `[${violation.pattern}] ${violation.reason} :: ${violation.snippet.trim()}`,
    });
  }

  // THE SUMMARY IS EMITTED ON BOTH VERDICTS, and it is the denominator. A set of failure rows with
  // no record of how many files produced them is the shape AGENTS.md warns about: three violations
  // out of 4102 files and three out of three are the same rows and very different findings.
  logger.log({
    testId: "ocr-guard-summary",
    outcome: undeclared.length > 0 ? "failed" : "passed",
    message:
      `${result.scannedFileCount} tracked source file(s) scanned; ${undeclared.length} undeclared ` +
      `violation(s); ${KNOWN_UNRESOLVED_VIOLATIONS.length} pinned open question(s).`,
  });

  if (undeclared.length > 0) {
    await logger.flush();
    console.log(`[ocr-guard] Structured log: ${logger.filePath}`);
    console.error(
      `[ocr-guard] FAILED: ${undeclared.length} forbidden OCR call(s). AGENTS.md admits no ` +
        "convenience, deadline, fallback or small-batch exception. Do not add an entry to " +
        "KNOWN_UNRESOLVED_VIOLATIONS to quiet this: that list is an owner decision, not an " +
        "exemption mechanism.",
    );
    process.exit(1);
  }

  // The pinned entries are reported on a pass too, so a reader of a green run still sees them.
  // The pinned entries are reported on a pass too, so a reader of a green run still sees them. They
  // are "skipped" rather than "passed": the scan found them, and nothing about them has been
  // resolved - they are waiting on an owner, which is not the same as being clean.
  for (const pin of KNOWN_UNRESOLVED_VIOLATIONS) {
    console.log(
      `[ocr-guard] pinned open question, awaiting an owner ruling: ${pin.file} [${pin.pattern}]`,
    );
    logger.log({
      testId: `pinned:${pin.file}`,
      outcome: "skipped",
      message: `pinned open question awaiting an owner ruling [${pin.pattern}]`,
    });
  }
  await logger.flush();
  console.log(`[ocr-guard] Structured log: ${logger.filePath}`);
  console.log("[ocr-guard] PASSED");
}

await main();
