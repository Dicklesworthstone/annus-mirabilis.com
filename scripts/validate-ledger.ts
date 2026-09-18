#!/usr/bin/env bun
/**
 * CLI runner for reviewed diplomatic German ledger validation.
 * Governed by bead am-edn-ledger-validator-edv and docs/editorial/LEDGER_FORMAT.md.
 *
 * Usage:
 *   bun scripts/validate-ledger.ts <ledger path> [--paper <slug>] [--require-complete] [--allow-warnings]
 *
 * Exit codes:
 *   0: valid and clean (or valid with warnings if --allow-warnings)
 *   1: errors present (in active mode)
 *   2: warnings present or stale allowlist entries (when valid)
 *   3: usage or configuration error (unknown keys, missing sections, invalid arguments)
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateLedger } from "../src/content/ledger/validateLedger.ts";

function printUsage(): void {
  console.error(
    "Usage: bun scripts/validate-ledger.ts <ledger path> [--paper <slug>] [--require-complete] [--allow-warnings]",
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

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--paper") {
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
