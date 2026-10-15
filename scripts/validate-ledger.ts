#!/usr/bin/env bun
/**
 * CLI runner for reviewed diplomatic German ledger validation.
 * Governed by bead am-edn-ledger-validator-edv and docs/editorial/LEDGER_FORMAT.md.
 *
 * Usage:
 *   bun scripts/validate-ledger.ts <ledger path> [--paper <slug>] [--require-complete] [--allow-warnings]
 *   bun scripts/validate-ledger.ts --all [--require-complete] [--allow-warnings]
 *
 * Exit codes:
 *   0: valid and clean (or valid with warnings if --allow-warnings)
 *   1: errors present (in active mode), or --all found fewer ledgers than its floor
 *   2: warnings present or stale allowlist entries (when valid)
 *   3: usage or configuration error (unknown keys, missing sections, invalid arguments)
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { inspectAllLedgers } from "../src/content/editions/ledgerPresence.ts";
import { validateLedger } from "../src/content/ledger/validateLedger.ts";
import { reportPopulation } from "./gate-census/population.ts";

/**
 * THE SWEEP, which is what makes this script reachable by a gate (am-unwired-audits-uwot).
 *
 * One path per run means one run per hand, so until now nothing re-validated the ledgers after
 * anyone edited one. They are not inert evidence: AGENTS.md records that the German face renders
 * all four papers FROM THESE DRAFTS, so a dropped page marker, a glued paragraph or a mid-word
 * hyphen in one of them reaches a reader. Measured 2026-10-14 each is clean under its own paper
 * slug (17, 12, 31 and 3 pages; 67, 51, 131 and 14 paragraphs), so this is green on arrival and
 * does not train anyone to ignore a red gate.
 *
 * THE FLOOR IS FOUR AND IT IS THE POINT. A sweep over an empty directory validates nothing and
 * exits 0, which is indistinguishable from a sweep over four clean ledgers; AGENTS.md calls that
 * out as its own class of defect ("zero files checked reads as clean"). Four is not aspirational:
 * four ledgers exist today, one per paper of 1905, so a run that finds three has lost one.
 *
 * It sweeps what `inspectAllLedgers` reports PRESENT rather than globbing the directory, so this
 * and the edition agree about what a ledger is, including the draft/reviewed filename rule the
 * owner set on am-wisq. A paper with no ledger is reported and is not a failure here: absence is
 * ledgerAbsence.test.ts's question, and duplicating it would put one fact under two owners.
 */
async function validateEveryLedger(
  requireComplete: boolean,
  allowWarnings: boolean,
): Promise<never> {
  const root = process.cwd();
  const all = inspectAllLedgers(root);
  const present = all.filter((record) => record.presence !== "absent");
  const absent = all.filter((record) => record.presence === "absent");

  let invalid = 0;
  let unclean = 0;
  let pages = 0;
  for (const record of present) {
    try {
      const result = validateLedger(resolve(root, record.path), {
        paper: record.slug,
        requireComplete,
        allowWarnings,
      });
      pages += result.stats.pages;
      if (!result.valid) invalid += 1;
      else if (!result.clean) unclean += 1;
      console.error(
        `[validate-ledger] ${record.path} (${record.slug}, ${record.presence}): ` +
          `${result.stats.pages} pages, ${result.stats.paragraphs} paragraphs, ` +
          `${result.errors.length} error(s), ${result.warnings.length} warning(s) of which ` +
          // Only the unacknowledged ones govern `clean`, so printing the total alone would read
          // as eight outstanding problems on a ledger whose warnings are all accounted for.
          `${result.warnings.filter((w) => !w.acknowledged).length} unacknowledged`,
      );
      for (const err of result.errors) console.log(JSON.stringify({ type: "finding", ...err }));
    } catch (err) {
      invalid += 1;
      console.error(
        `[validate-ledger] ${record.path}: validation threw: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }
  for (const record of absent) {
    console.error(`[validate-ledger] ${record.slug}: no ledger on disk (${record.path})`);
  }

  const vacuous = reportPopulation({
    gate: "german-ledgers",
    examined: present.length,
    noun: "German ledgers",
    // The four papers of 1905, each with a ledger on disk today. A sweep that finds fewer has
    // lost one, and must not report the survivors as a clean corpus.
    minimum: 4,
  });
  console.error(
    `[validate-ledger] swept ${present.length} ledger(s), ${pages} pages: ` +
      `${invalid} invalid, ${unclean} with warnings, ${absent.length} paper(s) with no ledger`,
  );

  if (vacuous) {
    console.error(
      "[validate-ledger] REFUSED: fewer ledgers than the declared floor, so a clean result here " +
        "would be a statement about nothing.",
    );
    process.exit(1);
  }
  if (invalid > 0) process.exit(1);
  if (unclean > 0 && !allowWarnings) process.exit(2);
  process.exit(0);
}

function printUsage(): void {
  console.error(
    "Usage: bun scripts/validate-ledger.ts <ledger path> [--paper <slug>] [--require-complete] [--allow-warnings]\n" +
      "       bun scripts/validate-ledger.ts --all [--require-complete] [--allow-warnings]",
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    printUsage();
    process.exit(3);
  }

  let ledgerPath = "";
  let paper: string | undefined;
  let requireComplete = false;
  let allowWarnings = false;
  let sweep = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") {
      sweep = true;
    } else if (arg === "--paper") {
      paper = argv[++i];
      if (!paper) {
        console.error("Error: --paper requires a slug value.");
        process.exit(3);
      }
    } else if (arg === "--require-complete") {
      requireComplete = true;
    } else if (arg === "--allow-warnings") {
      allowWarnings = true;
    } else if (arg?.startsWith("-")) {
      console.error(`Error: Unknown flag "${arg}"`);
      printUsage();
      process.exit(3);
    } else if (!ledgerPath) {
      ledgerPath = arg ?? "";
    }
  }

  if (sweep) {
    if (ledgerPath || paper) {
      console.error("Error: --all sweeps every ledger, so it takes no path and no --paper.");
      printUsage();
      process.exit(3);
    }
    await validateEveryLedger(requireComplete, allowWarnings);
  }

  if (!ledgerPath) {
    console.error("Error: Missing ledger path argument.");
    printUsage();
    process.exit(3);
  }

  const resolvedPath = resolve(process.cwd(), ledgerPath);
  if (!existsSync(resolvedPath)) {
    console.error(`Error: Ledger file does not exist at "${resolvedPath}".`);
    process.exit(3);
  }

  try {
    const result = validateLedger(resolvedPath, {
      paper,
      requireComplete,
      allowWarnings,
    });

    // Stream findings as JSON lines
    for (const err of result.errors) {
      console.log(
        JSON.stringify({
          type: "finding",
          code: err.code,
          severity: err.severity,
          ledgerLine: err.ledgerLine,
          ledgerPage: err.ledgerPage,
          pdfPageIndex: err.pdfPageIndex,
          printedPage: err.printedPage,
          message: err.message,
          repair: err.repair,
          excerpt: err.excerpt,
          acknowledged: false,
        }),
      );
    }

    for (const w of result.warnings) {
      console.log(
        JSON.stringify({
          type: "finding",
          code: w.code,
          severity: w.severity,
          ledgerLine: w.ledgerLine,
          ledgerPage: w.ledgerPage,
          pdfPageIndex: w.pdfPageIndex,
          printedPage: w.printedPage,
          message: w.message,
          repair: w.repair,
          excerpt: w.excerpt,
          acknowledged: Boolean(w.acknowledged),
        }),
      );
    }

    for (const inf of result.info) {
      console.log(
        JSON.stringify({
          type: "finding",
          code: inf.code,
          severity: inf.severity,
          ledgerLine: inf.ledgerLine,
          ledgerPage: inf.ledgerPage,
          pdfPageIndex: inf.pdfPageIndex,
          printedPage: inf.printedPage,
          message: inf.message,
          excerpt: inf.excerpt,
          acknowledged: false,
        }),
      );
    }

    // Summary line as JSON
    const summary = {
      type: "summary",
      mode: result.mode,
      ledgerKey: result.ledgerKey,
      configSection: result.configSection,
      valid: result.valid,
      clean: result.clean,
      errors: result.errors.length,
      warnings: result.warnings.length,
      unacknowledgedWarnings: result.warnings.filter((w) => !w.acknowledged).length,
      info: result.info.length,
      staleAllowlistEntries: result.staleAllowlistEntries.length,
      stats: result.stats,
    };
    console.log(JSON.stringify(summary));

    // Determine exit code
    if (
      result.errors.some((e) => e.code === "config-key-unknown" || e.code === "config-key-missing")
    ) {
      process.exit(3);
    }

    if (!result.valid) {
      process.exit(1);
    }

    if (!result.clean && !allowWarnings) {
      process.exit(2);
    }

    process.exit(0);
  } catch (err) {
    console.error("Ledger validation failed:", err instanceof Error ? err.message : String(err));
    process.exit(3);
  }
}

main();
