/**
 * THE CANDIDATE'S OWN BUILD IS MEASURED AGAINST THE PERF BUDGETS (am-opd1).
 *
 * 6b9ec998 went live with `out/papers/brownian-motion/index.html` at 256,141 bytes gzipped, over
 * the 250,000-byte reading-face-html budget. Nothing was broken in the budget row: the verified
 * deploy's gate chain runs the unit-test lane at step 5 and the BUILD at step 9, so
 * `runPerfBudgets.test.ts` measured the `out/` left behind by the PREVIOUS deploy. eaec86a3 had
 * passed, so the chain was green, and the regression surfaced only on the next deploy attempt,
 * which was refused on 2026-09-23.
 *
 * A budget measured before the build is a true statement about the last release. That is the same
 * error as citing a command's exit code without knowing what it examined: the numbers were real and
 * they described the wrong artifact.
 *
 * So this runs AFTER the build and BEFORE anything is uploaded or aliased, over the tree the
 * candidate commit just produced. It is a separate small module rather than inline code in the
 * deploy script so its refusal can be driven by a test without going near a network path: the proof
 * of a release gate should not require a release.
 *
 * WHAT IT REFUSES ON, and the two cases are different:
 *
 *   - a build-dependent row that FAILED. The refusal quotes the row's own notes, which name the
 *     failing faces and their gzip sizes, so a releaser reads which page and how big rather than
 *     "a budget failed".
 *   - a build-dependent row that reached NO VERDICT. `unmeasuredBuildRows` exists because a run
 *     whose build rows dropped out used to report outcome "pass" on whatever survived (am-7bkr).
 *     Unmeasured is not met, and a release must not proceed on a budget nobody took.
 *
 * Rows that are not build-dependent are left alone: five of the eight are unavailable in this
 * harness by construction and one is unconditional, so failing a release on them would refuse every
 * release. `BUILD_DEPENDENT_ROWS` is the runner's own list and names the two rows the bead asks for.
 */

import {
  BUILD_DEPENDENT_ROWS,
  type RunPerfBudgetsResult,
  unmeasuredBuildRows,
} from "./run-perf-budgets.ts";

export interface BuildBudgetVerdict {
  readonly ok: boolean;
  /** Build-dependent rows that failed, each carrying the row's own notes. */
  readonly failed: readonly string[];
  /** Build-dependent rows that reached no verdict at all. */
  readonly unmeasured: readonly string[];
  /** One line per build-dependent row, for the release log whether it passed or not. */
  readonly measured: readonly string[];
}

/**
 * Reads a completed budget run and says whether a release may proceed.
 *
 * Pure by design: it takes the result and returns a verdict, so the caller decides whether to
 * throw. The deploy script throws; the test reads the verdict.
 */
export function buildBudgetVerdict(result: RunPerfBudgetsResult): BuildBudgetVerdict {
  const metrics = result.report.metrics;
  const unmeasured = unmeasuredBuildRows(metrics);
  const failed: string[] = [];
  const measured: string[] = [];
  for (const row of BUILD_DEPENDENT_ROWS) {
    const entry = metrics[row];
    const status = entry?.status ?? "not-available";
    const where = `${row}: ${status}, budget ${String(entry?.budget ?? "unknown")} ${entry?.unit ?? ""}, measured ${String(entry?.actual ?? "none")}`;
    measured.push(entry?.notes ? `${where} -- ${entry.notes}` : where);
    if (status === "fail") failed.push(entry?.notes ? `${row}: ${entry.notes}` : row);
  }
  return { ok: failed.length === 0 && unmeasured.length === 0, failed, unmeasured, measured };
}

/**
 * A TYPED REFUSAL, NOT A BARE Error.
 *
 * The first version of this gate threw `new Error(...)`, and bareThrowRatchet refused the commit:
 * `scripts/verified-production-deploy.ts: 25 bare throw site(s), recorded 24`. Its message said what
 * to do -- "Give the new refusal a typed code so refusalRatchet can see it" -- and that is the
 * better shape regardless of the ratchet. A release refusal belongs in a log a reader can filter,
 * and AGENTS.md's refusal contract asks for a typed code, the affected inputs, a readable reason and
 * possible repairs.
 *
 * The two cases carry DIFFERENT codes, because they call for different actions: a page that is over
 * budget has to be made smaller or recorded, while a row that reached no verdict means the measuring
 * did not happen and the build has to be run first. Collapsing them into one code would put both
 * behind one grep.
 */
export class BuildBudgetError extends Error {
  readonly code: string;
  readonly rows: readonly string[];
  constructor(code: string, message: string, rows: readonly string[]) {
    super(message);
    this.name = "BuildBudgetError";
    this.code = code;
    this.rows = rows;
  }
}

/** The message a refusal carries. Separate so a test asserts the text a releaser would read. */
export function buildBudgetRefusal(verdict: BuildBudgetVerdict): string {
  const parts = ["Performance budgets refuse this candidate build."];
  if (verdict.failed.length > 0) parts.push(`Over budget: ${verdict.failed.join(" | ")}`);
  if (verdict.unmeasured.length > 0) {
    parts.push(
      `Reached no verdict, which is not a pass: ${verdict.unmeasured.join(", ")}. Build the site before this gate.`,
    );
  }
  parts.push(
    "Measured after the build and before any upload or alias move, so this describes the candidate commit rather than the previous release (am-opd1).",
  );
  return parts.join(" ");
}

/**
 * Throws when a candidate build may not be released. The deploy calls this; nothing else should
 * decide the question, so the verdict and the message stay in one place.
 */
export function assertBuildBudgets(result: RunPerfBudgetsResult): BuildBudgetVerdict {
  const verdict = buildBudgetVerdict(result);
  if (verdict.failed.length > 0) {
    throw new BuildBudgetError(
      "build-budget-exceeded",
      buildBudgetRefusal(verdict),
      verdict.failed,
    );
  }
  if (verdict.unmeasured.length > 0) {
    throw new BuildBudgetError(
      "build-budget-unmeasured",
      buildBudgetRefusal(verdict),
      verdict.unmeasured,
    );
  }
  return verdict;
}
