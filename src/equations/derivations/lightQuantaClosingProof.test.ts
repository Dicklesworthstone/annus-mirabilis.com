import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { closingQuantaExpressions as e } from "./lightQuantaClosing.ts";
import {
  type ClosingQuantaCondition,
  type FluorescenceClosingInput,
  fluorescenceClosingInput as fluorescence,
  fluorescenceClosingCheckRows,
  type IonizationClosingInput,
  ionizationClosingInput as ionization,
  ionizationClosingCheckRows,
  verifyFluorescenceClosing,
  verifyIonizationClosing,
} from "./lightQuantaClosingProof.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
const symbol = (quantityId: string): Expression => ({
  kind: "symbol",
  termId: quantityId,
  quantityId,
});
const relation = (
  left: Expression,
  right: Expression,
  operator: Relation["operator"] = "=",
): Relation => ({
  kind: "relation",
  operator,
  left,
  right,
});
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const zero: Expression = { kind: "number", value: "0" };
const one: Expression = { kind: "number", value: "1" };

test("the actual closing equations satisfy exact energy-slack and ion-count certificates", () => {
  for (const [report, required] of [
    [verifyFluorescenceClosing(), fluorescenceClosingCheckRows],
    [verifyIonizationClosing(), ionizationClosingCheckRows],
  ] as const) {
    assert.equal(report.passed, true, report.reason);
    assert.ok(report.rows.length > 0);
    for (const id of required)
      assert.equal(report.rows.find((row) => row.id === id)?.passed, true, id);
  }
});

test("canonical quantity identities, not occurrence ids, bind the actual conclusion records", () => {
  const occurrence = (node: Extract<Expression, { kind: "symbol" }>) =>
    `other-occurrence-${node.quantityId}`;
  assert.equal(
    verifyFluorescenceClosing({
      ...fluorescence,
      energyBound: projectDerivationSymbols(fluorescence.energyBound, occurrence),
    }).passed,
    true,
  );
  assert.equal(
    verifyIonizationClosing({
      ...ionization,
      threshold: projectDerivationSymbols(ionization.threshold, occurrence),
      countBound: projectDerivationSymbols(ionization.countBound, occurrence),
    }).passed,
    true,
  );
});

test("the fluorescence upper bound cannot become equality or its reverse", () => {
  for (const operator of ["=", "ge"] as const) {
    const report = verifyFluorescenceClosing({
      ...fluorescence,
      energyBound: { ...e.fluorescenceBound, operator },
    });
    assert.equal(report.passed, false);
    assert.equal(report.rows.find((row) => row.id === "fluorescence-energy-slack")?.passed, false);
  }
});

test("same-dimension frequency substitutions and a changed elementary budget are rejected", () => {
  const changedBudget = substituteNode(e.fluorescenceBudget, "otherChannelEnergy", {
    kind: "negate",
    argument: symbol("otherChannelEnergy"),
  });
  const reversedBound = relation(e.fluorescenceBound.right, e.fluorescenceBound.left, "le");
  assert.equal(verifyFluorescenceClosing({ ...fluorescence, budget: changedBudget }).passed, false);
  assert.equal(
    verifyFluorescenceClosing({ ...fluorescence, energyBound: reversedBound }).passed,
    false,
  );
  assert.equal(
    verifyFluorescenceClosing({
      ...fluorescence,
      frequencyBound: relation(symbol("incidentFrequency"), symbol("emittedFrequency"), "le"),
    }).passed,
    false,
  );
});

test("negative other-channel energy cannot be silently admitted, and h must be strictly positive", () => {
  assert.equal(
    verifyFluorescenceClosing({
      ...fluorescence,
      nonnegativeRemainder: relation(symbol("otherChannelEnergy"), zero, "le"),
    }).passed,
    false,
  );
  for (const operator of ["ge", "le", "="] as const) {
    const conditions: readonly ClosingQuantaCondition[] = fluorescence.conditions.map(
      (condition, index): ClosingQuantaCondition =>
        index === 0 ? relation(symbol("planckConstant"), zero, operator) : condition,
    );
    assert.equal(verifyFluorescenceClosing({ ...fluorescence, conditions }).passed, false);
  }
  assert.equal(
    verifyFluorescenceClosing({ ...fluorescence, conditions: fluorescence.conditions.slice(1) })
      .passed,
    false,
  );
  const wrongPositiveQuantity = fluorescence.conditions.map((condition, index) =>
    index === 0 ? { kind: "positive" as const, expression: symbol("frequency") } : condition,
  );
  assert.equal(
    verifyFluorescenceClosing({ ...fluorescence, conditions: wrongPositiveQuantity }).passed,
    false,
  );
  const duplicatePositiveQuantity = fluorescence.conditions.map((condition, index) =>
    index === 1 ? { kind: "positive" as const, expression: symbol("planckConstant") } : condition,
  );
  assert.equal(
    verifyFluorescenceClosing({ ...fluorescence, conditions: duplicatePositiveQuantity }).passed,
    false,
  );
});

test("brightness uses the outgoing quantum energy and the independent yield, not only absorbed power", () => {
  for (const right of [
    substituteNode(e.emittedPower.right, "emittedFrequency", symbol("incidentFrequency")),
    substituteNode(e.emittedPower.right, "quantumYield", one),
    product(e.emittedPower.right, { kind: "number", value: "2" }),
  ]) {
    const report = verifyFluorescenceClosing({
      ...fluorescence,
      emittedPower: { ...e.emittedPower, right },
    });
    assert.equal(report.rows.find((row) => row.id === "fluorescence-rate-account")?.passed, false);
  }
  const reordered = relation(
    e.emittedPower.left,
    product(
      symbol("absorbedPower"),
      quotient(symbol("emittedFrequency"), symbol("incidentFrequency")),
      symbol("quantumYield"),
    ),
  );
  assert.equal(
    verifyFluorescenceClosing({ ...fluorescence, emittedPower: reordered }).passed,
    true,
  );
});

test("the exact rate check refuses a newly introduced denominator even when it cancels", () => {
  const z = symbol("unadmittedQuantity");
  const report = verifyFluorescenceClosing({
    ...fluorescence,
    emittedPower: { ...e.emittedPower, right: product(e.emittedPower.right, quotient(z, z)) },
  });
  assert.equal(report.passed, false);
  assert.equal(report.rows.find((row) => row.id === "fluorescence-rate-account")?.passed, false);
});

test("the ionization threshold keeps its direction and permits zero excess", () => {
  for (const operator of ["=", "le"] as const) {
    const report = verifyIonizationClosing({
      ...ionization,
      threshold: { ...e.ionizationThreshold, operator },
    });
    assert.equal(report.rows.find((row) => row.id === "ionization-threshold-slack")?.passed, false);
  }
  assert.equal(
    verifyIonizationClosing({
      ...ionization,
      nonnegativeExcess: relation(symbol("excessEnergy"), zero, "le"),
    }).passed,
    false,
  );
  assert.equal(
    verifyIonizationClosing({
      ...ionization,
      thresholdFrequency: {
        ...e.thresholdFrequency,
        right: quotient(symbol("ionizationEnergyPerMolecule"), symbol("frequency")),
      },
    }).passed,
    false,
  );
});

test("the count uses absorbed energy and the full positive quantum-energy denominator", () => {
  for (const right of [
    quotient(symbol("incidentPower"), product(symbol("planckConstant"), symbol("frequency"))),
    quotient(symbol("absorbedLightEnergy"), symbol("frequency")),
    quotient(symbol("absorbedLightEnergy"), symbol("planckConstant")),
  ]) {
    const report = verifyIonizationClosing({
      ...ionization,
      countBound: { ...e.ionCountBound, right },
    });
    assert.equal(report.passed, false);
    assert.equal(report.rows.find((row) => row.id === "ionization-count-slack")?.passed, false);
  }
  assert.equal(
    verifyIonizationClosing({
      ...ionization,
      absorbedCount: { ...e.absorbedCount, right: symbol("absorbedLightEnergy") },
    }).passed,
    false,
  );
});

test("yield between zero and one is required for the count bounds", () => {
  for (const omitted of ionization.conditions.filter(
    (condition) =>
      condition.kind === "relation" &&
      condition.left.kind === "symbol" &&
      condition.left.quantityId === "ionizationYield",
  )) {
    const report = verifyIonizationClosing({
      ...ionization,
      conditions: ionization.conditions.filter((condition) => condition !== omitted),
    });
    assert.equal(report.rows.find((row) => row.id === "ionization-count-slack")?.passed, false);
  }
  for (const countBound of [
    { ...e.ionCountBound, operator: "=" as const },
    { ...e.ionCountBound, operator: "ge" as const },
  ])
    assert.equal(verifyIonizationClosing({ ...ionization, countBound }).passed, false);
});

test("neither an altered energy account nor an extra primary ion per quantum satisfies the certificate", () => {
  const changedEnergy = {
    ...e.absorbedEnergy,
    right: product(e.absorbedEnergy.right, { kind: "number", value: "2" }),
  };
  const changedYield = {
    ...e.ionCountWithYield,
    right: product(e.ionCountWithYield.right, { kind: "number", value: "2" }),
  };
  for (const input of [
    { ...ionization, absorbedEnergy: changedEnergy },
    { ...ionization, yieldCount: changedYield },
  ]) {
    const report = verifyIonizationClosing(input);
    assert.equal(report.passed, false);
    assert.equal(report.rows.find((row) => row.id === "ionization-count-slack")?.passed, false);
  }
});

test("meeting the energy threshold never supplies the missing full-yield premise", () => {
  const report = verifyIonizationClosing({
    ...ionization,
    fullYieldCondition: relation(symbol("ionizationYield"), one, "le"),
  });
  assert.equal(report.rows.find((row) => row.id === "ionization-threshold-slack")?.passed, true);
  assert.equal(report.rows.find((row) => row.id === "ionization-count-slack")?.passed, true);
  assert.equal(report.rows.find((row) => row.id === "ionization-full-yield")?.passed, false);
  assert.equal(report.rows.find((row) => row.id === "ionization-source-count")?.passed, false);
});

test("the source gram-molecule equality retains the molecular-number division and constant convention", () => {
  for (const change of [
    { gramMolecules: { ...e.gramMolecules, right: symbol("ionCount") } },
    {
      quantumNotation: {
        ...e.quantumNotation,
        right: product(symbol("gasConstant"), symbol("wienBeta")),
      },
    },
    {
      sourceCount: {
        ...e.sourceCount,
        right: quotient(
          symbol("absorbedLightEnergy"),
          product(symbol("gasConstant"), symbol("frequency")),
        ),
      },
    },
    {
      fullYieldCount: {
        ...e.fullYieldCount,
        right: product(e.fullYieldCount.right, { kind: "number", value: "2" }),
      },
    },
  ])
    assert.equal(verifyIonizationClosing({ ...ionization, ...change }).passed, false);
});

test("a new pole cannot be hidden in the conditional source equality", () => {
  const z = symbol("unadmittedQuantity");
  assert.equal(
    verifyIonizationClosing({
      ...ionization,
      sourceCount: { ...e.sourceCount, right: product(e.sourceCount.right, quotient(z, z)) },
    }).passed,
    false,
  );
});

test("scale, index, evaluation point and hidden expression fields cannot change a scalar's identity", () => {
  for (const replacement of [
    { ...symbol("frequency"), scale: { num: 2, den: 1 } },
    { ...symbol("frequency"), index: "other" },
    { ...symbol("frequency"), at: symbol("temperature") },
    { ...symbol("frequency"), args: [symbol("temperature")] },
  ] as Expression[]) {
    const countBound = substituteNode(e.ionCountBound, "frequency", replacement);
    assert.equal(verifyIonizationClosing({ ...ionization, countBound }).passed, false);
  }
});

test("unsupported and cyclic arithmetic produces a failed report instead of an inferred proof", () => {
  // Strict relation operators are outside Expression. Feed these deliberately
  // untyped payloads through the boundary; valid premises use PositiveCondition.
  const strictFluorescence: unknown = {
    ...fluorescence,
    energyBound: { ...e.fluorescenceBound, operator: "lt" },
  };
  assert.equal(
    verifyFluorescenceClosing(strictFluorescence as FluorescenceClosingInput).passed,
    false,
  );
  for (const invalid of [
    { ...ionization, threshold: { ...e.ionizationThreshold, operator: "gt" } },
    { ...ionization, countBound: { ...e.ionCountBound, operator: "lt" } },
    { ...ionization, nonnegativeCount: { ...e.nonnegativeCount, operator: "gt" } },
  ] as unknown[]) {
    assert.equal(verifyIonizationClosing(invalid as IonizationClosingInput).passed, false);
  }
  const hiddenPositiveCondition: unknown = {
    ...fluorescence,
    conditions: fluorescence.conditions.map((condition, index) =>
      index === 0 ? { ...condition, admitsZero: true } : condition,
    ),
  };
  assert.equal(
    verifyFluorescenceClosing(hiddenPositiveCondition as FluorescenceClosingInput).passed,
    false,
  );
  const cyclic: { kind: "negate"; argument: Expression } = { kind: "negate", argument: zero };
  cyclic.argument = cyclic;
  for (const energyBound of [cyclic, { kind: "constant", name: "infinity" } as Expression]) {
    assert.equal(verifyFluorescenceClosing({ ...fluorescence, energyBound }).passed, false);
  }
  const malformed = { ...e.ionCountBound, unreviewedOperand: one } as Expression;
  assert.equal(verifyIonizationClosing({ ...ionization, countBound: malformed }).passed, false);
  const malformedIdentity = { ...e.ionCountBound, opId: cyclic } as unknown as Expression;
  assert.equal(
    verifyIonizationClosing({ ...ionization, countBound: malformedIdentity }).passed,
    false,
  );
});
