import type { Expression } from "../ast.ts";
import {
  type BrownianPredictionCheckId,
  BrownianPredictionError,
  type BrownianPredictionInput,
  brownianPredictionCheckRows,
  brownianPredictionEquations,
  brownianPredictionInput,
  brownianPredictionSymbols,
  predictionNumber,
  predictionProduct,
  predictionQuotient,
} from "./brownianPrediction.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";
import { structurallyEqual } from "./treeUtils.ts";

const MAX_NODES = 2_048;
const MAX_DEPTH = 32;
const { D, R, T, eta, a, N, t, lambda } = brownianPredictionSymbols;
const pi: Expression = { kind: "constant", name: "pi" };
const thermal = predictionProduct(R, T);
const diffusivity = predictionQuotient(
  thermal,
  predictionProduct(predictionNumber("6"), pi, eta, a, N),
);
const coefficient = predictionQuotient(
  thermal,
  predictionProduct(predictionNumber("3"), pi, eta, a, N),
);

export interface BrownianPredictionCheck {
  readonly id: BrownianPredictionCheckId;
  readonly passed: boolean;
}
export interface BrownianPredictionNumericalRow {
  readonly elapsedSeconds: number;
  readonly diffusionCoefficientM2PerS: number;
  readonly rmsMetres: number;
  readonly rmsMicrometres: number;
}
export type BrownianPredictionReconstruction =
  | {
      readonly status: "value";
      readonly constantSetId: "einstein-1905-brownian-printed";
      readonly rows: readonly BrownianPredictionNumericalRow[];
    }
  | { readonly status: "unavailable"; readonly reason: string };

export interface BrownianPredictionReport {
  readonly passed: boolean;
  readonly rows: readonly BrownianPredictionCheck[];
  readonly reason?: string;
  readonly refusalCode?: "brownian-prediction-expression" | "brownian-prediction-budget";
  /** Floating reconstruction from the established owner, separate from the exact algebra verdict. */
  readonly reconstruction?: BrownianPredictionReconstruction;
}

type PredictionBudgetCode = "brownian-prediction-budget";

class PredictionBudgetError extends Error {
  readonly refusalCode: PredictionBudgetCode;
  constructor(refusalCode: PredictionBudgetCode) {
    super("The authored displacement derivation exceeds the bounded expression budget.");
    this.refusalCode = refusalCode;
    this.name = "PredictionBudgetError";
  }
}

/** Restrict this proof to scalar, unindexed, consistently scaled model quantities. */
function validateInput(input: BrownianPredictionInput): void {
  let count = 0;
  const plain = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Object.values(Object.getOwnPropertyDescriptors(value)).every(
      (descriptor) => "value" in descriptor,
    );
  };
  const visit = (value: unknown, depth: number): void => {
    count += 1;
    if (count > MAX_NODES || depth > MAX_DEPTH)
      throw new PredictionBudgetError("brownian-prediction-budget");
    if (!plain(value))
      throw new BrownianPredictionError(
        "brownian-prediction-expression",
        "An expression must be a plain authored node.",
      );
    const child = (node: unknown) => visit(node, depth + 1);
    switch (value.kind) {
      case "number":
        if (typeof value.value !== "string" || value.value.length > 128)
          throw new BrownianPredictionError(
            "brownian-prediction-expression",
            "Exact coefficients must be bounded decimal strings.",
          );
        return;
      case "constant":
        if (value.name !== "pi")
          throw new BrownianPredictionError(
            "brownian-prediction-expression",
            "Only the finite constant pi belongs to this derivation.",
          );
        return;
      case "symbol":
        if (
          typeof value.quantityId !== "string" ||
          typeof value.termId !== "string" ||
          value.index !== undefined ||
          value.at !== undefined ||
          value.args !== undefined ||
          value.scale !== undefined
        )
          throw new BrownianPredictionError(
            "brownian-prediction-expression",
            "The prediction requires the same unindexed scalar quantities and one consistent unit system.",
          );
        return;
      case "sum":
      case "product":
        if (!Array.isArray(value.args) || value.args.length === 0 || value.args.length > 64)
          throw new BrownianPredictionError(
            "brownian-prediction-expression",
            "An authored sum or product needs bounded arguments.",
          );
        for (const argument of value.args) child(argument);
        return;
      case "quotient":
        child(value.numerator);
        child(value.denominator);
        return;
      case "power":
        if (
          !plain(value.exponent) ||
          !Number.isSafeInteger(value.exponent.num) ||
          !Number.isSafeInteger(value.exponent.den) ||
          Number(value.exponent.den) <= 0
        )
          throw new BrownianPredictionError(
            "brownian-prediction-expression",
            "An authored power needs an exact rational exponent.",
          );
        child(value.base);
        return;
      case "root":
        if (!Number.isSafeInteger(value.degree) || Number(value.degree) <= 0)
          throw new BrownianPredictionError(
            "brownian-prediction-expression",
            "An authored root needs a positive integer degree.",
          );
        child(value.radicand);
        return;
      case "relation":
        if (value.operator !== "=")
          throw new BrownianPredictionError(
            "brownian-prediction-expression",
            "The admitted model laws must be exact equalities.",
          );
        child(value.left);
        child(value.right);
        return;
      default:
        throw new BrownianPredictionError(
          "brownian-prediction-expression",
          "This node is outside the displacement derivation's scope.",
        );
    }
  };
  if (
    !plain(input) ||
    Object.keys(input).length !== 3 ||
    !("diffusivity" in input) ||
    !("rms" in input) ||
    !("prediction" in input)
  )
    throw new BrownianPredictionError(
      "brownian-prediction-expression",
      "Supply the diffusivity, RMS law and combined prediction.",
    );
  visit(input.diffusivity, 0);
  visit(input.rms, 0);
  visit(input.prediction, 0);
}

const positiveMaterialQuantities = new Set([
  "molarGasConstant",
  "temperature",
  "viscosity",
  "particleRadius",
  "avogadroConstant",
]);

/** Positivity premises justify these divisors; they do not justify arbitrary differences. */
function admittedNonzero(expression: Expression): boolean {
  switch (expression.kind) {
    case "number":
      return Number.isFinite(Number(expression.value)) && Number(expression.value) !== 0;
    case "constant":
      return expression.name === "pi";
    case "symbol":
      return positiveMaterialQuantities.has(expression.quantityId);
    case "product":
      return expression.args.every(admittedNonzero);
    case "quotient":
      return admittedNonzero(expression.numerator) && admittedNonzero(expression.denominator);
    case "power":
      return expression.exponent.den === 1 && admittedNonzero(expression.base);
    default:
      return false;
  }
}

function denominatorsAdmitted(expression: Expression): boolean {
  switch (expression.kind) {
    case "sum":
    case "product":
      return expression.args.every(denominatorsAdmitted);
    case "quotient":
      return (
        admittedNonzero(expression.denominator) &&
        denominatorsAdmitted(expression.numerator) &&
        denominatorsAdmitted(expression.denominator)
      );
    case "power":
      return (
        (expression.exponent.num > 0 || admittedNonzero(expression.base)) &&
        denominatorsAdmitted(expression.base)
      );
    case "root":
      return denominatorsAdmitted(expression.radicand);
    case "relation":
      return denominatorsAdmitted(expression.left) && denominatorsAdmitted(expression.right);
    case "symbol":
    case "number":
    case "constant":
      return true;
    default:
      return false;
  }
}

function equal(left: Expression, right: Expression): boolean {
  return checkRationalSimplification(left, right).outcome === "equal";
}

function symbolsBelongTo(expression: Expression, allowed: ReadonlySet<string>): boolean {
  switch (expression.kind) {
    case "symbol":
      return allowed.has(expression.quantityId);
    case "sum":
    case "product":
      return expression.args.every((argument) => symbolsBelongTo(argument, allowed));
    case "quotient":
      return (
        symbolsBelongTo(expression.numerator, allowed) &&
        symbolsBelongTo(expression.denominator, allowed)
      );
    case "power":
      return expression.exponent.den === 1 && symbolsBelongTo(expression.base, allowed);
    case "root":
    case "relation":
      return false;
    case "number":
    case "constant":
      return true;
    default:
      return false;
  }
}

/** Exact unit definitions, independent of the numerical reconstruction's physics owner. */
function unitScales() {
  return {
    energy: predictionNumber("1e-7"),
    viscosity: predictionNumber("0.1"),
    length: predictionNumber("0.01"),
  };
}

function unitScalingMatches(): boolean {
  const scale = unitScales();
  return equal(
    predictionQuotient(scale.energy, predictionProduct(scale.viscosity, scale.length)),
    predictionProduct(scale.length, scale.length),
  );
}

/** A scoped exact join of admitted laws; neither the Stokes law nor the measured world is proved. */
export function verifyBrownianPrediction(
  input: BrownianPredictionInput = brownianPredictionInput,
): BrownianPredictionReport {
  try {
    validateInput(input);
    if (![input.diffusivity, input.rms, input.prediction].every(denominatorsAdmitted))
      throw new BrownianPredictionError(
        "brownian-prediction-expression",
        "Every denominator must be nonzero under the stated positive-material domain. Differences and elapsed time are not admitted divisors.",
      );
    const steps = brownianPredictionEquations(input);
    const material = positiveMaterialQuantities;
    const modelLaws =
      structurallyEqual(steps.diffusivity.left, D) &&
      structurallyEqual(steps.rms.left, lambda) &&
      structurallyEqual(steps.prediction.left, lambda) &&
      symbolsBelongTo(steps.diffusivity.right, material) &&
      symbolsBelongTo(
        steps.rmsRadicand,
        new Set(["diffusionCoefficient", "observationInterval"]),
      ) &&
      equal(steps.diffusivity.right, diffusivity) &&
      equal(steps.rmsRadicand, predictionProduct(predictionNumber("2"), D, t));
    const substitution =
      modelLaws &&
      symbolsBelongTo(steps.substitutedRadicand, new Set([...material, "observationInterval"])) &&
      equal(
        steps.substitutedRadicand,
        predictionProduct(predictionNumber("2"), steps.diffusivity.right, t),
      );
    const collection = substitution && equal(steps.substitutedRadicand, steps.collectedRadicand);
    const factorization =
      collection &&
      structurallyEqual(steps.interval, t) &&
      symbolsBelongTo(steps.coefficient, material) &&
      equal(steps.coefficient, coefficient);
    const checks: Record<BrownianPredictionCheckId, boolean> = {
      "canonical-model-laws": modelLaws,
      "substitute-diffusivity": substitution,
      "collect-two-over-six": collection,
      "nonnegative-factorization": factorization,
      "unit-scaling": unitScalingMatches(),
    };
    const rows = brownianPredictionCheckRows.map(({ id }) => ({ id, passed: checks[id] }));
    const passed = rows.every((row) => row.passed);
    return {
      passed,
      rows,
      ...(!passed
        ? {
            reason:
              "A quantity identity, coefficient, domain or root branch differs from the admitted displacement derivation.",
          }
        : {}),
    };
  } catch (error) {
    if (error instanceof BrownianPredictionError || error instanceof PredictionBudgetError)
      return {
        passed: false,
        rows: [],
        refusalCode: error.refusalCode,
        reason: error.message,
      };
    throw error;
  }
}
