import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BudgetDefinition, BudgetsFile } from "./budgets.ts";

export interface BudgetDiffItem {
  id: string;
  oldValue: unknown;
  newValue: unknown;
  oldEntry?: BudgetDefinition;
  newEntry: BudgetDefinition;
  isLoosened: boolean;
  message?: string;
}

export interface BudgetChangeCheckInput {
  baseBudgetsRaw?: string | null;
  currentBudgetsRaw: string;
  measurementFiles?: readonly string[];
  decisionsMdContent?: string;
}

export interface BudgetChangeCheckResult {
  ok: boolean;
  changed: boolean;
  diffs: readonly BudgetDiffItem[];
  violations: readonly string[];
  message: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");

export function isNumeric(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

export function detectIfLoosened(oldVal: unknown, newVal: unknown): boolean {
  if (isNumeric(oldVal) && isNumeric(newVal)) {
    return newVal > oldVal;
  }
  return false;
}

/**
 * Is this filename the measurement record for this budget id?
 *
 * The predicate here read
 *
 *     f.includes(`-${id}.json`) || f.endsWith(`${id}.json`)
 *
 * and both disjuncts match a LONGER id's file. `"cumulative-layout-shift.json"` satisfies
 * the id `layout-shift` under either one, because the id sits at the end of a longer name
 * and neither test anchors what comes before it. So another budget's measurement record
 * could discharge this budget's governance requirement - fail-open on the check that a
 * loosened budget was measured before it was loosened.
 *
 * A hyphen boundary does not rescue it either: `"cumulative-layout-shift.json"` ends with
 * `-layout-shift.json` as well.
 *
 * THE CONVENTION IS NOT MINE TO INVENT, and I nearly did. perf/measurements/ is empty, so
 * I first anchored the id at the START of the name - and the existing test in this
 * directory already fixes the shape as `2026-09-17-initial-route-js.json`, a date prefix
 * with the id at the END. Anchoring the PREFIX is what distinguishes them: the part
 * before `-${id}.json` must be a date or a tool-run id in full, so
 * `2026-09-17-layout-shift.json` is admitted while `cumulative-layout-shift.json` is
 * refused (prefix `cumulative`) and `2026-09-17-cumulative-layout-shift.json` is refused
 * for this id too (prefix `2026-09-17-cumulative`).
 */
const MEASUREMENT_PREFIX = /^\d{4}-\d{2}-\d{2}(?:T[0-9A-Za-z]+)?(?:-[0-9a-f]{4,})?$/;

export function isMeasurementFor(fileName: string, id: string): boolean {
  if (fileName === `${id}.json`) return true;
  const suffix = `-${id}.json`;
  if (!fileName.endsWith(suffix)) return false;
  const prefix = fileName.slice(0, fileName.length - suffix.length);
  return MEASUREMENT_PREFIX.test(prefix);
}

/**
 * Pure evaluation of budget changes against governance rules:
 * 1. Fails a changed budget without a committed measurement record in perf/measurements/.
 * 2. Fails a changed budget without a corresponding entry in docs/DECISIONS.md.
 * 3. Both together pass.
 * 4. A loosened budget's message explicitly names both the old and new values.
 */
export function checkBudgetChanges(input: BudgetChangeCheckInput): BudgetChangeCheckResult {
  const currentParsed = JSON.parse(input.currentBudgetsRaw) as BudgetsFile;
  const currentBudgets = currentParsed.budgets;

  if (!input.baseBudgetsRaw) {
    // If there is no base budget (initial creation), pass cleanly
    return {
      ok: true,
      changed: false,
      diffs: [],
      violations: [],
      message: "No prior budget baseline found (initial establishment).",
    };
  }

  const baseParsed = JSON.parse(input.baseBudgetsRaw) as BudgetsFile;
  const baseBudgets = baseParsed.budgets;

  const diffs: BudgetDiffItem[] = [];
  const violations: string[] = [];

  for (const [id, newEntry] of Object.entries(currentBudgets)) {
    const oldEntry = baseBudgets[id as keyof typeof baseBudgets];
    if (!oldEntry) {
      diffs.push({
        id,
        oldValue: undefined,
        newValue: newEntry.value,
        newEntry,
        isLoosened: false,
      });
      continue;
    }

    const valueChanged = JSON.stringify(oldEntry.value) !== JSON.stringify(newEntry.value);
    const decisionChanged = oldEntry.decisionId !== newEntry.decisionId;

    if (valueChanged || decisionChanged) {
      const isLoosened = detectIfLoosened(oldEntry.value, newEntry.value);
      const diffItem: BudgetDiffItem = {
        id,
        oldValue: oldEntry.value,
        newValue: newEntry.value,
        oldEntry,
        newEntry,
        isLoosened,
      };

      if (isLoosened) {
        diffItem.message = `Loosened budget for "${id}" from ${JSON.stringify(oldEntry.value)} to ${JSON.stringify(newEntry.value)} ${newEntry.unit}`;
      }

      diffs.push(diffItem);

      // Check 1: Measurement record must exist under perf/measurements/
      const hasMeasurement = input.measurementFiles?.some((f) => isMeasurementFor(f, id));
      if (!hasMeasurement) {
        violations.push(
          `Budget "${id}" changed from ${JSON.stringify(oldEntry.value)} to ${JSON.stringify(newEntry.value)} without a committed measurement record in perf/measurements/`,
        );
      }

      // Check 2: Decision entry must exist in docs/DECISIONS.md
      const decisionId = newEntry.decisionId;
      if (!decisionId || !input.decisionsMdContent?.includes(decisionId)) {
        violations.push(
          `Budget "${id}" references decision "${decisionId}" which is missing from docs/DECISIONS.md`,
        );
      }
    }
  }

  const changed = diffs.length > 0;
  const ok = violations.length === 0;
  const message = changed
    ? ok
      ? `Budget changes verified with required measurement records and DECISIONS.md entries (${diffs.length} change(s)).`
      : `Budget change check failed with ${violations.length} violation(s):\n${violations.join("\n")}`
    : "No budget changes detected.";

  return {
    ok,
    changed,
    diffs,
    violations,
    message,
  };
}

export interface ComparisonBase {
  /** The revision passed to `git show`. */
  readonly rev: string;
  /** Its resolved sha, when git could resolve it. */
  readonly resolved?: string | undefined;
  /** Why this base and not another, printed so a reader can check it. */
  readonly reason: string;
}

/**
 * Which revision a run should compare perf/budgets.json against.
 *
 * This read `git show HEAD:perf/budgets.json`, which compares the WORKING TREE against
 * HEAD. In CI that is the one comparison guaranteed to find nothing: the runner checks
 * out the commit that contains the budget change, so HEAD already holds the new value,
 * the diff is empty, and the gate prints "No budget changes detected" for precisely the
 * commit it exists to stop. It caught only uncommitted edits, which is a local
 * convenience rather than a gate. The comment above it said "HEAD~1 or merge-base" - the
 * intent was recorded and the code did neither.
 *
 *   - a pull request compares against the merge base with the target branch, so a series
 *     of commits is judged as one change against where it will land;
 *   - a push to a branch compares against the previous commit;
 *   - locally, with no CI environment, HEAD is right and is labelled as such, because
 *     there the interesting change is the uncommitted one.
 */
export function resolveComparisonBase(
  rootDir: string,
  env: NodeJS.ProcessEnv,
  run: (cmd: string) => string = (cmd) =>
    execSync(cmd, { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(),
): ComparisonBase {
  const resolve = (rev: string): string | undefined => {
    try {
      return run(`git rev-parse ${rev}`);
    } catch {
      return undefined;
    }
  };

  const baseRef = env.GITHUB_BASE_REF;
  if (baseRef) {
    for (const candidate of [`origin/${baseRef}`, baseRef]) {
      try {
        const mergeBase = run(`git merge-base ${candidate} HEAD`);
        if (mergeBase) {
          return {
            rev: mergeBase,
            resolved: mergeBase,
            reason: `this is a pull request into ${baseRef}, so the base is the merge base with ${candidate}`,
          };
        }
      } catch {
        // Try the next spelling of the target branch before giving up on the PR case.
      }
    }
  }

  if (env.GITHUB_SHA || env.CI) {
    const parent = resolve("HEAD~1");
    if (parent) {
      return {
        rev: "HEAD~1",
        resolved: parent,
        reason: "this is a CI run on a branch push, so the base is the previous commit",
      };
    }
    return {
      rev: "HEAD",
      resolved: resolve("HEAD"),
      reason: "this is a CI run and HEAD has no parent, so there is nothing earlier to compare",
    };
  }

  return {
    rev: "HEAD",
    resolved: resolve("HEAD"),
    reason: "this is a local run, where the change under review is the uncommitted one",
  };
}

/**
 * Executes the budget change check using the repository git state.
 */
export function runGitBudgetChangeCheck(rootDir = ROOT): BudgetChangeCheckResult {
  const budgetsPath = join(rootDir, "perf/budgets.json");
  const measurementsDir = join(rootDir, "perf/measurements");
  const decisionsPath = join(rootDir, "docs/DECISIONS.md");

  if (!existsSync(budgetsPath)) {
    throw new Error(`Budgets file not found: ${budgetsPath}`);
  }
  const currentBudgetsRaw = readFileSync(budgetsPath, "utf8");

  const base = resolveComparisonBase(rootDir, process.env);
  let baseBudgetsRaw: string | null = null;
  try {
    baseBudgetsRaw = execSync(`git show ${base.rev}:perf/budgets.json`, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    baseBudgetsRaw = null;
  }
  // Printed, not merely computed: a reader has to be able to check WHAT was compared.
  // A gate that silently compares the wrong pair reports "no budget changes detected"
  // in exactly the case it exists to catch.
  console.log(
    `[budget-change-check] comparing perf/budgets.json at ${base.rev}${
      base.resolved ? ` (${base.resolved})` : ""
    } against the working tree — base chosen because ${base.reason}${
      baseBudgetsRaw === null ? " — base file unreadable, treating as initial creation" : ""
    }`,
  );

  const measurementFiles = existsSync(measurementsDir) ? readdirSync(measurementsDir) : [];
  const decisionsMdContent = existsSync(decisionsPath) ? readFileSync(decisionsPath, "utf8") : "";

  return checkBudgetChanges({
    baseBudgetsRaw,
    currentBudgetsRaw,
    measurementFiles,
    decisionsMdContent,
  });
}
