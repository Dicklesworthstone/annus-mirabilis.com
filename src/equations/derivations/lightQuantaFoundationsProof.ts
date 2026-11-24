/** Exact consequences of admitted radiation and statistical premises; no numerical proof samples. */
import type { Expression } from "../ast.ts";
import { exactPolynomial } from "./exactPolynomial.ts";
import {
  type ClassicalCutoffInput,
  classicalCutoffAssumptions,
  type classicalCutoffCheckRows,
  classicalCutoffInput,
  lqFoundationExpressions as e,
  foundationLog,
  foundationNumber,
  foundationProduct,
  type IndependentEntropyInput,
  independentEntropyAssumptions,
  type independentEntropyCheckRows,
  independentEntropyInput,
  lqFoundationSymbols as p,
} from "./lightQuantaFoundations.ts";
import { boundedLqExpression as projected } from "./lightQuantaProofTree.ts";
import { logarithmicCalculus } from "./logarithmicCalculus.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
type Symbol = Extract<Expression, { kind: "symbol" }>;
type CheckId =
  | (typeof classicalCutoffCheckRows)[number]
  | (typeof independentEntropyCheckRows)[number];
export type LqFoundationsProofReport = Readonly<{
  passed: boolean;
  rows: readonly Readonly<{ id: CheckId; passed: boolean; reason: string }>[];
  reason?: string;
}>;

function same(left: Expression | undefined, right: Expression): boolean {
  try {
    return left !== undefined && structurallyEqual(left, right);
  } catch {
    return false;
  }
}
const equality = (value: Expression | undefined): value is Relation =>
  value?.kind === "relation" && value.operator === "=";
const premisesPresent = (actual: readonly string[], expected: readonly { id: string }[]): boolean =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  expected.every(({ id }) => actual.filter((item) => item === id).length === 1);

function check(
  id: CheckId,
  reason: string,
  run: () => boolean,
): LqFoundationsProofReport["rows"][number] {
  try {
    const passed = run();
    return {
      id,
      passed,
      reason: passed
        ? reason
        : `The supplied expressions or premises do not establish this step. ${reason}`,
    };
  } catch (error) {
    return {
      id,
      passed: false,
      reason:
        error instanceof Error
          ? error.message
          : "The expression is outside this exact calculation.",
    };
  }
}
function report(rows: LqFoundationsProofReport["rows"]): LqFoundationsProofReport {
  const failure = rows.find((row) => !row.passed);
  return {
    passed: rows.length > 0 && !failure,
    rows,
    ...(failure ? { reason: failure.reason } : {}),
  };
}

// π is a fixed positive scalar in this polynomial calculation. The replacement is private to
// the existing exact calculus owner; no numerical approximation or new physical quantity is used.
const pi: Symbol = { kind: "symbol", termId: "positivePi", quantityId: "positivePi" };
function calculusExpression(expression: Expression): Expression {
  switch (expression.kind) {
    case "constant":
      return expression.name === "pi" ? pi : expression;
    case "sum":
    case "product":
      return { ...expression, args: expression.args.map(calculusExpression) };
    case "quotient":
      return {
        ...expression,
        numerator: calculusExpression(expression.numerator),
        denominator: calculusExpression(expression.denominator),
      };
    case "power":
      return { ...expression, base: calculusExpression(expression.base) };
    case "group":
    case "negate":
      return { ...expression, argument: calculusExpression(expression.argument) };
    default:
      return expression;
  }
}
const positiveClassical = [p.nu, p.cutoff, p.k, p.T, p.c, pi];
function positiveMonomial(expression: Expression): boolean {
  switch (expression.kind) {
    case "number":
      return (exactPolynomial(expression).get("[]")?.num ?? 0n) > 0n;
    case "constant":
      return expression.name === "pi";
    case "symbol":
      return positiveClassical.some((value) => structurallyEqual(expression, value));
    case "product":
      return expression.args.length > 0 && expression.args.every(positiveMonomial);
    case "quotient":
      return positiveMonomial(expression.numerator) && positiveMonomial(expression.denominator);
    case "power":
      return (
        expression.exponent.den === 1 &&
        Number.isSafeInteger(expression.exponent.num) &&
        expression.exponent.num >= 0 &&
        expression.exponent.num <= 16 &&
        positiveMonomial(expression.base)
      );
    case "group":
      return positiveMonomial(expression.argument);
    default:
      return false;
  }
}

/** Check F′ = ρ, F(0) = 0, the supplied endpoints, and a positive unbounded doubling sequence. */
export function verifyClassicalCutoff(
  input: ClassicalCutoffInput = classicalCutoffInput,
): LqFoundationsProofReport {
  const density = projected(input.density);
  const integral = projected(input.integral);
  const substituted = projected(input.substitutedIntegral);
  const primitive = projected(input.primitive);
  const total = projected(input.total);
  const growth = projected(input.growth);
  const domain =
    premisesPresent(input.premises, classicalCutoffAssumptions) &&
    same(density, e.density) &&
    same(integral, e.integral);
  const calculus = logarithmicCalculus({ positive: positiveClassical });
  return report([
    check(
      "classical-premises",
      "The admitted classical density, positive fixed parameters and frequency integral retain their stated meanings.",
      () => domain,
    ),
    check(
      "classical-substitution",
      "The complete admitted spectrum replaces only the integrand, with the original zero and cutoff endpoints.",
      () =>
        domain &&
        equality(density) &&
        equality(integral) &&
        equality(substituted) &&
        integral.right.kind === "integral" &&
        substituted.right.kind === "integral" &&
        same(substituted.left, integral.left) &&
        same(substituted.right, { ...integral.right, expression: density.right }),
    ),
    check(
      "classical-antiderivative",
      "Exact polynomial differentiation recovers the supplied density, including its coefficient and cubic factor.",
      () =>
        domain &&
        equality(density) &&
        primitive !== undefined &&
        calculus.differentiatesTo(
          calculusExpression(primitive),
          p.nu,
          calculusExpression(density.right),
        ),
    ),
    check(
      "classical-zero-boundary",
      "The primitive has zero one-sided limit at the lower frequency endpoint.",
      () =>
        domain &&
        primitive !== undefined &&
        calculus.tendsToAtZero(calculusExpression(primitive), p.nu, p.zero),
    ),
    check(
      "classical-cutoff-evaluation",
      "The supplied finite total is the primitive at the same cutoff minus its zero lower boundary.",
      () =>
        domain &&
        equality(integral) &&
        equality(total) &&
        primitive !== undefined &&
        same(total.left, integral.left) &&
        calculus.equal(
          calculusExpression(total.right),
          calculusExpression(substituteNode(primitive, p.nu.termId, p.cutoff)),
        ),
    ),
    check(
      "classical-unbounded-growth",
      "For every positive cutoff the total is positive and doubling it multiplies the energy by eight, giving an unbounded sequence of nonnegative partial integrals.",
      () => {
        if (!domain || !equality(total) || !equality(growth) || total.left.kind !== "symbol")
          return false;
        const doubled = foundationProduct(foundationNumber("2"), p.cutoff);
        return (
          same(growth.left, { ...total.left, at: doubled }) &&
          same(growth.right, foundationProduct(foundationNumber("8"), total.left)) &&
          positiveMonomial(total.right) &&
          calculus.equal(
            calculusExpression(substituteNode(total.right, p.cutoff.termId, doubled)),
            calculusExpression(foundationProduct(foundationNumber("8"), total.right)),
          )
        );
      },
    ),
  ]);
}

/**
 * A positive real power is exp(exponent × ln(base)); applying ln therefore gives
 * exponent × ln(base). This is a symbolic identity for the declared positive base,
 * not a finite set of trial counts or a floating evaluation of tiny probabilities.
 */
export function verifyIndependentEntropy(
  input: IndependentEntropyInput = independentEntropyInput,
): LqFoundationsProofReport {
  const probability = projected(input.probability);
  const principle = projected(input.principle);
  const substituted = projected(input.substitutedEntropy);
  const logarithm = projected(input.logarithm);
  const entropy = projected(input.entropy);
  const domain =
    premisesPresent(input.premises, independentEntropyAssumptions) &&
    same(probability, e.probability) &&
    same(principle, e.principle);
  const calculus = logarithmicCalculus({ positive: [p.f, p.k], constants: [p.n] });
  return report([
    check(
      "independent-premises",
      "Uniform independent positions, a nonnegative integer count, positive fraction and Boltzmann's relative-probability principle are admitted explicitly.",
      () => domain,
    ),
    check(
      "independent-substitution",
      "The probability fⁿ replaces W in the admitted entropy relation without changing its coefficient or reference state.",
      () =>
        domain &&
        equality(probability) &&
        equality(principle) &&
        equality(substituted) &&
        same(substituted.left, principle.left) &&
        same(substituted.right, substituteNode(principle.right, p.W.termId, probability.right)),
    ),
    check(
      "independent-positive-logarithm",
      "The positive-power logarithm identity brings the same symbolic count down as a coefficient.",
      () =>
        domain &&
        equality(probability) &&
        probability.right.kind === "symbolPower" &&
        equality(logarithm) &&
        same(logarithm.left, foundationLog(probability.right)) &&
        calculus.equal(
          logarithm.right,
          foundationProduct(probability.right.exponent, foundationLog(probability.right.base)),
        ),
    ),
    check(
      "independent-entropy-conclusion",
      "The supplied chained equality retains the admitted principle and gives its exact product with the proved logarithm.",
      () =>
        domain &&
        equality(entropy) &&
        equality(principle) &&
        equality(logarithm) &&
        same(entropy.left, principle) &&
        calculus.equal(entropy.right, foundationProduct(p.k, logarithm.right)),
    ),
    check(
      "independent-reference-boundaries",
      "Equal volumes and zero points each give zero entropy difference without taking the logarithm of zero.",
      () =>
        domain &&
        equality(entropy) &&
        calculus.equal(substituteNode(entropy.right, p.f.termId, p.one), p.zero) &&
        calculus.equal(substituteNode(entropy.right, p.n.termId, p.zero), p.zero),
    ),
  ]);
}
