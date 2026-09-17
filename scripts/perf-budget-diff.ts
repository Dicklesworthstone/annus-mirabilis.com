#!/usr/bin/env bun
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGitBudgetChangeCheck } from "./perf/budgetChangeCheck.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
      process.exit(1);
    }

    console.log("[perf-budget-diff] PASSED: All budget changes conform to governance policy.");
    process.exit(0);
  } catch (err) {
    console.error(`[perf-budget-diff] Error executing check:`, err);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
