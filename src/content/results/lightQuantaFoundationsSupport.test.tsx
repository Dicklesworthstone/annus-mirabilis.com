import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  classicalCutoffAssumptions,
  classicalCutoffRecords,
  independentEntropyAssumptions,
  independentEntropyRecords,
} from "../../equations/derivations/lightQuantaFoundations.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { checkedLqFoundationsSupport } from "./lightQuantaFoundationsSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const root = process.cwd();
const loaded = loadResultCards(root, "light-quanta");
const fixtures = [
  {
    id: "lq-classical-difficulty",
    proofId: "lq-classical-cutoff",
    conclusion: "eq-model-lq-cutoff-total",
    href: "/papers/light-quanta/s1/#lq-classical-cutoff-derivation",
    records: classicalCutoffRecords.map((record) => parseEquationRecord(record, record.id)),
    assumptions: classicalCutoffAssumptions,
  },
  {
    id: "lq-boltzmann-principle",
    proofId: "lq-independent-entropy",
    conclusion: "eq-model-lq-configuration-entropy",
    href: "/papers/light-quanta/s5/#lq-independent-entropy-derivation",
    records: independentEntropyRecords.map((record) => parseEquationRecord(record, record.id)),
    assumptions: independentEntropyAssumptions,
  },
] as const;
function card(id: string) {
  const found = loaded?.cards.find((record) => record.id === id);
  if (!found) throw new Error(`The actual light-quanta result is absent: ${id}`);
  return found;
}

for (const fixture of fixtures) {
  test(`${fixture.id} reaches the checked derivation through the real Results card`, () => {
    expect(loaded?.problems).toEqual([]);
    const record = card(fixture.id);
    const support = checkedSupportFor(record, fixture.records);
    expect(support?.proofId).toBe(fixture.proofId);
    expect(support?.href).toBe(fixture.href);
    expect(support?.conclusion.equationId).toBe(fixture.conclusion);
    expect(support?.scope).toContain("remain premises");
    for (const premise of fixture.assumptions) expect(support?.assumptions).toContainEqual(premise);
    const passages = new Map(
      record.arguments.map((id) => [
        id,
        JSON.parse(
          readFileSync(join(root, "content/arguments/light-quanta", `${id}.json`), "utf8"),
        ),
      ]),
    );
    const projected = toCard(root, record, passages, undefined, undefined, fixture.records);
    const html = renderToStaticMarkup(<ResultCard card={projected} />);
    expect(html).toContain(`href="${fixture.href}"`);
    expect(html).toContain("Why should I believe this step?");
  });

  test(`${fixture.id} checks every supplied equation instead of crediting its imported default`, () => {
    const record = card(fixture.id);
    for (const equation of fixture.records) {
      if (equation.tree.kind !== "relation")
        throw new Error("The supplied equation must be a relation.");
      const corrupted: EquationRecord = {
        ...equation,
        tree: { ...equation.tree, right: { kind: "negate", argument: equation.tree.right } },
      };
      expect(() =>
        checkedSupportFor(
          record,
          fixture.records.map((item) => (item.id === equation.id ? corrupted : item)),
        ),
      ).toThrow(ResultCardsError);
    }
  });
}

test("result-support-lq-foundations-not-checked rejects missing, duplicate and altered physical premises", () => {
  for (const fixture of fixtures) {
    const record = card(fixture.id);
    expect(checkedSupportFor(record, fixture.records)).toBeDefined();
    for (const equation of fixture.records) {
      expect(() =>
        checkedSupportFor(
          record,
          fixture.records.filter((item) => item.id !== equation.id),
        ),
      ).toThrow(ResultCardsError);
      expect(() => checkedSupportFor(record, [...fixture.records, equation])).toThrow(
        ResultCardsError,
      );
      for (const change of [
        { assumptions: ["The points may be correlated and temperature may depend on frequency."] },
        { argument: "arg-lq-entropy-correspondence" },
        { unitSystem: "gaussian-cgs" as const },
      ])
        expect(() =>
          checkedSupportFor(
            record,
            fixture.records.map((item) =>
              item.id === equation.id ? { ...item, ...change } : item,
            ),
          ),
        ).toThrow(ResultCardsError);
    }
  }
});

test("result-support-lq-foundations-not-checked cannot attach the proof to an unrelated conclusion", () => {
  const fixture = fixtures[0];
  const record = card(fixture.id);
  if (record.support.kind !== "checked-proof") throw new Error("Missing checked declaration.");
  const wrongConclusion = fixture.records[0];
  if (!wrongConclusion) throw new Error("The test needs the admitted density record.");
  try {
    checkedLqFoundationsSupport(
      record.id,
      { ...record.support, conclusion: wrongConclusion.id },
      wrongConclusion,
      fixture.records,
    );
    throw new Error("An admitted density cannot be credited as the derived integral.");
  } catch (error) {
    expect(error).toBeInstanceOf(ResultCardsError);
    if (error instanceof ResultCardsError)
      expect(error.rule).toBe("result-support-lq-foundations-not-checked");
  }
});

test("the new support preserves the unsolved Planck and entropy-temperature steps", () => {
  for (const id of ["lq-planck-constants", "lq-entropy-temperature"])
    expect(card(id).support.kind).toBe("no-checked-proof");
  expect(checkedSupportFor(card("lq-classical-difficulty"), fixtures[0].records)?.scope).toContain(
    "fixed positive temperature",
  );
  expect(checkedSupportFor(card("lq-boltzmann-principle"), fixtures[1].records)?.scope).toContain(
    "0 < f ≤ 1",
  );
});
