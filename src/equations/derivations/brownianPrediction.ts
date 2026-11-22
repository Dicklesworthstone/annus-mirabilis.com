/**
 * Brownian §5 joins two earlier model laws. These are the actual canonical records
 * rendered by the reader, with a separate canonical record for the combined prediction.
 * The same radius, viscosity, observation interval and input molecular number survive the join.
 */
import diffusivityRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusivity-molar.json";
import predictionRecord from "../../../content/equations/brownian-motion/eq-model-bm-predicted-displacement.json";
import rmsRecord from "../../../content/equations/brownian-motion/eq-model-bm-rms.json";
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";

type SymbolExpression = Extract<Expression, { kind: "symbol" }>;
type Relation = Extract<Expression, { kind: "relation" }>;
type Root = Extract<Expression, { kind: "root" }>;

export interface BrownianPredictionInput {
  readonly diffusivity: Expression;
  readonly rms: Expression;
  readonly prediction: Expression;
}

export const brownianPredictionRecords = [diffusivityRecord, rmsRecord, predictionRecord] as const;
export const brownianPredictionInput: BrownianPredictionInput = Object.freeze({
  diffusivity: diffusivityRecord.tree as Expression,
  rms: rmsRecord.tree as Expression,
  prediction: predictionRecord.tree as Expression,
});

type PredictionExpressionCode = "brownian-prediction-expression";

export class BrownianPredictionError extends Error {
  readonly refusalCode: PredictionExpressionCode;
  constructor(refusalCode: PredictionExpressionCode, message: string) {
    super(message);
    this.refusalCode = refusalCode;
    this.name = "BrownianPredictionError";
  }
}

/** Occurrence names may change; component and evaluation point remain part of the identity. */
function bindingKey(symbol: SymbolExpression): string {
  return JSON.stringify(
    [symbol.quantityId, symbol.index ?? "", symbol.at ?? null, symbol.args ?? null],
    (key, value) => (key === "termId" || key === "opId" ? undefined : value),
  );
}
const symbol = (quantityId: string): SymbolExpression => ({
  kind: "symbol",
  quantityId,
  termId: bindingKey({ kind: "symbol", quantityId, termId: "" }),
});
export const predictionNumber = (value: string): Expression => ({ kind: "number", value });
export const predictionProduct = (...args: Expression[]): Expression => ({ kind: "product", args });
export const predictionQuotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
export const predictionRoot = (radicand: Expression): Root => ({
  kind: "root",
  degree: 2,
  radicand,
});
export const predictionEquality = (left: Expression, right: Expression): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
});
export const brownianPredictionSymbols = Object.freeze({
  D: symbol("diffusionCoefficient"),
  R: symbol("molarGasConstant"),
  T: symbol("temperature"),
  eta: symbol("viscosity"),
  a: symbol("particleRadius"),
  N: symbol("avogadroConstant"),
  t: symbol("observationInterval"),
  lambda: symbol("rmsDisplacement1d"),
});

function equation(value: Expression): value is Relation {
  return value?.kind === "relation" && value.operator === "=";
}
function squareRoot(value: Expression | undefined): value is Root {
  return value?.kind === "root" && value.degree === 2;
}

/** Connected display steps: substitute the earlier D into this RMS, then collect and separate. */
export function brownianPredictionEquations(
  input: BrownianPredictionInput = brownianPredictionInput,
) {
  const diffusivity = projectDerivationSymbols(input.diffusivity, bindingKey);
  const rms = projectDerivationSymbols(input.rms, bindingKey);
  const prediction = projectDerivationSymbols(input.prediction, bindingKey);
  if (
    !equation(diffusivity) ||
    !equation(rms) ||
    !squareRoot(rms.right) ||
    !equation(prediction) ||
    prediction.right.kind !== "product" ||
    prediction.right.args.length !== 2 ||
    !squareRoot(prediction.right.args[0]) ||
    !squareRoot(prediction.right.args[1])
  )
    throw new BrownianPredictionError(
      "brownian-prediction-expression",
      "The prediction requires the molar diffusivity, the nonnegative RMS root, and the product of its time and material roots.",
    );

  const interval = prediction.right.args[0].radicand;
  const coefficient = prediction.right.args[1].radicand;
  const substitutedRadicand = substituteNode(
    rms.right.radicand,
    brownianPredictionSymbols.D.termId,
    diffusivity.right,
  );
  const collectedRadicand = predictionProduct(interval, coefficient);
  return Object.freeze({
    diffusivity,
    rms,
    substituted: predictionEquality(rms.left, predictionRoot(substitutedRadicand)),
    collected: predictionEquality(prediction.left, predictionRoot(collectedRadicand)),
    prediction,
    interval,
    coefficient,
    rmsRadicand: rms.right.radicand,
    substitutedRadicand,
    collectedRadicand,
  });
}

export const brownianPredictionAssumptions = [
  {
    id: "bm-prediction-model-laws",
    label: "The two earlier physical model laws",
    explanation:
      "The molar Stokes-Einstein diffusivity and the one-coordinate RMS law are admitted premises. They describe dilute spherical particles, slow Stokes drag, a uniform Newtonian liquid and free diffusion with zero drift. The substitution does not establish those physical assumptions.",
  },
  {
    id: "bm-prediction-same-quantities",
    label: "One radius, one observation interval and an input N",
    explanation:
      "D has the same meaning in both equations. The size a is the particle radius, the interval t is elapsed time, and N is avogadroConstant supplied to a forward prediction. The later inference uses the distinct quantity avogadroNumberEstimate.",
  },
  {
    id: "bm-prediction-positive-domain",
    label: "Positive material parameters and the nonnegative root",
    explanation:
      "R, T, viscosity, radius and N are positive, and t is nonnegative. RMS chooses the nonnegative square root. The Gaussian density requires t > 0; its zero RMS at t = 0 is a continuous limit.",
  },
  {
    id: "bm-prediction-consistent-units",
    label: "A consistent SI or centimetre-gram-second calculation",
    explanation:
      "Every input must belong to the same unit system. The paper's k is dynamic viscosity and P is radius. Its numerical R is an editorial input to the reconstruction, and 17 degrees Celsius is converted to absolute temperature.",
  },
] as const;

export const brownianPredictionCheckRows = [
  {
    id: "canonical-model-laws",
    label: "Keep the canonical model quantities and the admitted coefficients",
  },
  {
    id: "substitute-diffusivity",
    label: "Substitute the same diffusivity into the one-coordinate RMS law",
  },
  { id: "collect-two-over-six", label: "Reduce the factor two over six to one over three" },
  { id: "nonnegative-factorization", label: "Separate time using the nonnegative square roots" },
  { id: "unit-scaling", label: "Check the squared-length scaling from CGS to SI" },
] as const;
export type BrownianPredictionCheckId = (typeof brownianPredictionCheckRows)[number]["id"];

const modernGlyphs: Readonly<Record<string, string>> = {
  diffusionCoefficient: "D",
  molarGasConstant: "R",
  temperature: "T",
  viscosity: "eta",
  particleRadius: "a",
  avogadroConstant: "N",
  observationInterval: "t",
  rmsDisplacement1d: "lambda_x",
};
export function brownianPredictionDisplay(
  expression: Expression,
  notation: "modern" | "printed" = "modern",
): Expression {
  return projectDerivationSymbols(expression, (symbol) => {
    if (notation === "printed" && symbol.quantityId === "viscosity") return "k";
    if (notation === "printed" && symbol.quantityId === "particleRadius") return "P";
    return modernGlyphs[symbol.quantityId] ?? symbol.quantityId;
  });
}
