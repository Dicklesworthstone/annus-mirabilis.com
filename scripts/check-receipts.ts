#!/usr/bin/env node
/**
 * CLI command for verifying provenance receipts and survey records.
 * Usage:
 *   node --experimental-strip-types scripts/check-receipts.ts [--key <key>] [--dir <dir>] [--config-dir <dir>] [--surveys] [--require-local] [--log-run-id <id>]
 *   bun scripts/check-receipts.ts [--key <key>] [--dir <dir>] [--config-dir <dir>] [--surveys] [--require-local] [--log-run-id <id>]
 */

import fs from "node:fs";
import path from "node:path";
import { type CheckResult, checkReceipt } from "../src/content/provenance/checkReceipt.ts";
import { validateSurveyRecord } from "../src/content/provenance/surveySchema.ts";
import { newRunIdentity } from "../src/testing/log/logger.ts";
import { reportPopulation } from "./gate-census/population.ts";

type CliOptions = {
  key?: string;
  dir: string;
  configDir?: string;
  surveysDir: string;
  checkSurveys: boolean;
  requireLocal: boolean;
  logRunId: string;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    dir: "docs/provenance",
    surveysDir: "docs/provenance/survey",
    checkSurveys: false,
    requireLocal: false,
    logRunId: newRunIdentity(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--key" && i + 1 < args.length) {
      const val = args[++i];
      if (val !== undefined) {
        options.key = val;
      }
    } else if (arg === "--dir" && i + 1 < args.length) {
      const val = args[++i];
      if (val !== undefined) {
        options.dir = val;
      }
    } else if (arg === "--config-dir" && i + 1 < args.length) {
      const val = args[++i];
      if (val !== undefined) {
        options.configDir = val;
      }
    } else if (arg === "--surveys-dir" && i + 1 < args.length) {
      const val = args[++i];
      if (val !== undefined) {
        options.surveysDir = val;
      }
    } else if (arg === "--surveys") {
      options.checkSurveys = true;
    } else if (arg === "--require-local") {
      options.requireLocal = true;
    } else if (arg === "--log-run-id" && i + 1 < args.length) {
      const val = args[++i];
      if (val !== undefined) {
        options.logRunId = val;
      }
    }
  }

  if (
    !options.configDir &&
    options.dir === "docs/provenance" &&
    fs.existsSync("scripts/sources/facsimile-sources")
  ) {
    options.configDir = "scripts/sources/facsimile-sources";
  }

  return options;
}

type StructuredLogEntry = {
  timestamp: string;
  suite: "receipts";
  logRunId: string;
  testId: string;
  beadId: string;
  key: string;
  receiptPath: string;
  rule: string;
  severity: "error" | "flag" | "info";
  path: string;
  expected?: string | undefined;
  actual?: string | undefined;
  outcome: "pass" | "fail" | "flagged";
  message: string;
  repair?: string | undefined;
};

export async function runCheckReceipts(rawArgs: string[] = process.argv.slice(2)): Promise<number> {
  const options = parseArgs(rawArgs);
  const logs: StructuredLogEntry[] = [];
  const logDir = path.join("artifacts", "test-logs", "receipts");
  fs.mkdirSync(logDir, { recursive: true });

  let totalErrors = 0;
  let totalFlags = 0;
  let filesChecked = 0;

  console.log(`[check-receipts] Starting verification (runId: ${options.logRunId})`);

  // 1. Check receipts
  if (fs.existsSync(options.dir)) {
    const entries = fs.readdirSync(options.dir);
    const receiptFiles = entries
      .filter((f) => f.endsWith(".md") && !f.startsWith("."))
      .filter((f) => !options.key || f === `${options.key}.md` || f.startsWith(options.key));

    for (const f of receiptFiles) {
      const fullPath = path.join(options.dir, f);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;

      const content = fs.readFileSync(fullPath, "utf8");
      filesChecked++;

      const res: CheckResult = checkReceipt(content, fullPath, {
        requireLocal: options.requireLocal,
        configDir: options.configDir,
      });

      if (res.errors.length > 0) {
        totalErrors += res.errors.length;
        console.error(`❌ [ERROR] ${f} (${res.errors.length} errors):`);
        for (const e of res.errors) {
          console.error(`   - [${e.rule}] ${e.path}: ${e.message}`);
          logs.push({
            timestamp: new Date().toISOString(),
            suite: "receipts",
            logRunId: options.logRunId,
            testId: `receipt-${res.key}-${e.rule}`,
            beadId: "am-src-receipt-format-npo5",
            key: res.key,
            receiptPath: fullPath,
            rule: e.rule,
            severity: "error",
            path: e.path,
            expected: e.expected,
            actual: e.actual,
            outcome: "fail",
            message: e.message,
            repair: e.repair,
          });
        }
      }

      if (res.flags.length > 0) {
        totalFlags += res.flags.length;
        console.warn(`⚠️  [FLAG] ${f} (${res.flags.length} flags):`);
        for (const fl of res.flags) {
          console.warn(`   - [${fl.rule}] ${fl.path}: ${fl.message}`);
          logs.push({
            timestamp: new Date().toISOString(),
            suite: "receipts",
            logRunId: options.logRunId,
            testId: `receipt-${res.key}-${fl.rule}`,
            beadId: "am-src-receipt-format-npo5",
            key: res.key,
            receiptPath: fullPath,
            rule: fl.rule,
            severity: "flag",
            path: fl.path,
            expected: fl.expected,
            actual: fl.actual,
            outcome: "flagged",
            message: fl.message,
            repair: fl.repair,
          });
        }
      }

      if (res.errors.length === 0 && res.flags.length === 0) {
        console.log(`✅ [OK] ${f}`);
        logs.push({
          timestamp: new Date().toISOString(),
          suite: "receipts",
          logRunId: options.logRunId,
          testId: `receipt-${res.key}-pass`,
          beadId: "am-src-receipt-format-npo5",
          key: res.key,
          receiptPath: fullPath,
          rule: "all-pass",
          severity: "info",
          path: "root",
          outcome: "pass",
          message: "Receipt passed all verification checks.",
        });
      }
    }
  }

  // 2. Check surveys if requested
  if (options.checkSurveys && fs.existsSync(options.surveysDir)) {
    const surveyEntries = fs.readdirSync(options.surveysDir);
    const surveyFiles = surveyEntries
      .filter((f) => f.endsWith(".md") && f.startsWith("ap-"))
      .filter((f) => !options.key || f === `${options.key}.md` || f.startsWith(options.key));

    for (const f of surveyFiles) {
      const fullPath = path.join(options.surveysDir, f);
      const content = fs.readFileSync(fullPath, "utf8");
      filesChecked++;

      const res = validateSurveyRecord(content, fullPath);
      const key = f.replace(/\.md$/, "");

      const surveyErrors = res.diagnostics.filter((d) => d.severity === "error");
      const surveyFlags = res.diagnostics.filter((d) => d.severity === "flag");

      if (surveyErrors.length > 0) {
        totalErrors += surveyErrors.length;
        console.error(`❌ [SURVEY ERROR] ${f} (${surveyErrors.length} errors):`);
        for (const e of surveyErrors) {
          console.error(`   - [${e.rule}] ${e.path}: ${e.message}`);
          logs.push({
            timestamp: new Date().toISOString(),
            suite: "receipts",
            logRunId: options.logRunId,
            testId: `survey-${key}-${e.rule}`,
            beadId: "am-src-receipt-format-npo5",
            key,
            receiptPath: fullPath,
            rule: e.rule,
            severity: "error",
            path: e.path,
            expected: e.expected,
            actual: e.actual,
            outcome: "fail",
            message: e.message,
          });
        }
      }

      if (surveyFlags.length > 0) {
        totalFlags += surveyFlags.length;
        console.warn(`⚠️  [SURVEY FLAG] ${f} (${surveyFlags.length} flags):`);
        for (const fl of surveyFlags) {
          console.warn(`   - [${fl.rule}] ${fl.path}: ${fl.message}`);
          logs.push({
            timestamp: new Date().toISOString(),
            suite: "receipts",
            logRunId: options.logRunId,
            testId: `survey-${key}-${fl.rule}`,
            beadId: "am-src-receipt-format-npo5",
            key,
            receiptPath: fullPath,
            rule: fl.rule,
            severity: "flag",
            path: fl.path,
            expected: fl.expected,
            actual: fl.actual,
            outcome: "flagged",
            message: fl.message,
          });
        }
      }

      if (surveyErrors.length === 0 && surveyFlags.length === 0) {
        console.log(`✅ [SURVEY OK] ${f}`);
        logs.push({
          timestamp: new Date().toISOString(),
          suite: "receipts",
          logRunId: options.logRunId,
          testId: `survey-${key}-pass`,
          beadId: "am-src-receipt-format-npo5",
          key,
          receiptPath: fullPath,
          rule: "all-pass",
          severity: "info",
          path: "root",
          outcome: "pass",
          message: "Survey passed all verification checks.",
        });
      }
    }
  }

  // Write structured JSONL log
  const logFile = path.join(logDir, `${options.logRunId}.jsonl`);
  const logContent = logs.map((l) => JSON.stringify(l)).join("\n") + (logs.length > 0 ? "\n" : "");
  fs.writeFileSync(logFile, logContent, "utf8");

  console.log(
    `\nSummary: ${filesChecked} files checked, ${totalErrors} errors, ${totalFlags} flags.`,
  );
  // The census line (am-rc1001-bridge-plan-pcjk.9). Measured 2026-10-06: 10 receipt files, 0 errors,
  // 43 flags. A floor of 6 is one per pinned facsimile: fewer means the receipt directory was not read.
  // Re-measured 2026-10-07: SIX files checked, 0 errors, 43 flags - the flags agree and the count does
  // not, because this script reads docs/provenance at depth one and there are 6 receipts there against
  // 12 in the tree, the rest under datasets/ and other subdirectories. So the floor now sits exactly on
  // its population: one retired receipt turns it vacuous. That is the correct direction for a floor to
  // be tight in, and it is said out loud here because a floor equal to its corpus is easy to read as
  // slack when it is the opposite.
  //
  // THE FLOOR IS A STATEMENT ABOUT A FULL CORPUS RUN, AND `--key` IS NOT ONE. Measured 2026-10-07:
  // `bun scripts/check-receipts.ts --key ap-17-549` printed "1 files checked, 0 errors, 0 flags" and
  // then exited 1 on its own census, because one file is below six. Four node-lane tests call this
  // script with exactly that flag - the ap-17-549, ap-17-132 and ap-17-891 receipt checks in the three
  // manifest e2e suites, and the single-receipt case in the CLI suite - and all four failed on a clean
  // corpus while the summary line above them said zero errors.
  //
  // So the floor follows the population the caller asked for: six for the directory, one for a named
  // key. It is NOT disabled under --key, which would be the easy wrong answer: `--key no-such-receipt`
  // examines zero files and must still be vacuous, because a key that matches nothing is precisely the
  // case a census exists to catch. AGENTS.md's own rule is that a population floor belongs to its
  // corpus, and a narrowed run has a narrower corpus rather than no floor.
  const censusVacuous = reportPopulation({
    gate: "receipts",
    examined: filesChecked,
    noun: options.key
      ? `provenance receipt files matching --key ${options.key}`
      : "provenance receipt files",
    minimum: options.key ? 1 : 6,
  });
  console.log(`Log written to: ${logFile}`);

  return totalErrors > 0 || censusVacuous ? 1 : 0;
}

const isMainModule =
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1].endsWith("check-receipts.ts"));
if (isMainModule) {
  runCheckReceipts().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });
}
