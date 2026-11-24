import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  fluorescenceClosingAssumptions,
  fluorescenceClosingRecords,
  ionizationClosingAssumptions,
  ionizationClosingRecords,
} from "../../equations/derivations/lightQuantaClosingProof.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { LightQuantaClosingDerivation } from "../../reader/LightQuantaClosingDerivation.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards, type ResultCardRecord } from "./resultCards.ts";

const equations = [...fluorescenceClosingRecords, ...ionizationClosingRecords].map((record) =>
  parseEquationRecord(record, record.id),
);
const loaded = loadResultCards(process.cwd(), "light-quanta");
const cases = [
  {
    cardId: "lq-stokes-rule",
    proofId: "lq-fluorescence-energy",
    records: fluorescenceClosingRecords,
    assumptions: fluorescenceClosingAssumptions,
    conclusion: "eq-model-lq-fluorescence-bound",
    section: "s7",
    anchor: "lq-fluorescence-derivation",
  },
  {
    cardId: "lq-ionization",
    proofId: "lq-ionization-energy-count",
    records: ionizationClosingRecords,
    assumptions: ionizationClosingAssumptions,
    conclusion: "eq-model-lq-ion-count-bound",
    section: "s9",
    anchor: "lq-ionization-derivation",
  },
] as const;

function card(id: string): ResultCardRecord {
  const found = loaded?.cards.find((record) => record.id === id);
  if (!found) throw new Error(`The actual light-quantum result ${id} is absent.`);
  return found;
}

function project(id: string, source: readonly EquationRecord[] = equations) {
  const record = card(id);
  const passages = new Map(
    record.arguments.map((argument) => [
      argument,
      JSON.parse(
        readFileSync(
          join(process.cwd(), "content/arguments/light-quanta", `${argument}.json`),
          "utf8",
        ),
      ),
    ]),
  );
  return toCard(process.cwd(), record, passages, undefined, undefined, source);
}

function refusal(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ResultCardsError) return error.rule;
    throw error;
  }
  throw new Error("Expected the closing light-quantum result support to be refused.");
}

function replacing(changed: EquationRecord): readonly EquationRecord[] {
  return equations.map((record) => (record.id === changed.id ? changed : record));
}

for (const fixture of cases) {
  test(`${fixture.cardId} projects its checked bound, physical premises and existing reader destination`, () => {
    expect(loaded?.problems).toEqual([]);
    const projected = project(fixture.cardId);
    const support = projected.support;
    if (support?.kind !== "checked-proof") throw new Error("The checked support is absent.");
    expect(support.proofId).toBe(fixture.proofId);
    expect(support.conclusion.equationId).toBe(fixture.conclusion);
    expect(support.assumptions).toEqual(fixture.assumptions);
    const href = `/papers/light-quanta/${fixture.section}/#${fixture.anchor}`;
    expect(support.href).toBe(href);
    const html = renderToStaticMarkup(<ResultCard card={projected} />);
    expect(html).toContain("Why should I believe this step?");
    expect(html).toContain(`href="${href}"`);
    for (const assumption of fixture.assumptions) expect(html).toContain(assumption.label);
    const destination = renderToStaticMarkup(
      <LightQuantaClosingDerivation section={fixture.section} activeDetail="2" />,
    );
    expect(destination).toContain(`id="${fixture.anchor}"`);
    expect(destination).toContain("Which premises are being admitted?");
    expect(destination).toContain('data-historical-status="pedagogical-reconstruction"');
    if (fixture.section === "s7") {
      expect(support.scope).toContain("nonnegative energy in other channels");
      expect(support.scope).toContain("predicts neither the emission spectrum nor the yield");
      expect(destination).toContain("The brightness calculation additionally");
    } else {
      expect(support.scope).toContain("necessary energy threshold");
      expect(support.scope).toContain("additionally requires full yield");
      expect(support.scope).toContain("enough energy does not establish that ionization occurs");
      expect(destination).toContain("count equality requires yield one");
    }
  });

  test(`result-support-closing-quanta-not-checked refuses missing, repeated or altered ${fixture.cardId} premises`, () => {
    expect(project(fixture.cardId).support?.kind).toBe("checked-proof");
    for (const expected of fixture.records) {
      const actual = equations.find((record) => record.id === expected.id);
      if (!actual) throw new Error("The actual canonical equation is missing.");
      expect(
        refusal(() =>
          project(
            fixture.cardId,
            equations.filter((record) => record.id !== actual.id),
          ),
        ),
      ).toBe(
        actual.id === fixture.conclusion
          ? "result-support-conclusion-mismatch"
          : "result-support-closing-quanta-not-checked",
      );
      expect(refusal(() => project(fixture.cardId, [...equations, actual]))).toBe(
        "result-support-closing-quanta-not-checked",
      );
      for (const changed of [
        { ...actual, assumptions: actual.assumptions.slice(1) },
        { ...actual, notation: "printed" as EquationRecord["notation"] },
        { ...actual, unitSystem: "cgs" as EquationRecord["unitSystem"] },
      ]) {
        expect(refusal(() => project(fixture.cardId, replacing(changed)))).toBe(
          "result-support-closing-quanta-not-checked",
        );
      }
    }
  });

  test(`result-support-closing-quanta-not-checked checks every supplied ${fixture.cardId} tree`, () => {
    expect(project(fixture.cardId).support?.kind).toBe("checked-proof");
    for (const expected of fixture.records) {
      const actual = equations.find((record) => record.id === expected.id);
      if (actual?.tree.kind !== "relation")
        throw new Error("The canonical bound must be a relation.");
      for (const tree of [
        { ...actual.tree, operator: "=" as const },
        { ...actual.tree, right: { kind: "negate" as const, argument: actual.tree.right } },
        { ...actual.tree, left: actual.tree.right, right: actual.tree.left },
      ]) {
        const changed = parseEquationRecord({ ...actual, tree }, `changed ${actual.id}`);
        expect(refusal(() => project(fixture.cardId, replacing(changed)))).toBe(
          "result-support-closing-quanta-not-checked",
        );
      }
    }
  });
}

test("result-support-closing-quanta-not-checked cannot exchange the Stokes and ion-count owners", () => {
  for (const fixture of cases) {
    const actual = card(fixture.cardId);
    if (actual.support.kind !== "checked-proof") throw new Error("Missing checked declaration.");
    const proofId =
      fixture.section === "s7" ? "lq-ionization-energy-count" : "lq-fluorescence-energy";
    const changed: ResultCardRecord = { ...actual, support: { ...actual.support, proofId } };
    expect(refusal(() => checkedSupportFor(changed, equations))).toBe(
      "result-support-closing-quanta-not-checked",
    );
  }
});

test("an ion-count result cannot borrow a threshold from a different paper or argument", () => {
  const threshold = equations.find((record) => record.id === "eq-model-lq-ionization-threshold");
  if (!threshold) throw new Error("Missing primary-event threshold.");
  for (const changed of [
    { ...threshold, paper: "brownian-motion" as const },
    { ...threshold, argument: "arg-lq-fluorescence-budget" },
  ]) {
    expect(refusal(() => project("lq-ionization", replacing(changed)))).toBe(
      "result-support-closing-quanta-not-checked",
    );
  }
});
