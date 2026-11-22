import assert from "node:assert/strict";
import test from "node:test";
import fluorescenceRecord from "../../../content/equations/light-quanta/eq-model-lq-fluorescence-bound.json";
import countRecord from "../../../content/equations/light-quanta/eq-model-lq-ion-count-bound.json";
import thresholdRecord from "../../../content/equations/light-quanta/eq-model-lq-ionization-threshold.json";
import type { Expression } from "../ast.ts";
import { ClosingQuantaCanonicalError, closingQuantaExpressions as expressions, createClosingQuantaExpressions } from "./lightQuantaClosing.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";
import { substituteNode } from "./treeUtils.ts";

const symbol = (quantityId: string): Expression => ({ kind: "symbol", termId: quantityId, quantityId });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({ kind: "quotient", numerator, denominator });

test("source bound directions cannot be changed into stronger equalities or reversed bounds", () => {
  assert.equal(expressions.fluorescenceBound.operator, "le");
  assert.equal(expressions.ionizationThreshold.operator, "ge");
  assert.equal(expressions.ionCountBound.operator, "le");
  assert.throws(() => createClosingQuantaExpressions({
    ...fluorescenceRecord, tree: { ...fluorescenceRecord.tree, operator: "=" },
  }), ClosingQuantaCanonicalError);
  assert.throws(() => createClosingQuantaExpressions(fluorescenceRecord, {
    ...thresholdRecord, tree: { ...thresholdRecord.tree, operator: "le" },
  }), ClosingQuantaCanonicalError);
  assert.throws(() => createClosingQuantaExpressions(fluorescenceRecord, thresholdRecord, {
    ...countRecord, tree: { ...countRecord.tree, operator: "=" },
  }), ClosingQuantaCanonicalError);
});

test("the count conclusion retains absorbed energy, one quantum's full denominator and source ownership", () => {
  for (const changed of [
    { ...countRecord, argument: "arg-lq-photoelectric-energy" },
    { ...countRecord, id: "a-different-count" },
    { ...countRecord, tree: { ...countRecord.tree, right: {
      ...countRecord.tree.right, denominator: symbol("frequency"),
    } } },
    { ...countRecord, tree: { ...countRecord.tree, right: {
      ...countRecord.tree.right, numerator: symbol("incidentPower"),
    } } },
    { ...countRecord, tree: { ...countRecord.tree, left: {
      ...countRecord.tree.left, scale: { num: 2, den: 1 },
    } } },
  ]) assert.throws(() => createClosingQuantaExpressions(fluorescenceRecord, thresholdRecord, changed), ClosingQuantaCanonicalError);
});

test("fixed-yield emitted power follows exactly from the displayed rate account", () => {
  const counted = substituteNode(expressions.emittedRate.right, "absorbedQuantumRate", expressions.absorbedRate.right);
  const energyPerEmission = product(symbol("planckConstant"), symbol("emittedFrequency"));
  assert.equal(
    checkRationalSimplification(product(counted, energyPerEmission), expressions.emittedPower.right).outcome,
    "equal",
  );
  const wrongFrequency = substituteNode(expressions.emittedPower.right, "emittedFrequency", symbol("incidentFrequency"));
  assert.equal(checkRationalSimplification(product(counted, energyPerEmission), wrongFrequency).outcome, "different");
});

test("the printed gram-molecule equality follows from full yield and h = R beta / N", () => {
  const amount = quotient(expressions.fullYieldCount.right, symbol("avogadroConstant"));
  const historical = substituteNode(amount, "planckConstant", expressions.quantumNotation.right);
  assert.equal(checkRationalSimplification(historical, expressions.sourceCount.right).outcome, "equal");
  const omittedMolecularNumber = substituteNode(expressions.fullYieldCount.right, "planckConstant", expressions.quantumNotation.right);
  assert.equal(checkRationalSimplification(omittedMolecularNumber, expressions.sourceCount.right).outcome, "different");
});

test("a canceled undeclared pole cannot be added to the displayed source count", () => {
  const z = symbol("unadmittedQuantity");
  const altered = product(expressions.sourceCount.right, quotient(z, z));
  assert.equal(checkRationalSimplification(expressions.sourceCount.right, altered).outcome, "domain-change");
});

test("a rejected canonical conclusion identifies this argument and the exact record", () => {
  assert.throws(
    () => createClosingQuantaExpressions({ ...fluorescenceRecord, tree: { ...fluorescenceRecord.tree, operator: "ge" } }),
    (error: unknown) => error instanceof ClosingQuantaCanonicalError &&
      error.code === "lq-closing-canonical-mismatch" &&
      error.path === "lightQuantaClosing.eq-model-lq-fluorescence-bound",
  );
});
