/**
 * The positive-time Gaussian in Brownian §4, followed through its normalization and moments.
 * The source prints a particle-number density f = n p; this reconstruction uses normalized p.
 * These expressions supply both the reader and the separate build-time exact check.
 */
import momentRecord from "../../../content/equations/brownian-motion/eq-model-bm-gaussian-second-moment.json";
import growthRecord from "../../../content/equations/brownian-motion/eq-model-bm-mean-square-growth.json";
import rmsRecord from "../../../content/equations/brownian-motion/eq-model-bm-rms-from-mean-square.json";
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";

type Symbol = Extract<Expression, { kind: "symbol" }>;
export const gaussianNumber = (value: string): Expression => ({ kind: "number", value });
export const gaussianProduct = (...args: Expression[]): Expression => ({ kind: "product", args });
export const gaussianSum = (...args: Expression[]): Expression => ({ kind: "sum", args });
export const gaussianQuotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
export const gaussianNegative = (argument: Expression): Expression => ({
  kind: "negate",
  argument,
});
export const gaussianSquare = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
export const gaussianRoot = (radicand: Expression): Expression => ({
  kind: "root",
  degree: 2,
  radicand,
});
export const gaussianEquality = (left: Expression, right: Expression): Expression => ({
  kind: "relation",
  operator: "=",
  left,
  right,
});
const symbol = (quantityId: string): Symbol => ({ kind: "symbol", termId: quantityId, quantityId });
export const gaussianSymbols = Object.freeze({
  x: symbol("displacement1d"),
  u: symbol("scaledDisplacement"),
  D: symbol("diffusionCoefficient"),
  t: symbol("observationInterval"),
});
const { x, u, D, t } = gaussianSymbols;
const one = gaussianNumber("1");
const two = gaussianNumber("2");
const four = gaussianNumber("4");
export const gaussianRootPi = gaussianRoot({ kind: "constant", name: "pi" });
const infinity: Expression = { kind: "constant", name: "infinity" };
export const gaussianFullLineIntegral = (
  expression: Expression,
  variable: Expression,
): Expression => ({
  kind: "integral",
  expression,
  variable,
  lower: gaussianNegative(infinity),
  upper: infinity,
});
const derivative = (expression: Expression, variable: Expression, order = 1): Expression => ({
  kind: "derivative",
  expression,
  variable,
  order,
  partial: false,
});

export interface BrownianGaussianInput {
  readonly widthSquared: Expression;
  /** Coefficient of exp(exponent)/sqrt(widthSquared), after scaling x to u. */
  readonly normalization: Expression;
  readonly exponent: Expression;
  /** Ratios g'/g and g''/g, where g(u) = exp(exponent). */
  readonly firstWeight: Expression;
  readonly secondWeight: Expression;
  /** Polynomial multiplying g in d(u g)/du. */
  readonly partsWeight: Expression;
  readonly unitSecondMoment: Expression;
  readonly moment: Expression;
  readonly growth: Expression;
  readonly rms: Expression;
}

export const brownianGaussianInput: BrownianGaussianInput = Object.freeze({
  widthSquared: gaussianProduct(four, D, t),
  normalization: gaussianQuotient(one, gaussianRootPi),
  exponent: gaussianNegative(gaussianSquare(u)),
  firstWeight: gaussianProduct(gaussianNumber("-2"), u),
  secondWeight: gaussianSum(gaussianProduct(four, gaussianSquare(u)), gaussianNumber("-2")),
  partsWeight: gaussianSum(one, gaussianProduct(gaussianNumber("-2"), gaussianSquare(u))),
  unitSecondMoment: gaussianQuotient(gaussianRootPi, two),
  moment: momentRecord.tree as Expression,
  growth: growthRecord.tree as Expression,
  rms: rmsRecord.tree as Expression,
});

/** Canonical records a result declaration must agree with before citing this proof. */
export const brownianGaussianRecords = [momentRecord, growthRecord, rmsRecord] as const;

export const brownianGaussianAssumptions = [
  {
    id: "bm-gaussian-positive-time",
    label: "Constant positive diffusivity and positive elapsed time",
    explanation:
      "D is uniform and constant, and D > 0 and t > 0. The point start at t = 0 is a distributional limit, not a finite density obtained by substitution.",
  },
  {
    id: "bm-gaussian-full-line",
    label: "One unbounded coordinate with a point start and zero drift",
    explanation:
      "The normalized density describes displacement from the same initial point over the full real line. Walls, a spread of starting positions and systematic drift require a different density.",
  },
  {
    id: "bm-gaussian-area",
    label: "The Gaussian area identity",
    explanation:
      "The standard mathematical identity is the full-line integral of exp(−u²) equals √π. Its value is admitted here; the exact check does not replace its separate proof.",
  },
  {
    id: "bm-gaussian-tails",
    label: "Gaussian integrability and vanishing end terms",
    explanation:
      "The Gaussian and its first two moments are integrable, and u exp(−u²) tends to zero at both ends of the line. These mathematical tail properties justify parity and integration by parts.",
  },
] as const;

export const brownianGaussianCheckRows = [
  { id: "profile-derivatives", label: "Differentiate the Gaussian profile twice" },
  { id: "diffusion-equation", label: "Substitute the same density into the diffusion equation" },
  { id: "normalization", label: "Normalize the full-line density" },
  { id: "signed-mean", label: "Use symmetry to find zero signed mean" },
  { id: "integration-by-parts", label: "Find the second Gaussian integral by parts" },
  { id: "second-moment", label: "Recover the canonical mean square 2Dt" },
  { id: "root-mean-square", label: "Take the nonnegative root for RMS displacement" },
] as const;
export type BrownianGaussianCheckId = (typeof brownianGaussianCheckRows)[number]["id"];

/** Display formulas and the exact owner use the same expressions. */
export function brownianGaussianEquations(input: BrownianGaussianInput = brownianGaussianInput) {
  const width = gaussianRoot(input.widthSquared);
  const profile: Expression = { kind: "function", name: "exp", argument: input.exponent };
  const density: Expression = {
    kind: "symbol",
    termId: "probabilityDensity",
    quantityId: "probabilityDensity",
    args: [x, t],
  };
  const weighted = (weight: Expression) => gaussianProduct(weight, profile);
  const timeWeight = gaussianQuotient(
    gaussianSum(gaussianNumber("-1"), gaussianNegative(gaussianProduct(u, input.firstWeight))),
    gaussianProduct(two, t),
  );
  const diffusionWeight = gaussianProduct(
    gaussianQuotient(D, input.widthSquared),
    input.secondWeight,
  );
  return Object.freeze({
    coordinate: gaussianEquality(u, gaussianQuotient(x, width)),
    density: gaussianEquality(
      density,
      gaussianProduct(gaussianQuotient(input.normalization, width), profile),
    ),
    firstDerivative: gaussianEquality(derivative(profile, u), weighted(input.firstWeight)),
    secondDerivative: gaussianEquality(derivative(profile, u, 2), weighted(input.secondWeight)),
    timeRatio: gaussianEquality(
      gaussianQuotient(
        {
          kind: "derivative",
          expression: density,
          variable: t,
          order: 1,
          partial: true,
          heldFixed: [x, D],
        },
        density,
      ),
      timeWeight,
    ),
    diffusionRatio: gaussianEquality(
      gaussianQuotient(
        gaussianProduct(D, {
          kind: "derivative",
          expression: density,
          variable: x,
          order: 2,
          partial: true,
          heldFixed: [t, D],
        }),
        density,
      ),
      diffusionWeight,
    ),
    normalization: gaussianEquality(gaussianFullLineIntegral(profile, u), gaussianRootPi),
    normalizationCancellation: gaussianEquality(
      gaussianProduct(input.normalization, gaussianRootPi),
      one,
    ),
    parts: gaussianEquality(
      derivative(gaussianProduct(u, profile), u),
      weighted(input.partsWeight),
    ),
    unitSecondMoment: gaussianEquality(
      gaussianFullLineIntegral(weighted(gaussianSquare(u)), u),
      input.unitSecondMoment,
    ),
    moment: input.moment,
    growth: input.growth,
    rms: input.rms,
  });
}

const glyphs: Readonly<Record<string, string>> = {
  displacement1d: "x",
  scaledDisplacement: "u",
  diffusionCoefficient: "D",
  observationInterval: "t",
  probabilityDensity: "p",
  rmsDisplacement1d: "lambda_x",
};
export function brownianGaussianDisplay(expression: Expression): Expression {
  return projectDerivationSymbols(
    expression,
    (value) => glyphs[value.quantityId] ?? value.quantityId,
  );
}
