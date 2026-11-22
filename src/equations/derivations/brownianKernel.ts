/**
 * The source's jump-law chain and its finite-interval remainder, sharing canonical trees.
 * All integrals are over the full displacement line. Taylor's remainder theorem and
 * convergence of the scaled family remain mathematical premises of the exact coefficients.
 */
import diffusionRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusion-equation.json";
import momentRecord from "../../../content/equations/brownian-motion/eq-model-bm-jump-moment.json";
import nextRecord from "../../../content/equations/brownian-motion/eq-model-bm-next-density.json";
import spaceRecord from "../../../content/equations/brownian-motion/eq-model-bm-taylor-in-space.json";
import timeRecord from "../../../content/equations/brownian-motion/eq-model-bm-taylor-in-time.json";
import type { Expression } from "../ast.ts";
import { brownianDisplayExpression, brownianKernelDerivation } from "./brownianSource.ts";
import type { DerivationChain } from "./types.ts";

type Symbol = Extract<Expression, { kind: "symbol" }>;
const symbol = (quantityId: string): Symbol => ({ kind: "symbol", quantityId, termId: quantityId });
export const kernelNumber = (value: string): Expression => ({ kind: "number", value });
export const kernelProduct = (...args: Expression[]): Expression => ({ kind: "product", args });
export const kernelSum = (...args: Expression[]): Expression => ({ kind: "sum", args });
export const kernelNegative = (argument: Expression): Expression => ({ kind: "negate", argument });
export const kernelQuotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
export const kernelPower = (base: Expression, order: number): Expression => ({
  kind: "power",
  base,
  exponent: { num: order, den: 1 },
});
export const kernelRelation = (
  left: Expression,
  right: Expression,
  operator: "=" | "approx" = "=",
): Expression => ({ kind: "relation", operator, left, right });

export const kernelSymbols = Object.freeze({
  x: symbol("positionCoordinate1d"),
  t: symbol("fieldTimeCoordinate"),
  delta: symbol("displacementIncrement"),
  tau: symbol("stepInterval"),
  D: symbol("diffusionCoefficient"),
});
const { x, t, delta, tau } = kernelSymbols;
const infinity: Expression = { kind: "constant", name: "infinity" };
export const kernelFullLineIntegral = (expression: Expression): Expression => ({
  kind: "integral",
  expression,
  variable: delta,
  lower: kernelNegative(infinity),
  upper: infinity,
});
export const kernelDensity = (position: Expression, time: Expression): Symbol => ({
  ...symbol("probabilityDensity"),
  args: [position, time],
});
export const kernelProfile: Symbol = { ...symbol("transitionKernel"), at: delta };
export const kernelDerivative = (variable: Symbol, order: number): Expression => ({
  kind: "derivative",
  expression: symbol("probabilityDensity"),
  variable,
  partial: true,
  order,
});
export const kernelMoment = (order: number): Expression =>
  kernelFullLineIntegral(
    order === 0 ? kernelProfile : kernelProduct(kernelPower(delta, order), kernelProfile),
  );
const now = kernelDensity(x, t);
const future = kernelDensity(x, kernelSum(t, tau));
const originPlus = kernelDensity(kernelSum(x, delta), t);
const rate = kernelDerivative(t, 1);
const slope = kernelDerivative(x, 1);
const curvature = kernelDerivative(x, 2);
const cubic = kernelDerivative(x, 3);
const spatialRemainder = kernelFullLineIntegral(
  kernelProduct(
    kernelSum(
      originPlus,
      kernelNegative(now),
      kernelNegative(kernelProduct(delta, slope)),
      kernelNegative(
        kernelProduct(kernelQuotient(kernelPower(delta, 2), kernelNumber("2")), curvature),
      ),
      kernelNegative(
        kernelProduct(kernelQuotient(kernelPower(delta, 3), kernelNumber("6")), cubic),
      ),
    ),
    kernelProfile,
  ),
);
const timeRemainder = kernelSum(
  future,
  kernelNegative(now),
  kernelNegative(kernelProduct(tau, rate)),
);
const momentTree = momentRecord.tree as Expression;
const momentCoefficient = (momentTree as Extract<Expression, { kind: "relation" }>).right;

export interface BrownianKernelInput {
  readonly chain: DerivationChain;
  readonly next: Expression;
  readonly timeTaylor: Expression;
  readonly spaceTaylor: Expression;
  readonly jumpMoment: Expression;
  readonly diffusion: Expression;
  /** Exact residual identity under the normalized symmetric recurrence; no terms discarded. */
  readonly finiteResidual: Expression;
  /** Coefficients multiplying uniform bounds on |p_tt| and |p_xxxx| respectively. */
  readonly timeErrorCoefficient: Expression;
  readonly spaceErrorCoefficient: Expression;
}

export const brownianKernelInput: BrownianKernelInput = Object.freeze({
  chain: brownianKernelDerivation,
  next: nextRecord.tree as Expression,
  timeTaylor: timeRecord.tree as Expression,
  spaceTaylor: spaceRecord.tree as Expression,
  jumpMoment: momentTree,
  diffusion: diffusionRecord.tree as Expression,
  finiteResidual: kernelRelation(
    kernelSum(rate, kernelNegative(kernelProduct(momentCoefficient, curvature))),
    kernelQuotient(kernelSum(spatialRemainder, kernelNegative(timeRemainder)), tau),
  ),
  timeErrorCoefficient: kernelQuotient(tau, kernelNumber("2")),
  spaceErrorCoefficient: kernelQuotient(kernelMoment(4), kernelProduct(kernelNumber("24"), tau)),
});

export const brownianKernelRecords = [
  nextRecord,
  timeRecord,
  spaceRecord,
  momentRecord,
  diffusionRecord,
] as const;

export const brownianKernelAssumptions = [
  {
    id: "bm-kernel-normalized-law",
    label: "A normalized nonnegative transition law",
    explanation:
      "The same displacement law applies throughout the full line and at every coarse interval. Its weights are nonnegative and integrate to one. The recurrence is a model premise, not a conclusion about molecular collisions.",
  },
  {
    id: "bm-kernel-symmetric-law",
    label: "Symmetry and finite moments",
    explanation:
      "Equal weights for opposite displacements make the first and third moments zero. The finite fourth moment required below also controls the lower absolute moments. The second moment remains nonnegative, and may be zero.",
  },
  {
    id: "bm-kernel-coarse-time",
    label: "A positive coarse interval",
    explanation:
      "The interval τ is positive and belongs to the same transition law as its moments. The physical independent-step description applies above the relevant correlation time; decreasing τ in a mathematical family does not remove molecular correlations.",
  },
  {
    id: "bm-kernel-smooth-remainder",
    label: "Taylor remainders have uniform bounds",
    explanation:
      "The density has two time derivatives and four spatial derivatives, uniformly bounded on the intervals and displacement segments being averaged. Taylor's remainder theorem and the permitted integrations are admitted mathematical tools.",
  },
  {
    id: "bm-kernel-controlled-limit",
    label: "The scaled density and its derivatives converge",
    explanation:
      "For a mathematical family, τ tends to zero, the second moment divided by 2τ tends to finite D, and the fourth moment divided by τ tends to zero. The densities, their time derivatives and their second spatial derivatives converge to the stated limiting fields. These assumptions permit the limiting equation; the coefficient check does not establish existence or uniqueness of that family.",
  },
] as const;

export const brownianKernelCheckRows = [
  { id: "chain-order", label: "Keep all source transformations connected and in order" },
  {
    id: "source-recurrence",
    label: "Preserve the whole-line recurrence and the source sign convention",
  },
  { id: "time-coefficients", label: "Check the retained first-order time coefficient" },
  {
    id: "spatial-coefficients",
    label: "Check the spatial Taylor coefficients and derivative bindings",
  },
  { id: "moment-expansion", label: "Average the retained polynomial into distinct kernel moments" },
  { id: "normalization", label: "Cancel only the normalized zeroth moment" },
  { id: "odd-moments", label: "Cancel odd moments while retaining the second moment" },
  { id: "interval-coefficient", label: "Derive the half-second-moment per positive interval" },
  { id: "diffusivity-substitution", label: "Substitute the complete diffusivity coefficient" },
  { id: "finite-remainder", label: "Retain the exact finite-interval residual" },
  { id: "remainder-coefficients", label: "Check the time and fourth-moment remainder factors" },
  {
    id: "continuum-statement",
    label: "Identify the PDE conditional on the stated convergence assumptions",
  },
] as const;
export type BrownianKernelCheckId = (typeof brownianKernelCheckRows)[number]["id"];
export const brownianKernelDisplay = brownianDisplayExpression;
