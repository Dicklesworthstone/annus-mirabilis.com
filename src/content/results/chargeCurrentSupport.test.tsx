import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import densityRecord from "../../../content/equations/special-relativity/eq-model-sr-charge-density.json";
import currentRecord from "../../../content/equations/special-relativity/eq-model-sr-current-density.json";
import { srChargeCurrentAssumptions } from "../../equations/derivations/srChargeCurrent.ts";
import { parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const equations = [densityRecord, currentRecord].map((record) => parseEquationRecord(record, record.id));
const loaded = loadResultCards(process.cwd(), "special-relativity");
const card = loaded?.cards.find((record) => record.id === "sr-convection-current");

test("the actual convection-current result links to the conditional species and additivity proof", () => {
  expect(loaded?.problems).toEqual([]);
  expect(card).toBeDefined();
  if (!card) throw new Error("The actual convection-current result card is absent.");
  const support = checkedSupportFor(card, equations);
  expect(support?.proofId).toBe("sr-charge-current");
  expect(support?.conclusion.equationId).toBe(densityRecord.id);
  for (const assumption of srChargeCurrentAssumptions)
    expect(support?.assumptions.some((item) => item.id === assumption.id)).toBe(true);
  const passages = new Map(card.arguments.map((id) => [
    id,
    JSON.parse(readFileSync(join(process.cwd(), "content/arguments/special-relativity", id + ".json"), "utf8")),
  ]));
  const projected = toCard(process.cwd(), card, passages, undefined, undefined, equations);
  expect(projected.support?.kind).toBe("checked-proof");
  const html = renderToStaticMarkup(<ResultCard card={projected} />);
  expect(html).toContain("Why should I believe this step?");
  expect(html).toContain('href="/papers/special-relativity/s9/#sr-charge-current-derivation"');
  expect(html).toContain("The density and velocity laws already obtained in §9");
  expect(html).toContain("A neutral mixture can carry current");
  expect(html).toContain("continuity");
  expect(html).toContain("Maxwell");
});

test("missing or altered density/current equations and their premises cannot earn support", () => {
  if (!card) throw new Error("The actual convection-current result card is absent.");
  expect(checkedSupportFor(card, equations)?.proofId).toBe("sr-charge-current");
  for (const record of equations) {
    expect(() => checkedSupportFor(card, equations.filter((item) => item.id !== record.id)))
      .toThrow(ResultCardsError);
    expect(() => checkedSupportFor(card, equations.map((item) => item.id === record.id
      ? { ...item, assumptions: [...item.assumptions, "A changed physical premise."] }
      : item))).toThrow(ResultCardsError);
    if (record.tree.kind !== "relation") throw new Error("Charge/current records must be relations.");
    const wrongLaw = {
      ...record,
      tree: { ...record.tree, right: { kind: "number" as const, value: "0" } },
    };
    expect(() => checkedSupportFor(card, equations.map((item) => item.id === record.id ? wrongLaw : item)))
      .toThrow(ResultCardsError);
  }
});
