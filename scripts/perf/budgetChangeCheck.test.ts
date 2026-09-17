import { describe, expect, test } from "bun:test";
import { checkBudgetChanges } from "./budgetChangeCheck.ts";

describe("Budget Change Governance Check", () => {
  const baseBudgets = {
    schemaVersion: 1,
    budgets: {
      "initial-route-js": {
        id: "initial-route-js",
        value: 204800,
        unit: "bytes",
        comparison: "<=",
        provisional: true,
        owningBead: "am-plat-perf-budgets-s3ww",
        decisionId: "D-2026-09-15-device-profiles",
      },
    },
  };

  const baseBudgetsRaw = JSON.stringify(baseBudgets);

  test("a changed budget without a measurement record fails", () => {
    const changedBudgets = {
      schemaVersion: 1,
      budgets: {
        "initial-route-js": {
          ...baseBudgets.budgets["initial-route-js"],
          value: 250000,
          decisionId: "D-2026-09-17-new-budget",
        },
      },
    };

    const result = checkBudgetChanges({
      baseBudgetsRaw,
      currentBudgetsRaw: JSON.stringify(changedBudgets),
      measurementFiles: [], // No measurement record!
      decisionsMdContent: "## D-2026-09-17-new-budget\nSome decision text",
    });

    expect(result.ok).toBe(false);
    expect(result.changed).toBe(true);
    expect(
      result.violations.some((v) =>
        v.includes("without a committed measurement record in perf/measurements/"),
      ),
    ).toBe(true);
  });

  test("a record without a decision entry fails", () => {
    const changedBudgets = {
      schemaVersion: 1,
      budgets: {
        "initial-route-js": {
          ...baseBudgets.budgets["initial-route-js"],
          value: 250000,
          decisionId: "D-2026-09-17-nonexistent-decision",
        },
      },
    };

    const result = checkBudgetChanges({
      baseBudgetsRaw,
      currentBudgetsRaw: JSON.stringify(changedBudgets),
      measurementFiles: ["2026-09-17-initial-route-js.json"],
      decisionsMdContent: "## D-2026-09-15-device-profiles\nOld decision only",
    });

    expect(result.ok).toBe(false);
    expect(result.changed).toBe(true);
    expect(
      result.violations.some((v) =>
        v.includes('references decision "D-2026-09-17-nonexistent-decision" which is missing'),
      ),
    ).toBe(true);
  });

  test("both measurement record and decision entry together pass", () => {
    const changedBudgets = {
      schemaVersion: 1,
      budgets: {
        "initial-route-js": {
          ...baseBudgets.budgets["initial-route-js"],
          value: 250000,
          decisionId: "D-2026-09-17-valid-decision",
        },
      },
    };

    const result = checkBudgetChanges({
      baseBudgetsRaw,
      currentBudgetsRaw: JSON.stringify(changedBudgets),
      measurementFiles: ["2026-09-17-initial-route-js.json"],
      decisionsMdContent: "## D-2026-09-17-valid-decision\nValid decision ratified.",
    });

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test("a loosened budget's message names both old and new values", () => {
    const changedBudgets = {
      schemaVersion: 1,
      budgets: {
        "initial-route-js": {
          ...baseBudgets.budgets["initial-route-js"],
          value: 250000, // Loosened from 204800 to 250000
          decisionId: "D-2026-09-17-valid-decision",
        },
      },
    };

    const result = checkBudgetChanges({
      baseBudgetsRaw,
      currentBudgetsRaw: JSON.stringify(changedBudgets),
      measurementFiles: ["2026-09-17-initial-route-js.json"],
      decisionsMdContent: "## D-2026-09-17-valid-decision\nValid decision.",
    });

    expect(result.diffs).toHaveLength(1);
    const diff = result.diffs[0];
    expect(diff).toBeDefined();
    if (!diff) {
      throw new Error("Expected diff to be defined");
    }
    expect(diff.isLoosened).toBe(true);
    expect(diff.message).toBeDefined();
    expect(diff.message).toContain("204800");
    expect(diff.message).toContain("250000");
    expect(diff.message).toContain("initial-route-js");
  });
});
