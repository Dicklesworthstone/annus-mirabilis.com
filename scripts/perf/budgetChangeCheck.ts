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
      const hasMeasurement = input.measurementFiles?.some(
        (f) => f.includes(`-${id}.json`) || f.endsWith(`${id}.json`),
      );
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

  let baseBudgetsRaw: string | null = null;
  try {
    // Try git diff base against HEAD~1 or merge-base
    baseBudgetsRaw = execSync("git show HEAD:perf/budgets.json 2>/dev/null", {
      cwd: rootDir,
      encoding: "utf8",
    });
  } catch {
    baseBudgetsRaw = null;
  }

  const measurementFiles = existsSync(measurementsDir) ? readdirSync(measurementsDir) : [];
  const decisionsMdContent = existsSync(decisionsPath) ? readFileSync(decisionsPath, "utf8") : "";

  return checkBudgetChanges({
    baseBudgetsRaw,
    currentBudgetsRaw,
    measurementFiles,
    decisionsMdContent,
  });
}
