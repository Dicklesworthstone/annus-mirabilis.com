/**
 * Exact conditional checks for the closing light-quantum arguments (§§7 and 9).
 * A nonnegative slack proves a bound after the physical budget is admitted. Neither a
 * checked inequality nor a positive energy excess proves that an elementary event occurs.
 * The one-quantum model, nonnegative losses and yield restrictions remain explicit premises.
 */
import fluorescenceRecord from "../../../content/equations/light-quanta/eq-model-lq-fluorescence-bound.json";
import countRecord from "../../../content/equations/light-quanta/eq-model-lq-ion-count-bound.json";
import thresholdRecord from "../../../content/equations/light-quanta/eq-model-lq-ionization-threshold.json";
import type { Expression } from "../ast.ts";
import { equalPolynomials, exactPolynomial } from "./exactPolynomial.ts";
import { closingQuantaExpressions as e } from "./lightQuantaClosing.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
/** Strict positivity is a proof premise, not an operator in the displayed equation AST. */
export type PositiveCondition = Readonly<{ kind: "positive"; expression: Expression }>;
export type ClosingQuantaCondition = Relation | PositiveCondition;
const positive = (expression: Expression): PositiveCondition => ({ kind: "positive", expression });
const symbol = (quantityId: string): Expression => ({
  kind: "symbol",
  termId: quantityId,
  quantityId,
});
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const subtract = (left: Expression, right: Expression): Expression => sum(left, negative(right));
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const relation = (
  left: Expression,
  right: Expression,
  operator: Relation["operator"] = "=",
): Relation => ({
  kind: "relation",
  left,
  right,
  operator,
});
const zero: Expression = { kind: "number", value: "0" };
const one: Expression = { kind: "number", value: "1" };
const h = symbol("planckConstant");
const inputFrequency = symbol("incidentFrequency");
const outputFrequency = symbol("emittedFrequency");
const frequency = symbol("frequency");
const otherEnergy = symbol("otherChannelEnergy");
const excessEnergy = symbol("excessEnergy");
const absorbedEnergy = symbol("absorbedLightEnergy");
const absorbedCount = symbol("absorbedQuantumCount");
const ionCount = symbol("ionCount");
const ionizationWork = symbol("ionizationEnergyPerMolecule");
const ionizationYield = symbol("ionizationYield");
const fluorescenceYield = symbol("quantumYield");
const absorbedPower = symbol("absorbedPower");
const avogadro = symbol("avogadroConstant");
const gasConstant = symbol("gasConstant");
const wienBeta = symbol("wienBeta");
const quantumEnergy = product(h, frequency);

export const fluorescenceClosingRecords = [fluorescenceRecord] as const;
export const ionizationClosingRecords = [thresholdRecord, countRecord] as const;

export interface FluorescenceClosingInput {
  readonly budget: Expression;
  readonly nonnegativeRemainder: Expression;
  readonly energyBound: Expression;
  readonly frequencyBound: Expression;
  readonly absorbedRate: Expression;
  readonly emittedRate: Expression;
  readonly emittedPower: Expression;
  readonly conditions: readonly ClosingQuantaCondition[];
}

export interface IonizationClosingInput {
  readonly budget: Expression;
  readonly nonnegativeExcess: Expression;
  readonly threshold: Expression;
  readonly thresholdFrequency: Expression;
  readonly absorbedEnergy: Expression;
  readonly absorbedCount: Expression;
  readonly yieldCount: Expression;
  readonly nonnegativeCount: Expression;
  readonly countBound: Expression;
  /** This extra premise licenses only the following full-yield equality. */
  readonly fullYieldCondition: Expression;
  readonly fullYieldCount: Expression;
  readonly gramMolecules: Expression;
  readonly sourceCount: Expression;
  readonly quantumNotation: Expression;
  readonly conditions: readonly ClosingQuantaCondition[];
}

const fluorescenceConditions = Object.freeze([
  positive(h),
  positive(inputFrequency),
  positive(outputFrequency),
  relation(absorbedPower, zero, "ge"),
  relation(fluorescenceYield, zero, "ge"),
  relation(fluorescenceYield, one, "le"),
]);
const ionizationConditions = Object.freeze([
  positive(h),
  positive(frequency),
  relation(ionizationWork, zero, "ge"),
  relation(absorbedEnergy, zero, "ge"),
  relation(absorbedCount, zero, "ge"),
  relation(ionizationYield, zero, "ge"),
  relation(ionizationYield, one, "le"),
  positive(avogadro),
  positive(gasConstant),
  positive(wienBeta),
]);

export const fluorescenceClosingInput: FluorescenceClosingInput = Object.freeze({
  budget: e.fluorescenceBudget,
  nonnegativeRemainder: e.nonnegativeRemainder,
  energyBound: fluorescenceRecord.tree as Expression,
  frequencyBound: e.frequencyBound,
  absorbedRate: e.absorbedRate,
  emittedRate: e.emittedRate,
  emittedPower: e.emittedPower,
  conditions: fluorescenceConditions,
});
export const ionizationClosingInput: IonizationClosingInput = Object.freeze({
  budget: e.ionizationBudget,
  nonnegativeExcess: relation(excessEnergy, zero, "ge"),
  threshold: thresholdRecord.tree as Expression,
  thresholdFrequency: e.thresholdFrequency,
  absorbedEnergy: e.absorbedEnergy,
  absorbedCount: e.absorbedCount,
  yieldCount: e.ionCountWithYield,
  nonnegativeCount: e.nonnegativeCount,
  countBound: countRecord.tree as Expression,
  fullYieldCondition: relation(ionizationYield, one),
  fullYieldCount: e.fullYieldCount,
  gramMolecules: e.gramMolecules,
  sourceCount: e.sourceCount,
  quantumNotation: e.quantumNotation,
  conditions: ionizationConditions,
});

export const fluorescenceClosingAssumptions = Object.freeze([
  {
    id: "lq-fluorescence-single-event",
    label: "One absorbed quantum supplies the chosen emitted quantum",
    explanation:
      "This is the sparse-light elementary-event hypothesis. Other outgoing light and heat are included in the same energy account; the body supplies no extra energy.",
  },
  {
    id: "lq-fluorescence-positive-domain",
    label: "Positive quantum energy and nonnegative other channels",
    explanation:
      "The same h > 0 multiplies both positive frequencies. Other outgoing energy is nonnegative. These conditions preserve the direction of the energy and frequency bounds.",
  },
  {
    id: "lq-fluorescence-fixed-yield",
    label: "Brightness needs a separate fixed-yield assumption",
    explanation:
      "The optional rate calculation holds the frequencies, absorption conditions and the selected channel's yield between zero and one fixed. The energy bound determines neither that yield nor the emitted spectrum.",
  },
]);
export const ionizationClosingAssumptions = Object.freeze([
  {
    id: "lq-ionization-single-event",
    label: "One quantum supplies one elementary primary ionization",
    explanation:
      "The energy account excludes pooled quanta, secondary ionization cascades and other energy sources. Nonnegative excess energy gives a necessary energetic threshold, not a guarantee of absorption or ionization.",
  },
  {
    id: "lq-ionization-absorbed-energy",
    label: "Count monochromatic absorbed energy",
    explanation:
      "The frequency and h are strictly positive; the energy and absorbed quantum count are nonnegative. Light that passes through the gas and incident power alone are not absorbed energy.",
  },
  {
    id: "lq-ionization-yield-bound",
    label: "At most one primary ionization per absorbed quantum",
    explanation:
      "An independently specified ionization yield lies between zero and one. The threshold does not select that yield, so an unknown yield gives an upper bound rather than an actual count.",
  },
  {
    id: "lq-ionization-full-yield-only",
    label: "The printed count equality additionally requires full yield",
    explanation:
      "Only when every absorbed quantum ionizes is the count equal to L/(hν). Dividing by the positive molecular number N and using the same h = Rβ/N convention then gives j = L/(Rβν). This conditional calculation is not an experimental test of the premise.",
  },
]);

export const fluorescenceClosingCheckRows = [
  "fluorescence-domain",
  "fluorescence-energy-slack",
  "fluorescence-positive-division",
  "fluorescence-rate-account",
] as const;
export const ionizationClosingCheckRows = [
  "ionization-domain",
  "ionization-threshold-slack",
  "ionization-threshold-frequency",
  "ionization-absorbed-count",
  "ionization-nonnegative-count",
  "ionization-count-slack",
  "ionization-full-yield",
  "ionization-source-count",
] as const;
type CheckId =
  | (typeof fluorescenceClosingCheckRows)[number]
  | (typeof ionizationClosingCheckRows)[number];
export type ClosingQuantaProofReport = Readonly<{
  passed: boolean;
  rows: readonly Readonly<{ id: CheckId; passed: boolean; reason: string }>[];
  reason?: string;
}>;

/** This proof admits bounded scalar arithmetic only. No indexed value or hidden pole is erased. */
function projected(value: unknown): Expression | undefined {
  let nodes = 0;
  const visit = (raw: unknown, depth: number): boolean => {
    if (
      ++nodes > 512 ||
      depth > 24 ||
      raw === null ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    )
      return false;
    const prototype = Object.getPrototypeOf(raw);
    if (prototype !== null && prototype !== Object.prototype) return false;
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (Object.values(descriptors).some((descriptor) => !("value" in descriptor))) return false;
    const node = raw as Record<string, unknown>;
    if (node.opId !== undefined && (typeof node.opId !== "string" || node.opId.length > 256))
      return false;
    const only = (keys: readonly string[]) => Object.keys(node).every((key) => keys.includes(key));
    const child = (item: unknown) => visit(item, depth + 1);
    switch (node.kind) {
      case "symbol": {
        if (
          !only(["kind", "termId", "quantityId", "scale"]) ||
          typeof node.termId !== "string" ||
          typeof node.quantityId !== "string" ||
          !/^[a-z][A-Za-z0-9-]{0,99}$/.test(node.quantityId)
        )
          return false;
        if (node.scale === undefined) return true;
        const scale = node.scale as { num?: unknown; den?: unknown } | null;
        return (
          scale !== null &&
          typeof scale === "object" &&
          Object.keys(scale).every((key) => key === "num" || key === "den") &&
          Object.values(Object.getOwnPropertyDescriptors(scale)).every(
            (descriptor) => "value" in descriptor,
          ) &&
          Number.isSafeInteger(scale.num) &&
          Number.isSafeInteger(scale.den) &&
          Number(scale.den) > 0
        );
      }
      case "number":
        return (
          only(["kind", "value"]) &&
          typeof node.value === "string" &&
          /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(node.value) &&
          node.value.length <= 128
        );
      case "relation":
        return (
          only(["kind", "left", "right", "operator", "opId"]) &&
          ["=", "le", "ge"].includes(String(node.operator)) &&
          child(node.left) &&
          child(node.right)
        );
      case "sum":
      case "product":
        return (
          only(["kind", "args", "opId"]) &&
          Array.isArray(node.args) &&
          node.args.length > 0 &&
          node.args.length <= 32 &&
          node.args.every(child)
        );
      case "quotient":
        return (
          only(["kind", "numerator", "denominator", "opId"]) &&
          child(node.numerator) &&
          child(node.denominator)
        );
      case "group":
      case "negate":
        return only(["kind", "argument", "opId"]) && child(node.argument);
      default:
        return false;
    }
  };
  return visit(value, 0)
    ? projectDerivationSymbols(value as Expression, (node) => node.quantityId)
    : undefined;
}

function isRelation(
  value: Expression | undefined,
  operator: Relation["operator"],
): value is Relation {
  return value?.kind === "relation" && value.operator === operator;
}
function same(left: Expression | undefined, right: Expression): boolean {
  return left !== undefined && structurallyEqual(left, right);
}
function sameCondition(actual: unknown, expected: ClosingQuantaCondition): boolean {
  if (expected.kind !== "positive") return same(projected(actual), expected);
  if (actual === null || typeof actual !== "object" || Array.isArray(actual)) return false;
  const prototype = Object.getPrototypeOf(actual);
  if (prototype !== null && prototype !== Object.prototype) return false;
  const descriptors = Object.getOwnPropertyDescriptors(actual);
  if (
    Object.keys(descriptors).some((key) => key !== "kind" && key !== "expression") ||
    Object.values(descriptors).some((descriptor) => !("value" in descriptor)) ||
    descriptors.kind?.value !== "positive"
  )
    return false;
  return same(projected(descriptors.expression?.value), expected.expression);
}
function sameConditions(
  actual: readonly ClosingQuantaCondition[],
  expected: readonly ClosingQuantaCondition[],
): boolean {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every(
      (condition) => actual.filter((value) => sameCondition(value, condition)).length === 1,
    )
  );
}
const exact = (left: Expression, right: Expression) =>
  equalPolynomials(exactPolynomial(left), exactPolynomial(right));
const rational = (left: Expression, right: Expression) =>
  checkRationalSimplification(left, right).outcome === "equal";
const residual = (equality: Relation) => subtract(equality.left, equality.right);

function check(
  id: CheckId,
  reason: string,
  test: () => boolean,
): ClosingQuantaProofReport["rows"][number] {
  try {
    const passed = test();
    return Object.freeze({
      id,
      passed,
      reason: passed
        ? reason
        : `The supplied expressions or premises do not establish this step. ${reason}`,
    });
  } catch (error) {
    return Object.freeze({
      id,
      passed: false,
      reason:
        error instanceof Error
          ? error.message
          : "The expression is outside the admitted exact arithmetic.",
    });
  }
}
function report(rows: ClosingQuantaProofReport["rows"]): ClosingQuantaProofReport {
  const failed = rows.find((row) => !row.passed);
  return Object.freeze({
    passed: !failed,
    rows: Object.freeze(rows),
    ...(failed ? { reason: failed.reason } : {}),
  });
}

/** The energy slack is E_other, not zero; equality cannot replace the source's upper bound. */
export function verifyFluorescenceClosing(
  input: FluorescenceClosingInput = fluorescenceClosingInput,
): ClosingQuantaProofReport {
  const budget = projected(input.budget);
  const energy = projected(input.energyBound);
  const frequencyBound = projected(input.frequencyBound);
  const absorption = projected(input.absorbedRate);
  const emission = projected(input.emittedRate);
  const power = projected(input.emittedPower);
  const domain =
    sameConditions(input.conditions, fluorescenceConditions) &&
    same(projected(input.nonnegativeRemainder), e.nonnegativeRemainder);
  return report([
    check(
      "fluorescence-domain",
      "The admitted positive frequencies and h, nonnegative other-channel energy and bounded yield remain explicit.",
      () => domain,
    ),
    check(
      "fluorescence-energy-slack",
      "The incoming-minus-outgoing energy is the budget residual plus nonnegative other-channel energy.",
      () =>
        domain &&
        same(budget, e.fluorescenceBudget) &&
        isRelation(budget, "=") &&
        same(energy, e.fluorescenceBound) &&
        isRelation(energy, "le") &&
        exact(subtract(energy.right, energy.left), sum(residual(budget), otherEnergy)),
    ),
    check(
      "fluorescence-positive-division",
      "Multiplication of the frequency-bound slack by h reproduces the energy-bound slack, with h strictly positive.",
      () =>
        domain &&
        isRelation(energy, "le") &&
        isRelation(frequencyBound, "le") &&
        same(frequencyBound, e.frequencyBound) &&
        exact(
          product(h, subtract(frequencyBound.right, frequencyBound.left)),
          subtract(energy.right, energy.left),
        ),
    ),
    check(
      "fluorescence-rate-account",
      "The chosen fixed yield times absorbed quantum rate times outgoing quantum energy is the displayed emitted power.",
      () =>
        domain &&
        same(absorption, e.absorbedRate) &&
        isRelation(absorption, "=") &&
        same(emission, e.emittedRate) &&
        isRelation(emission, "=") &&
        isRelation(power, "=") &&
        same(power.left, e.emittedPower.left) &&
        rational(
          product(
            substituteNode(emission.right, "absorbedQuantumRate", absorption.right),
            h,
            outputFrequency,
          ),
          power.right,
        ),
    ),
  ]);
}

/**
 * The upper-count certificate is L − hν N_ion = (energy residual) − hν(yield residual)
 * + hν(1 − a)N_abs. The residuals vanish under their separately admitted equalities;
 * the last term is nonnegative. Full yield is a separate conditional step, never inferred.
 */
export function verifyIonizationClosing(
  input: IonizationClosingInput = ionizationClosingInput,
): ClosingQuantaProofReport {
  const budget = projected(input.budget);
  const threshold = projected(input.threshold);
  const boundary = projected(input.thresholdFrequency);
  const energy = projected(input.absorbedEnergy);
  const count = projected(input.absorbedCount);
  const yieldCount = projected(input.yieldCount);
  const lowerBound = projected(input.nonnegativeCount);
  const upperBound = projected(input.countBound);
  const fullYield = projected(input.fullYieldCount);
  const grams = projected(input.gramMolecules);
  const source = projected(input.sourceCount);
  const notation = projected(input.quantumNotation);
  const domain =
    sameConditions(input.conditions, ionizationConditions) &&
    same(projected(input.nonnegativeExcess), relation(excessEnergy, zero, "ge"));
  const energyAccount = same(energy, e.absorbedEnergy) && isRelation(energy, "=");
  const yieldAccount = same(yieldCount, e.ionCountWithYield) && isRelation(yieldCount, "=");
  const fullYieldAdmitted = same(
    projected(input.fullYieldCondition),
    relation(ionizationYield, one),
  );
  return report([
    check(
      "ionization-domain",
      "Positive quantum energy, nonnegative absorbed energy and count, 0 ≤ yield ≤ 1, and positive notation constants are explicit premises.",
      () => domain,
    ),
    check(
      "ionization-threshold-slack",
      "The quantum-energy-minus-ionization-work slack is the budget residual plus nonnegative excess energy; the threshold is necessary only.",
      () =>
        domain &&
        same(budget, e.ionizationBudget) &&
        isRelation(budget, "=") &&
        same(threshold, e.ionizationThreshold) &&
        isRelation(threshold, "ge") &&
        exact(subtract(threshold.left, threshold.right), sum(residual(budget), excessEnergy)),
    ),
    check(
      "ionization-threshold-frequency",
      "Division by positive h gives the energetic boundary J_mol/h, without a claim of nonzero ionization yield.",
      () =>
        domain &&
        isRelation(threshold, "ge") &&
        same(threshold, e.ionizationThreshold) &&
        isRelation(boundary, "=") &&
        same(boundary.left, e.thresholdFrequency.left) &&
        rational(quotient(threshold.right, h), boundary.right),
    ),
    check(
      "ionization-absorbed-count",
      "Divide the monochromatic absorbed-energy account by the same strictly positive hν.",
      () =>
        domain &&
        energyAccount &&
        isRelation(energy, "=") &&
        isRelation(count, "=") &&
        same(count.left, absorbedCount) &&
        rational(quotient(energy.left, quantumEnergy), count.right),
    ),
    check(
      "ionization-nonnegative-count",
      "The count is the yield-account residual plus a product of nonnegative yield and absorbed count.",
      () =>
        domain &&
        yieldAccount &&
        isRelation(yieldCount, "=") &&
        isRelation(lowerBound, "ge") &&
        same(lowerBound, e.nonnegativeCount) &&
        exact(
          subtract(lowerBound.left, lowerBound.right),
          sum(residual(yieldCount), product(ionizationYield, absorbedCount)),
        ),
    ),
    check(
      "ionization-count-slack",
      "After multiplying by positive hν, the upper-count slack has the exact nonnegative certificate hν(1 − a)N_abs plus the admitted equality residuals.",
      () =>
        domain &&
        energyAccount &&
        yieldAccount &&
        isRelation(energy, "=") &&
        isRelation(yieldCount, "=") &&
        same(upperBound, e.ionCountBound) &&
        isRelation(upperBound, "le") &&
        rational(
          product(quantumEnergy, subtract(upperBound.right, upperBound.left)),
          sum(
            residual(energy),
            negative(product(quantumEnergy, residual(yieldCount))),
            product(quantumEnergy, subtract(one, ionizationYield), absorbedCount),
          ),
        ),
    ),
    check(
      "ionization-full-yield",
      "Only under the extra premise a = 1 does the yield equation become equality with the absorbed quantum count.",
      () =>
        domain &&
        fullYieldAdmitted &&
        yieldAccount &&
        isRelation(yieldCount, "=") &&
        same(count, e.absorbedCount) &&
        isRelation(count, "=") &&
        isRelation(fullYield, "=") &&
        same(fullYield.left, ionCount) &&
        rational(
          substituteNode(
            substituteNode(yieldCount.right, "ionizationYield", one),
            "absorbedQuantumCount",
            count.right,
          ),
          fullYield.right,
        ),
    ),
    check(
      "ionization-source-count",
      "Convert the full-yield molecular count to gram-molecules, using the same positive N and h = Rβ/N; N cancels exactly.",
      () =>
        domain &&
        fullYieldAdmitted &&
        same(fullYield, e.fullYieldCount) &&
        isRelation(fullYield, "=") &&
        same(grams, e.gramMolecules) &&
        isRelation(grams, "=") &&
        same(notation, e.quantumNotation) &&
        isRelation(notation, "=") &&
        isRelation(source, "=") &&
        same(source.left, grams.left) &&
        rational(
          substituteNode(
            substituteNode(grams.right, "ionCount", fullYield.right),
            "planckConstant",
            notation.right,
          ),
          source.right,
        ),
    ),
  ]);
}
