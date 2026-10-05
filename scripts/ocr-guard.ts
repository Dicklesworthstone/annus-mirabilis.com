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
 */

import {
  KNOWN_UNRESOLVED_VIOLATIONS,
  scanRepositoryForForbiddenOcr,
  undeclaredViolations,
} from "./sources/ocrGuard.ts";

async function main(): Promise<void> {
  const result = await scanRepositoryForForbiddenOcr();
  const undeclared = undeclaredViolations(result.violations);
  const pinnedSeen = result.violations.length - undeclared.length;

  console.log(
    `[ocr-guard] ${result.scannedFileCount} file(s) scanned; ${result.violations.length} violation(s), ` +
      `${pinnedSeen} of them the pinned open question, ${undeclared.length} undeclared`,
  );

  // A scan over nothing is not a clean scan. Checked before the verdict, not after.
  if (result.scannedFileCount === 0) {
    console.error(
      "[ocr-guard] REFUSED: the scan examined 0 files, so it establishes nothing. " +
        "A guard that measured an empty population exits clean and reads as a clean repository.",
    );
    process.exit(1);
  }

  for (const violation of undeclared)
    console.error(
      `[ocr-guard] ${violation.file}:${violation.line}: [${violation.pattern}] ${violation.reason}\n` +
        `    ${violation.snippet.trim()}`,
    );

  if (undeclared.length > 0) {
    console.error(
      `[ocr-guard] FAILED: ${undeclared.length} forbidden OCR call(s). AGENTS.md admits no ` +
        "convenience, deadline, fallback or small-batch exception. Do not add an entry to " +
        "KNOWN_UNRESOLVED_VIOLATIONS to quiet this: that list is an owner decision, not an " +
        "exemption mechanism.",
    );
    process.exit(1);
  }

  // The pinned entries are reported on a pass too, so a reader of a green run still sees them.
  for (const pin of KNOWN_UNRESOLVED_VIOLATIONS)
    console.log(
      `[ocr-guard] pinned open question, awaiting an owner ruling: ${pin.file} [${pin.pattern}]`,
    );
  console.log("[ocr-guard] PASSED");
}

await main();
