import { describe, expect, test } from "bun:test";
import { BUDGET_IDS } from "../../src/testing/perfProfiles.ts";
import { loadCommittedBudgets, validateBudgetsFile } from "./budgets.ts";

describe("Performance Budgets Specification", () => {
  test("budgets.json contains exactly the budget ids in profiles.json", () => {
    const { budgets } = loadCommittedBudgets();
    const budgetKeys = Object.keys(budgets).sort();
    const expectedKeys = [...BUDGET_IDS].sort();

    expect(budgetKeys).toEqual(expectedKeys);
  });

  test("each budget entry has explicit units and non-empty decisionId", () => {
    const { budgets } = loadCommittedBudgets();
    for (const id of BUDGET_IDS) {
      const budget = budgets[id];
      expect(budget.id).toBe(id);
      expect(typeof budget.unit).toBe("string");
      expect(budget.unit.length).toBeGreaterThan(0);
      expect(budget.decisionId).toBe("D-2026-09-15-device-profiles");
      expect(budget.provisional).toBe(true);
      expect(budget.owningBead).toBeDefined();
    }
  });

  test("exact byte values for initial-route-js and reading-face-html", () => {
    const { budgets } = loadCommittedBudgets();
    // 200 KiB = 204,800 bytes
    expect(budgets["initial-route-js"].value).toBe(204_800);
    expect(budgets["initial-route-js"].unit).toBe("bytes");
    expect(budgets["initial-route-js"].displayUnit).toBe("KiB");

    // 250 kB = 250,000 bytes
    expect(budgets["reading-face-html"].value).toBe(250_000);
    expect(budgets["reading-face-html"].unit).toBe("bytes");
    expect(budgets["reading-face-html"].displayUnit).toBe("kB");
  });

  test("fails on missing required fields or unknown ids", () => {
    expect(() =>
      validateBudgetsFile({
        schemaVersion: 1,
        budgets: {} as never,
      }),
    ).toThrow("missing expected budget id");
  });
});
