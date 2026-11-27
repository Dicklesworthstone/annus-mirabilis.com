import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEquationRecord } from "../../equations/record.ts";
import { checkedSupportFor } from "./checkedSupport.ts";
import { loadResultCards } from "./resultCards.ts";

const root = process.cwd();
const cards = loadResultCards(root, "mass-energy")?.cards;
const equations = ["light-energy-transform", "symmetric-sum", "rest-ledger", "moving-ledger"].map(
  (name) => {
    const path = join(root, "content/equations/mass-energy", `eq-model-me-${name}.json`);
    return parseEquationRecord(JSON.parse(readFileSync(path, "utf8")), path);
  },
);

function card(id: string) {
  const record = cards?.find((item) => item.id === id);
  if (!record) throw new Error(`Missing result card ${id}.`);
  return record;
}

function mutate(id: string, change: (json: string) => string) {
  expect(equations.some((eq) => eq.id === id)).toBe(true);
  return equations.map((eq) => {
    if (eq.id !== id) return eq;
    const json = JSON.stringify(eq);
    const mutated = change(json);
    expect(mutated).not.toBe(json);
    return parseEquationRecord(JSON.parse(mutated), "pulse mutation");
  });
}

describe("opposite-pulse support in the mass-energy paper", () => {
  test("both results expose the calculation and the premises each requires", () => {
    const emission = checkedSupportFor(card("me-symmetric-emission"), equations);
    const balances = checkedSupportFor(card("me-two-balances"), equations);
    expect(emission?.assumptions.map((a) => a.id)).toEqual(["light-energy-law", "symmetric-emission"]);
    expect(balances?.assumptions.map((a) => a.id)).toContain("conservation");
    expect(balances?.conclusion.equationId).toBe("eq-model-me-moving-ledger");
    expect(balances?.href).toBe("/lab/me-01/#two-ledgers-argument");
    expect(checkedSupportFor(card("me-light-energy-transformation"), equations)).toBeUndefined();
  });

  test("a correct total cannot conceal two wrong pulse energies", () => {
    const inputs = mutate("eq-model-me-symmetric-sum", (json) =>
      json.replaceAll(
        '"quantityId":"speedRatio"',
        '"quantityId":"speedRatio","scale":{"num":-1,"den":1}',
      ),
    );
    expect(() => checkedSupportFor(card("me-symmetric-emission"), inputs)).toThrow("the forward pulse");
  });

  test("a changed angular dependence is refused at the imported one-pulse law", () => {
    const inputs = mutate("eq-model-me-light-energy-transform", (json) =>
      json.replace('"name":"cos"', '"name":"sin"'),
    );
    expect(() => checkedSupportFor(card("me-symmetric-emission"), inputs)).toThrow("the imported one-pulse law");
  });

  test("body energies taken from different frames cannot supply the moving balance", () => {
    const inputs = mutate("eq-model-me-moving-ledger", (json) =>
      json.replace('"quantityId":"bodyEnergyMovingAfter"', '"quantityId":"bodyEnergyRestAfter"'),
    );
    expect(() => checkedSupportFor(card("me-two-balances"), inputs)).toThrow("the moving-frame loss");
    expect(checkedSupportFor(card("me-symmetric-emission"), inputs)?.kind).toBe("checked-proof");
  });
});
