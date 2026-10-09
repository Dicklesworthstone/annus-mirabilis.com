#!/usr/bin/env bun
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TestLogger } from "../src/testing/log/logger.ts";
import { reportPopulation } from "./gate-census/population.ts";
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

    /*
      THE POPULATION, IN THE CENSUS'S ONE GRAMMAR (am-rc1001-bridge-plan-pcjk.9), printed before any
      verdict.

      "No performance budget modifications detected" is this gate's answer on almost every run, and
      it is the SAME SENTENCE a run that compared nothing would print: an empty budgets file, a
      `budgets` key that moved, a parse that yielded no rows. The gate would then report PASSED over
      a population it never had, which is the failure this census exists for.

      THE FLOOR IS 1, NOT TODAY'S 8, and that is the decision worth reviewing. A floor of 8 looks
      stronger and would be wrong: removing a budget row is a governance change this gate's own diff
      and DECISIONS.md check exist to police, so a population floor that refused it would be the
      gate fighting its own purpose, and it would refuse for the wrong reason -- "below floor" rather
      than "a budget was removed without a decision entry". The floor's only job here is to catch
      having compared nothing at all.
    */
    const censusVacuous = reportPopulation({
      gate: "perf-budget-change",
      examined: result.comparedRows,
      noun: "budget rows",
      minimum: 1,
    });
    if (censusVacuous) {
      console.error(
        `[perf-budget-diff] BUDGET_POPULATION_BELOW_FLOOR: ${result.comparedRows} budget row(s) ` +
          "compared, so 'no modifications detected' would be a statement about nothing. Check that " +
          "perf/budgets.json is present and that its `budgets` key still holds the rows.",
      );
      await logDiffRun(result);
      process.exit(1);
    }

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
