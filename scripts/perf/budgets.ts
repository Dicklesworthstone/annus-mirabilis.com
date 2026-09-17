import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUDGET_IDS, type BudgetId } from "../../src/testing/perfProfiles.ts";

export interface BudgetDefinition<T = unknown> {
  id: BudgetId;
  value: T;
  displayValue?: number;
  unit: string;
  displayUnit?: string;
  comparison: "<=" | "==" | ">=";
  provisional: boolean;
  owningBead: string;
  decisionId: string;
}

export interface BudgetsFile {
  schemaVersion: number;
  budgets: Record<BudgetId, BudgetDefinition>;
}

const here = dirname(fileURLToPath(import.meta.url));
export const BUDGETS_PATH = join(here, "../../perf/budgets.json");

export function loadCommittedBudgets(path = BUDGETS_PATH): BudgetsFile {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as BudgetsFile;
  validateBudgetsFile(parsed);
  return parsed;
}

export function validateBudgetsFile(file: BudgetsFile): void {
  if (!file || typeof file !== "object") {
    throw new Error("budgets file must be an object");
  }
  if (!file.budgets || typeof file.budgets !== "object") {
    throw new Error("budgets file must contain a 'budgets' map");
  }

  const fileBudgetIds = Object.keys(file.budgets) as BudgetId[];
  for (const expectedId of BUDGET_IDS) {
    if (!(expectedId in file.budgets)) {
      throw new Error(`missing expected budget id: ${expectedId}`);
    }
    const entry = file.budgets[expectedId];
    if (entry.id !== expectedId) {
      throw new Error(`entry key '${expectedId}' has mismatched id '${entry.id}'`);
    }
    if (!entry.unit || typeof entry.unit !== "string") {
      throw new Error(`budget '${expectedId}' must have an explicit unit`);
    }
    if (!entry.decisionId || typeof entry.decisionId !== "string") {
      throw new Error(`budget '${expectedId}' must name its decisionId in docs/DECISIONS.md`);
    }
    if (!entry.owningBead || typeof entry.owningBead !== "string") {
      throw new Error(`budget '${expectedId}' must name its owningBead`);
    }
    if (typeof entry.provisional !== "boolean") {
      throw new Error(`budget '${expectedId}' must specify provisional flag`);
    }
  }

  for (const fileId of fileBudgetIds) {
    if (!BUDGET_IDS.includes(fileId)) {
      throw new Error(`unexpected budget id '${fileId}' not present in perf/profiles.json catalog`);
    }
  }
}
