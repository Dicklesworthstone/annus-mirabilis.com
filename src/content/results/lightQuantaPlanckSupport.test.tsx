import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  lqPlanckAssumptions,
  lqPlanckRecords,
} from "../../equations/derivations/lightQuantaPlanck.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import {
  buildLqPlanckDerivationPayload,
  checkedLqPlanckSupport,
} from "./lightQuantaPlanckSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const records = lqPlanckRecords.map((record) => parseEquationRecord(record, record.id));
const loaded = loadResultCards(process.cwd(), "light-quanta");
function card() {
  const found = loaded?.cards.find((record) => record.id === "lq-planck-constants");
  if (!found) throw new Error("The real Planck-constant result is required.");
  return found;
}
function refused(run: () => unknown) {
  try {
    run();
    throw new Error("Expected the changed Planck proof to be refused.");
  } catch (error) {
    expect(error).toBeInstanceOf(ResultCardsError);
    if (error instanceof ResultCardsError)
      expect(error.rule).toBe("result-support-lq-planck-not-checked");
  }
}
function direct(source: readonly EquationRecord[]) {
  const result = card();
  const conclusion = records.find((record) => record.id === "eq-model-lq-avogadro-from-spectrum");
  if (result.support.kind !== "checked-proof" || !conclusion)
    throw new Error("The real inference and proof declaration are required.");
  return checkedLqPlanckSupport(result.id, result.support, conclusion, source);
}

test("the real Planck result links the checked analytic limit and inference with its physical premises", () => {
  expect(loaded?.problems).toEqual([]);
  const result = card();
  const support = checkedSupportFor(result, records);
  expect(support?.proofId).toBe("lq-planck-molecular-number");
  expect(support?.conclusion.equationId).toBe("eq-model-lq-avogadro-from-spectrum");
  expect(support?.href).toBe("/papers/light-quanta/s2/#lq-planck-constants-derivation");
  expect(support?.assumptions).toEqual(lqPlanckAssumptions);
  expect(support?.scope).toContain("remain premises");
  const passages = new Map(
    result.arguments.map((id) => [
      id,
      JSON.parse(readFileSync(`content/arguments/light-quanta/${id}.json`, "utf8")),
    ]),
  );
  const html = renderToStaticMarkup(
    <ResultCard card={toCard(process.cwd(), result, passages, undefined, undefined, records)} />,
  );
  expect(html).toContain('href="/papers/light-quanta/s2/#lq-planck-constants-derivation"');
  expect(html).toContain("Why should I believe this step?");
});

test("result-support-lq-planck-not-checked refuses each altered actual equation, including the low-frequency approximation", () => {
  for (const original of records) {
    if (original.tree.kind !== "relation") throw new Error("The actual input must be a relation.");
    const changed: EquationRecord = {
      ...original,
      tree: {
        ...original.tree,
        right: { kind: "product", args: [{ kind: "number", value: "2" }, original.tree.right] },
      },
    };
    refused(() =>
      checkedSupportFor(
        card(),
        records.map((item) => (item.id === changed.id ? changed : item)),
      ),
    );
  }
});

test("result-support-lq-planck-not-checked requires every supplied record exactly once with its premise and unit contract", () => {
  for (const original of records) {
    refused(() => direct(records.filter((item) => item.id !== original.id)));
    refused(() => direct([...records, original]));
    for (const change of [
      { assumptions: ["Use the modern defined Avogadro constant as an independent measurement."] },
      { unitSystem: "gaussian-cgs" as const },
      { argument: "arg-lq-fixed-band-volume" },
    ])
      refused(() =>
        direct(records.map((item) => (item.id === original.id ? { ...item, ...change } : item))),
      );
  }
});

test("result-support-lq-planck-not-checked cannot attach the proof to the starting spectrum", () => {
  const result = card();
  if (result.support.kind !== "checked-proof")
    throw new Error("The real card must declare its proof.");
  const spectrum = records[0];
  if (!spectrum) throw new Error("The spectrum fixture is required.");
  refused(() =>
    checkedLqPlanckSupport(
      result.id,
      { ...result.support, conclusion: spectrum.id },
      spectrum,
      records,
    ),
  );
});

test("the server payload keeps historical fitted, editorial and modern numbers separate", () => {
  const payload = buildLqPlanckDerivationPayload();
  expect(payload.limit).toEqual({
    value: "1",
    quotientAtZero: "not-applicable",
    coefficients: ["1", "1/2", "1/6"],
  });
  const worked = payload.worked;
  expect(worked.alphaAsPrinted).toBe("6,10 · 10^-56");
  expect(worked.inputs.find((input) => input.quantityId === "wienConstantAlpha")).toMatchObject({
    value: "6.10e-57",
    unit: "erg s4 / cm3",
  });
  expect(worked.inputs.find((input) => input.quantityId === "molarGasConstant")).toMatchObject({
    value: "8.31e7",
    unit: "erg/(mol K)",
  });
  expect(worked.inputs.find((input) => input.quantityId === "speedOfLight")).toMatchObject({
    value: "3e10",
    unit: "cm/s",
  });
  expect(
    worked.inputs.some(
      (input) =>
        input.quantityId === "avogadroConstant" || input.quantityId === "boltzmannConstant",
    ),
  ).toBe(false);
  expect(Number(worked.calculatedN)).toBeCloseTo(6.170486e23, -17);
  expect(Number(worked.printedN)).toBe(6.17e23);
  expect(Number(worked.printedExponentN)).toBeCloseTo(6.170486e22, -16);
  expect(Number(worked.modernN)).toBe(6.02214076e23);
  expect(JSON.stringify(payload)).not.toContain("rows");
});
