/**
 * The printed check a result card names (printedChecks.ts): each refusal by its rule, from a fixture
 * root that reaches exactly that site, and the join itself on the real scenario, whose owner gives
 * both values and the comparison. The fixture roots are temporary directories.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MASS_ENERGY_PRINTED_FACTOR_SCENARIO,
  PRINTED_FACTOR_WORDING,
} from "../../physics/reference/massEnergy.ts";
import { printedCheckFor, ResultCardsError } from "./printedChecks.ts";

function rootWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "result-cards-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const scenario = (value: number, unit: string) =>
  [
    "inputs:",
    "  emittedEnergy:",
    `    value: ${value}`,
    `    unit: ${unit}`,
    "expected:",
    "  outputs:",
    '    - printedValue: "a fixture value"',
    "",
  ].join("\n");

const scenarioPath = `content/scenarios/${MASS_ENERGY_PRINTED_FACTOR_SCENARIO}.yaml`;

function ruleOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ResultCardsError) return error.rule;
    throw error;
  }
  return "no refusal";
}

describe("the printed check refuses a layer it cannot own", () => {
  test("a scenario with no reproducer here: printed-check-unowned", () => {
    expect(ruleOf(() => printedCheckFor(rootWith({}), "a-scenario-nobody-owns"))).toBe(
      "printed-check-unowned",
    );
  });

  test("a scenario that states no energy in joules: printed-check-scenario-shape", () => {
    const root = rootWith({ [scenarioPath]: scenario(1e7, "erg") });
    expect(ruleOf(() => printedCheckFor(root, MASS_ENERGY_PRINTED_FACTOR_SCENARIO))).toBe(
      "printed-check-scenario-shape",
    );
  });

  test("an energy the owner refuses: printed-check-refused", () => {
    const root = rootWith({ [scenarioPath]: scenario(-1, "J") });
    expect(ruleOf(() => printedCheckFor(root, MASS_ENERGY_PRINTED_FACTOR_SCENARIO))).toBe(
      "printed-check-refused",
    );
  });

  test("the control: a well-formed scenario is reproduced, not refused", () => {
    const root = rootWith({ [scenarioPath]: scenario(1, "J") });
    expect(printedCheckFor(root, MASS_ENERGY_PRINTED_FACTOR_SCENARIO).rows.length).toBe(2);
  });
});

describe("the printed check on the real scenario", () => {
  test("the owner gives the printed and the modern value, each with its constant set, and the comparison", () => {
    const check = printedCheckFor(process.cwd(), MASS_ENERGY_PRINTED_FACTOR_SCENARIO);
    expect(check.rows.map((r) => [r.constantSetId, r.reproducedText])).toEqual([
      ["einstein-1905-mass-energy-printed", "1 g"],
      ["modern-si-2019", "1.0013851 g"],
    ]);
    expect(check.rows[0]?.printedValue).toBe("1 g");
    expect(check.comparison).toBe(PRINTED_FACTOR_WORDING);
  });
});
