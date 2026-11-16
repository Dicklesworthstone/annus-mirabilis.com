import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import maximumRecord from "../../../content/equations/light-quanta/eq-model-lq-photoelectric-maximum.json";
import stoppingRecord from "../../../content/equations/light-quanta/eq-model-lq-stopping-energy.json";
import { photoelectricPremises } from "../../equations/derivations/lightQuantaPhotoelectric.ts";
import { parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const equations = [maximumRecord, stoppingRecord].map((record) =>
  parseEquationRecord(record, record.id),
);
const loaded = loadResultCards(process.cwd(), "light-quanta");
const card = loaded?.cards.find((record) => record.id === "lq-photoelectric-energy");

test("the actual photoelectric result projects its checked argument and every physical premise", () => {
  expect(loaded?.problems).toEqual([]);
  expect(card).toBeDefined();
  if (!card) throw new Error("The actual photoelectric result card is absent.");
  const passages = new Map(
    card.arguments.map((id) => [
      id,
      JSON.parse(
        readFileSync(join(process.cwd(), "content/arguments/light-quanta", `${id}.json`), "utf8"),
      ),
    ]),
  );
  const support = toCard(process.cwd(), card, passages, undefined, undefined, equations).support;
  expect(support?.kind).toBe("checked-proof");
  if (support?.kind !== "checked-proof")
    throw new Error("The checked photoelectric support is absent.");
  expect(support.proofId).toBe("lq-photoelectric-energy");
  expect(support.conclusion.equationId).toBe(maximumRecord.id);
  expect(support.href).toBe("/papers/light-quanta/s8/#lq-photoelectric-derivation");
  for (const premise of photoelectricPremises)
    expect(support.assumptions.map((item) => item.id)).toContain(premise.ref);
  const explanations = support.assumptions.map((item) => item.explanation).join(" ");
  expect(explanations).toContain("Below threshold");
  expect(explanations).toContain("without an additional energy loss");
  expect(explanations).toContain("positive charge magnitude");
});

test("a changed energy law, sign convention, or omitted premise cannot retain the result badge", () => {
  if (!card) throw new Error("The actual photoelectric result card is absent.");
  expect(checkedSupportFor(card, equations)?.proofId).toBe("lq-photoelectric-energy");
  for (const record of equations) {
    expect(() =>
      checkedSupportFor(
        card,
        equations.filter((item) => item.id !== record.id),
      ),
    ).toThrow(ResultCardsError);
    for (const assumption of record.assumptions) {
      expect(() =>
        checkedSupportFor(
          card,
          equations.map((item) =>
            item.id === record.id
              ? { ...item, assumptions: item.assumptions.filter((text) => text !== assumption) }
              : item,
          ),
        ),
      ).toThrow(ResultCardsError);
    }
    if (record.tree.kind !== "relation")
      throw new Error("A canonical energy law must be a relation.");
    const wrongLaw = {
      ...record,
      tree: { ...record.tree, right: { kind: "number" as const, value: "0" } },
    };
    expect(() =>
      checkedSupportFor(
        card,
        equations.map((item) => (item.id === record.id ? wrongLaw : item)),
      ),
    ).toThrow(ResultCardsError);
  }
});
