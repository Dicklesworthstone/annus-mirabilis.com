/**
 * Each refusal in fromRecords.ts, by its rule, from a fixture that reaches exactly that site. A card
 * with a problem fails the page rather than rendering half-resolved, so each of these is the page
 * refusing to show a wrong or unowned layer. The fixture roots are temporary directories.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResultCardRecord } from "../../../content/results/resultCards.ts";
import { MASS_ENERGY_PRINTED_FACTOR_SCENARIO } from "../../../physics/reference/massEnergy.ts";
import { printedCheckFor, ResultCardsError, resultCardsFor, toCard } from "./fromRecords.ts";

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

async function ruleOf(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ResultCardsError) return error.rule;
    throw error;
  }
  return "no refusal";
}

describe("fromRecords refuses a card layer it cannot own", () => {
  test("a scenario with no reproducer here: printed-check-unowned", async () => {
    expect(await ruleOf(() => printedCheckFor(rootWith({}), "a-scenario-nobody-owns"))).toBe(
      "printed-check-unowned",
    );
  });

  test("a scenario that states no energy in joules: printed-check-scenario-shape", async () => {
    const root = rootWith({ [scenarioPath]: scenario(1e7, "erg") });
    expect(await ruleOf(() => printedCheckFor(root, MASS_ENERGY_PRINTED_FACTOR_SCENARIO))).toBe(
      "printed-check-scenario-shape",
    );
  });

  test("an energy the owner refuses: printed-check-refused", async () => {
    const root = rootWith({ [scenarioPath]: scenario(-1, "J") });
    expect(await ruleOf(() => printedCheckFor(root, MASS_ENERGY_PRINTED_FACTOR_SCENARIO))).toBe(
      "printed-check-refused",
    );
  });

  test("the control: a well-formed scenario is reproduced, not refused", async () => {
    const root = rootWith({ [scenarioPath]: scenario(1, "J") });
    const check = printedCheckFor(root, MASS_ENERGY_PRINTED_FACTOR_SCENARIO);
    expect(check.checks.length).toBe(2);
  });

  test("a card naming a passage the paper does not have: result-passage-missing", async () => {
    const record = {
      id: "fixture-card",
      paper: "mass-energy",
      section: "s0",
      title: "A fixture card",
      printed: [],
      qualifications: [],
      equations: [],
      oneSentence: "One sentence.",
      decoder: [],
      probes: [],
      misconceptionIds: [],
      meanings: {},
      selectionReason: "A fixture.",
      arguments: ["arg-not-a-passage"],
    } as unknown as ResultCardRecord;
    expect(await ruleOf(() => toCard(rootWith({}), record, new Map()))).toBe(
      "result-passage-missing",
    );
  });

  test("a results file whose cards do not resolve: result-cards-unresolved", async () => {
    const root = rootWith({ "content/results/mass-energy.yaml": "cards:\n  - id: Not A Slug\n" });
    expect(await ruleOf(() => resultCardsFor("mass-energy", root))).toBe("result-cards-unresolved");
  });
});
