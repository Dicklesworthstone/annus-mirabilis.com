#!/usr/bin/env bun
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TestLogger } from "../src/testing/log/logger.ts";
import { runGitBudgetChangeCheck } from "./perf/budgetChangeCheck.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Structured log (am-uxh9). This gate wrote nothing at all, so there was no
 * record that it had run - and a governance check whose quiet pass leaves no
 * trace cannot be distinguished afterwards from one that never executed. The
 * no-change case is logged too, deliberately: "nothing changed" is the result
 * this gate returns almost every run, and it is the one worth being able to
 * prove later.
 */
async function logDiffRun(result: {
  changed: boolean;
  ok: boolean;
  diffs: readonly { id: string; message?: string | undefined }[];
  violations: readonly string[];
}): Promise<void> {
  const logger = new TestLogger("perf-budget-diff");
  for (const diff of result.diffs) {
    logger.log({
      testId: `budget-change-${diff.id}`,
      outcome: "passed",
      message: diff.message ?? `Budget "${diff.id}" changed.`,
    });
  }
  for (const violation of result.violations) {
    logger.log({
      testId: "budget-governance-violation",
      outcome: "failed",
      message: violation,
    });
  }
  logger.log({
    testId: "perf-budget-diff-summary",
    outcome: result.ok ? "passed" : "failed",
    message: result.changed
      ? `${result.diffs.length} budget modification(s), ${result.violations.length} violation(s).`
      : "No performance budget modifications detected.",
  });
  await logger.flush();
  console.log(`[perf-budget-diff] Structured log: ${logger.filePath}`);
}

async function main(): Promise<void> {
  try {
    const result = runGitBudgetChangeCheck(ROOT);

    if (result.changed) {
      console.log(`[perf-budget-diff] Detected ${result.diffs.length} budget modification(s):`);
      for (const diff of result.diffs) {
        if (diff.isLoosened && diff.message) {
          console.log(`  - ${diff.message}`);
        } else {
          console.log(
            `  - Budget "${diff.id}" changed from ${JSON.stringify(diff.oldValue)} to ${JSON.stringify(diff.newValue)}`,
          );
        }
      }
    } else {
      console.log("[perf-budget-diff] No performance budget modifications detected.");
    }

    if (!result.ok) {
      console.error("[perf-budget-diff] FAILED:");
      for (const v of result.violations) {
        console.error(`  - ${v}`);
      }
      await logDiffRun(result);
      process.exit(1);
    }

    console.log("[perf-budget-diff] PASSED: All budget changes conform to governance policy.");
    await logDiffRun(result);
    process.exit(0);
  } catch (err) {
    console.error(`[perf-budget-diff] Error executing check:`, err);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
