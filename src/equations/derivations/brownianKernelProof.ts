/**
 * Exact finite-jet and moment algebra for Brownian §4.
 * This owner checks the displayed coefficients and keeps every finite-interval remainder.
 * Taylor bounds and convergence of the scaled density family are explicit premises, never
 * conclusions inferred from an approximate equality or a numerical random-walk sample.
 */
import { ContentError } from "../../content/compiler/json.ts";
import type { Rational } from "../../content/dimensions/rational.ts";
import { type Expression, record } from "../ast.ts";
import {
  type BrownianKernelCheckId,
  type BrownianKernelInput,
  brownianKernelCheckRows,
  brownianKernelInput,
  kernelDensity,
  kernelDerivative,
  kernelFullLineIntegral,
  kernelNegative,
  kernelNumber,
  kernelPower,
  kernelProduct,
  kernelProfile,
  kernelQuotient,
  kernelSum,
  kernelSymbols,
} from "./brownianKernel.ts";
import {
  equalPolynomials,
  exactPolynomial,
  type Polynomial,
  PolynomialRefusal,
} from "./exactPolynomial.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";
import { structurallyEqual } from "./treeUtils.ts";

type RefusalCode = "brownian-kernel-expression" | "brownian-kernel-budget";
export class BrownianKernelError extends Error {
  readonly refusalCode: RefusalCode;
  constructor(refusalCode: RefusalCode, message: string) {
    super(message);
    this.name = "BrownianKernelError";
    this.refusalCode = refusalCode;
  }
}
const refuse = (message: string): never => {
  throw new BrownianKernelError("brownian-kernel-expression", message);
};
export interface BrownianKernelReport {
  readonly passed: boolean;
  readonly rows: readonly Readonly<{ id: BrownianKernelCheckId; passed: boolean }>[];
  readonly scope: "conditional-coefficients-and-remainder";
  readonly continuumLimit: "requires-stated-convergence";
  readonly reason?: string;
  readonly refusalCode?: RefusalCode;
}
type Relation = Extract<Expression, { kind: "relation" }>;
type MomentMode = "free" | "normalized" | "symmetric";
const FIELDS = [
  "chain",
  "next",
  "timeTaylor",
  "spaceTaylor",
  "jumpMoment",
  "diffusion",
  "finiteResidual",
  "timeErrorCoefficient",
  "spaceErrorCoefficient",
] as const;
const STAGES = [
  ["bm-kernel-expand-time", "truncate-series"],
  ["bm-kernel-expand-space-and-average", "truncate-series"],
  ["bm-kernel-use-normalization", "registered-identity"],
  ["bm-kernel-remove-odd-moment", "registered-identity"],
  ["bm-kernel-cancel-current-density", "add-subtract-multiply-divide"],
  ["bm-kernel-divide-by-interval", "add-subtract-multiply-divide"],
  ["bm-kernel-name-diffusivity", "substitute"],
  ["bm-kernel-identify-continuum-equation", "take-limit"],
] as const;
const { x, t, delta, tau, D } = kernelSymbols;
const one = kernelNumber("1");
const zero = kernelNumber("0");
const two = kernelNumber("2");
const now = kernelDensity(x, t);
const bareDensity: Expression = {
  kind: "symbol",
  termId: "probabilityDensity",
  quantityId: "probabilityDensity",
};
const future = kernelDensity(x, kernelSum(t, tau));
const plusDensity = kernelDensity(kernelSum(x, delta), t);
const minusDensity = kernelDensity(kernelSum(x, kernelNegative(delta)), t);
const atom = (quantityId: string): Expression => ({
  kind: "symbol",
  quantityId,
  termId: quantityId,
});
const atoms = {
  p: atom("kernelDensity"),
  future: atom("kernelFuture"),
  plus: atom("kernelOriginPlus"),
  rate: atom("kernelTimeRate"),
  slope: atom("kernelSlope"),
  curvature: atom("kernelCurvature"),
  cubic: atom("kernelCubicDerivative"),
  fourth: atom("kernelFourthDerivative"),
  secondTime: atom("kernelSecondTimeDerivative"),
  phi: atom("kernelWeight"),
};
const symbolOf = (name: string) => atom(name);
const moment = (order: number, mode: MomentMode): Expression =>
  order === 0 && mode !== "free"
    ? one
    : (order === 1 || order === 3) && mode === "symmetric"
      ? zero
      : atom("kernelMoment" + order);
const fraction = (value: Rational): Expression =>
  kernelQuotient(kernelNumber(String(value.num)), kernelNumber(String(value.den)));
const factorial = (order: number) => {
  let result = 1;
  for (let n = 2; n <= order; n++) result *= n;
  return kernelNumber(String(result));
};

/** Ignore occurrence ids only. Arguments, components, quantities and exact scales stay bound. */
function canonical(expression: Expression): Expression {
  let nodes = 0;
  function visit(value: unknown, depth: number): unknown {
    if (++nodes > 4096 || depth > 40)
      throw new BrownianKernelError(
        "brownian-kernel-budget",
        "The jump-law expression exceeds its structural budget.",
      );
    if (Array.isArray(value)) return value.map((child) => visit(child, depth + 1));
    if (value === null || typeof value !== "object") return value;
    const plain = record(value, "brownian-kernel.expression", [], Object.keys(value));
    const result = Object.fromEntries(
      Object.entries(plain).map(([key, child]) => [key, visit(child, depth + 1)]),
    );
    if (plain.kind === "symbol") result.termId = plain.quantityId;
    return result;
  }
  return visit(expression, 0) as Expression;
}
const same = (left: Expression, right: Expression) => structurallyEqual(left, right);
function relation(expression: Expression): Relation {
  const value = record(
    expression,
    "brownian-kernel.relation",
    ["kind", "operator", "left", "right"],
    ["opId"],
  );
  if (value.kind !== "relation") refuse("The jump-law step must remain an equation.");
  return expression as Relation;
}
function rationalEqual(expected: Expression, actual: Expression): boolean {
  return checkRationalSimplification(expected, actual).outcome === "equal";
}
function polynomialEqual(expected: Expression, actual: Expression): boolean {
  return equalPolynomials(exactPolynomial(expected), exactPolynomial(actual));
}

/** Integrate a polynomial times φ using linearity, preserving each separate moment. */
function integrate(polynomial: Polynomial, mode: MomentMode): Expression {
  const terms: Expression[] = [];
  for (const [key, coefficient] of polynomial) {
    const factors = JSON.parse(key) as string[];
    const weightCount = factors.filter((id) => id === "kernelWeight").length;
    const order = factors.filter((id) => id === delta.quantityId).length;
    if (weightCount !== 1 || order > 4)
      refuse(
        "A retained kernel integral needs one transition weight and a displacement power at most four.",
      );
    const independent = factors.filter((id) => id !== "kernelWeight" && id !== delta.quantityId);
    if (independent.includes("kernelOriginPlus")) {
      if (independent.length !== 1 || order !== 0)
        refuse(
          "Only the stated transition recurrence identifies an integral of the shifted density.",
        );
      terms.push(kernelProduct(fraction(coefficient), atoms.future));
    } else {
      terms.push(
        kernelProduct(fraction(coefficient), ...independent.map(symbolOf), moment(order, mode)),
      );
    }
  }
  return terms.length === 0 ? zero : terms.length === 1 ? terms[0]! : kernelSum(...terms);
}

/**
 * Replace only admitted field values/derivatives and whole-line moments by independent atoms.
 * Unknown evaluation points cannot silently merge with p(x,t). No physics evaluator runs here.
 */
function project(
  expression: Expression,
  mode: MomentMode = "free",
  inIntegral = false,
): Expression {
  if (!expression || typeof expression !== "object") refuse("A jump-law expression is missing.");
  switch (expression.kind) {
    case "number":
      exactPolynomial(expression);
      return expression;
    case "symbol":
      if (same(expression, now) || same(expression, bareDensity)) return atoms.p;
      if (same(expression, future) && !inIntegral) return atoms.future;
      if (same(expression, plusDensity) && inIntegral) return atoms.plus;
      if (same(expression, kernelProfile) && inIntegral) return atoms.phi;
      for (const scalar of [delta, tau, D]) if (same(expression, scalar)) return scalar;
      return refuse(
        "An unbound quantity or a changed field evaluation point occurs in the jump-law calculation.",
      );
    case "derivative": {
      for (const [variable, order, result] of [
        [t, 1, atoms.rate],
        [t, 2, atoms.secondTime],
        [x, 1, atoms.slope],
        [x, 2, atoms.curvature],
        [x, 3, atoms.cubic],
        [x, 4, atoms.fourth],
      ] as const)
        if (same(expression, kernelDerivative(variable, order))) return result;
      return refuse(
        "A derivative must use the stated density, variable, order and evaluation convention.",
      );
    }
    case "sum":
    case "product":
      return {
        ...expression,
        args: expression.args.map((child) => project(child, mode, inIntegral)),
      };
    case "group":
    case "negate":
      return { ...expression, argument: project(expression.argument, mode, inIntegral) };
    case "power":
      return { ...expression, base: project(expression.base, mode, inIntegral) };
    case "quotient":
      return {
        ...expression,
        numerator: project(expression.numerator, mode, inIntegral),
        denominator: project(expression.denominator, mode, inIntegral),
      };
    case "integral": {
      if (inIntegral) refuse("Nested integrals are outside the retained jump-law calculation.");
      const expected = kernelFullLineIntegral(expression.expression) as Extract<
        Expression,
        { kind: "integral" }
      >;
      if (
        !same(expression.variable, expected.variable) ||
        !expression.lower ||
        !expression.upper ||
        !same(expression.lower, expected.lower!) ||
        !same(expression.upper, expected.upper!)
      )
        refuse("Every kernel moment must cover the full displacement line in the same variable.");
      return integrate(exactPolynomial(project(expression.expression, mode, true)), mode);
    }
    default:
      return refuse("This operation is outside the admitted jump-law coefficient calculation.");
  }
}
function equation(
  value: Expression,
  operator: Relation["operator"],
  left: Expression,
  right: Expression,
  mode: MomentMode = "free",
): boolean {
  const input = relation(value);
  return (
    input.operator === operator &&
    rationalEqual(left, project(input.left, mode)) &&
    rationalEqual(right, project(input.right, mode))
  );
}

/** Exact identities for arbitrary polynomial jets fix Taylor's coefficients, without a sample. */
function taylorCoefficients(
  expression: Expression,
  variable: "space" | "time",
  sign: 1 | -1,
): boolean {
  const centre = atom("kernelJetPoint");
  const coefficients = [
    atom("kernelJetConstant"),
    atom("kernelJetLinear"),
    atom("kernelJetQuadratic"),
  ];
  const degree = variable === "space" ? 2 : 1;
  const increment = variable === "space" ? delta : tau;
  const polynomialAt = (position: Expression) =>
    kernelSum(
      coefficients[0]!,
      kernelProduct(coefficients[1]!, position),
      ...(degree === 2 ? [kernelProduct(coefficients[2]!, kernelPower(position, 2))] : []),
    );
  const first =
    degree === 2
      ? kernelSum(coefficients[1]!, kernelProduct(two, coefficients[2]!, centre))
      : coefficients[1]!;
  const replacements: Readonly<Record<string, Expression>> = {
    kernelDensity: polynomialAt(centre),
    [variable === "space" ? "kernelSlope" : "kernelTimeRate"]: first,
    ...(degree === 2 ? { kernelCurvature: kernelProduct(two, coefficients[2]!) } : {}),
  };
  function replace(value: Expression): Expression {
    if (value.kind === "symbol") return replacements[value.quantityId] ?? value;
    if (value.kind === "sum" || value.kind === "product")
      return { ...value, args: value.args.map(replace) };
    if (value.kind === "group" || value.kind === "negate")
      return { ...value, argument: replace(value.argument) };
    if (value.kind === "power") return { ...value, base: replace(value.base) };
    if (value.kind === "quotient")
      return {
        ...value,
        numerator: replace(value.numerator),
        denominator: replace(value.denominator),
      };
    return value;
  }
  return polynomialEqual(
    polynomialAt(kernelSum(centre, sign === 1 ? increment : kernelNegative(increment))),
    replace(project(expression)),
  );
}

function expectedFiniteRight(): Expression {
  const spatialTerms = kernelSum(
    plusDensity,
    kernelNegative(now),
    ...[1, 2, 3].map((order) =>
      kernelNegative(
        kernelProduct(
          order === 1 ? delta : kernelQuotient(kernelPower(delta, order), factorial(order)),
          kernelDerivative(x, order),
        ),
      ),
    ),
  );
  const spatial = kernelFullLineIntegral(kernelProduct(spatialTerms, kernelProfile));
  const temporal = kernelSum(
    future,
    kernelNegative(now),
    kernelNegative(kernelProduct(tau, kernelDerivative(t, 1))),
  );
  return kernelQuotient(kernelSum(spatial, kernelNegative(temporal)), tau);
}

/** Algebra is exact; taking the limit still requires the five reader-visible premises. */
export function verifyBrownianKernel(
  raw: BrownianKernelInput = brownianKernelInput,
): BrownianKernelReport {
  const scope = "conditional-coefficients-and-remainder" as const;
  const continuumLimit = "requires-stated-convergence" as const;
  try {
    record(raw, "brownian-kernel", FIELDS);
    const input = {
      ...raw,
      ...Object.fromEntries(
        FIELDS.filter((field) => field !== "chain").map((field) => [
          field,
          canonical(raw[field] as Expression),
        ]),
      ),
    } as BrownianKernelInput;
    const chain = raw.chain;
    record(
      chain,
      "brownian-kernel.chain",
      ["steps", "target", "targetStepId", "entryAssumptions"],
      Object.keys(chain),
    );
    if (!Array.isArray(chain.steps) || chain.steps.length !== STAGES.length)
      refuse("The source calculation requires every named transformation in order.");
    const steps = chain.steps.map((step) => ({
      ...step,
      from: canonical(step.from),
      to: canonical(step.to),
    }));
    const requiredPremises = [
      "bm-normalized-transition-kernel",
      "bm-symmetric-transition-kernel",
      "bm-independent-coarse-intervals",
      "bm-homogeneous-stationary-kernel",
      "bm-smooth-density-controlled-moments",
    ];
    const connected =
      STAGES.every(
        ([id, kind], index) =>
          steps[index]?.id === id &&
          steps[index]?.rule.kind === kind &&
          (index === 0 || same(steps[index - 1]!.to, steps[index]!.from)),
      ) &&
      chain.routeKind === "source-order" &&
      requiredPremises.every((ref) =>
        chain.entryAssumptions.some(
          (premise) =>
            premise.ref === ref &&
            premise.edgeType ===
              (ref === "bm-smooth-density-controlled-moments"
                ? "pedagogical-reconstruction"
                : "historical-derivation"),
        ),
      ) &&
      chain.target === "eq-model-bm-diffusion-equation" &&
      chain.targetStepId === STAGES.at(-1)![0] &&
      same(steps.at(-1)!.to, input.diffusion);
    const source = relation(steps[0]!.from);
    const modern = relation(input.next);
    const recurrence =
      source.operator === "=" &&
      modern.operator === "=" &&
      same(source.left, future) &&
      same(modern.left, future) &&
      same(source.right, kernelFullLineIntegral(kernelProduct(plusDensity, kernelProfile))) &&
      same(modern.right, kernelFullLineIntegral(kernelProduct(minusDensity, kernelProfile)));
    const time = relation(input.timeTaylor);
    const space = relation(input.spaceTaylor);
    const retainedTime = kernelSum(atoms.p, kernelProduct(tau, atoms.rate));
    const fullMoments = kernelSum(
      kernelProduct(atoms.p, moment(0, "free")),
      kernelProduct(atoms.slope, moment(1, "free")),
      kernelProduct(kernelQuotient(atoms.curvature, two), moment(2, "free")),
    );
    const normalizedMoments = kernelSum(
      atoms.p,
      kernelProduct(atoms.slope, moment(1, "free")),
      kernelProduct(kernelQuotient(atoms.curvature, two), moment(2, "free")),
    );
    const spreading = kernelProduct(kernelQuotient(atoms.curvature, two), moment(2, "free"));
    const diffusivity = kernelQuotient(moment(2, "free"), kernelProduct(two, tau));
    const timeChecked =
      time.operator === "approx" &&
      same(time.left, future) &&
      taylorCoefficients(time.right, "time", 1) &&
      equation(steps[0]!.to, "approx", retainedTime, atoms.future);
    const spaceChecked =
      space.operator === "approx" &&
      same(space.left, minusDensity) &&
      taylorCoefficients(space.right, "space", -1);
    const averaged = spaceChecked && equation(steps[1]!.to, "approx", retainedTime, fullMoments);
    const normalized = equation(steps[2]!.to, "approx", retainedTime, normalizedMoments);
    const symmetric =
      equation(steps[3]!.to, "approx", retainedTime, kernelSum(atoms.p, spreading)) &&
      equation(steps[4]!.to, "approx", kernelProduct(tau, atoms.rate), spreading);
    const coefficient =
      equation(input.jumpMoment, "=", D, diffusivity) &&
      equation(steps[5]!.to, "approx", atoms.rate, kernelProduct(diffusivity, atoms.curvature));
    const named = equation(steps[6]!.to, "approx", atoms.rate, kernelProduct(D, atoms.curvature));
    const residual = relation(input.finiteResidual);
    const finite =
      residual.operator === "=" &&
      rationalEqual(
        kernelSum(atoms.rate, kernelNegative(kernelProduct(diffusivity, atoms.curvature))),
        project(residual.left, "symmetric"),
      ) &&
      rationalEqual(project(residual.left, "symmetric"), project(residual.right, "symmetric"));
    // The cubic coefficient must be checked before symmetry cancels it. A third-order
    // Lagrange remainder cannot be cancelled by parity, since its evaluation point varies.
    const bounds =
      same(residual.right, canonical(expectedFiniteRight())) &&
      rationalEqual(kernelQuotient(tau, factorial(2)), project(input.timeErrorCoefficient)) &&
      rationalEqual(
        kernelQuotient(moment(4, "free"), kernelProduct(factorial(4), tau)),
        project(input.spaceErrorCoefficient),
      );
    const limit =
      equation(input.diffusion, "=", atoms.rate, kernelProduct(D, atoms.curvature)) &&
      relation(steps[6]!.to).operator === "approx" &&
      steps[7]!.rule.params.variable === "stepInterval" &&
      steps[7]!.rule.params.approaches === 0;
    const verdicts: Readonly<Record<BrownianKernelCheckId, boolean>> = {
      "chain-order": connected,
      "source-recurrence": recurrence,
      "time-coefficients": timeChecked,
      "spatial-coefficients": spaceChecked,
      "moment-expansion": averaged,
      normalization: normalized,
      "odd-moments": symmetric,
      "interval-coefficient": coefficient,
      "diffusivity-substitution": named,
      "finite-remainder": finite,
      "remainder-coefficients": bounds,
      "continuum-statement": limit,
    };
    const rows = brownianKernelCheckRows.map(({ id }) => ({ id, passed: verdicts[id] }));
    return { passed: rows.every((row) => row.passed), rows, scope, continuumLimit };
  } catch (error) {
    if (
      !(error instanceof BrownianKernelError) &&
      !(error instanceof PolynomialRefusal) &&
      !(error instanceof ContentError)
    )
      throw error;
    return {
      passed: false,
      rows: [],
      scope,
      continuumLimit,
      reason: error.message,
      refusalCode:
        error instanceof BrownianKernelError ? error.refusalCode : "brownian-kernel-expression",
    };
  }
}
