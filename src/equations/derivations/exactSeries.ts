import {
  add,
  dimension,
  divide,
  formatRational,
  isDimensionless,
  multiply,
  parseRational,
  type Rational,
  rational,
  sameDimension,
  subtract,
} from "../../content/dimensions/rational.ts";
import { type Expression, parseExpression, record } from "../ast.ts";
import { checkDimensions } from "../dimensions.ts";
import type { QuantityRegistry } from "../quantities.ts";
import { exactPolynomial } from "./exactPolynomial.ts";

/** Exact Taylor coefficients, not a numerical fit or a general-purpose CAS.
 * The independent variable is a declared ratio of two distinct canonical
 * quantities (v/c in the first consumer). Its denominator is held nonzero.
 * Admitted operations are real-analytic near zero: rational arithmetic with
 * nonzero denominators at zero, integer powers, and the identity-connected
 * rational power of a base whose value at zero is exactly one.
 * Binomial recurrence: NIST DLMF 4.6.7, https://dlmf.nist.gov/4.6.E7.
 * This computes a finite jet; it does NOT bound a remainder at a finite speed.
 */
export const SERIES_LIMITS = Object.freeze({ order: 12, work: 262144, bits: 4096 });
export type SeriesRequest = Readonly<{
  expression: Expression;
  equationId: string;
  registry: QuantityRegistry;
  variable: Readonly<{ numerator: string; denominator: string }>;
  order: number;
}>;
export type TaylorJet = Readonly<{
  order: number;
  coefficients: readonly string[];
  regularity: "real-analytic-near-zero";
  variable: Readonly<{ numerator: string; denominator: string }>;
  scope: "local-series-not-finite-error-bound";
}>;
export class SeriesRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesRefusal";
  }
}
const fail = (message: string): never => {
  throw new SeriesRefusal(message);
};
const ZERO = rational(0n),
  ONE = rational(1n);
const unitScale = (n: Extract<Expression, { kind: "symbol" }>) =>
  n.scale === undefined || (n.scale.num === 1 && n.scale.den === 1);

export function exactSeriesAtZero(request: SeriesRequest): TaylorJet {
  const { order, variable, registry, equationId } = request;
  record(variable, "series.variable", ["numerator", "denominator"]);
  if (!Number.isSafeInteger(order) || order < 0 || order > SERIES_LIMITS.order)
    fail("Taylor order exceeds the supported range 0–12.");
  if (
    !variable ||
    variable.numerator === variable.denominator ||
    !Object.hasOwn(registry, variable.numerator) ||
    !Object.hasOwn(registry, variable.denominator)
  )
    fail("Declare a ratio of two distinct registered quantities.");
  if (
    !sameDimension(
      dimension(registry[variable.numerator]!.dimension),
      dimension(registry[variable.denominator]!.dimension),
    )
  )
    fail("The declared series variable must be dimensionless.");
  const expression = parseExpression(request.expression, equationId, registry);
  const dimensions = checkDimensions(expression, registry);
  if (dimensions.status !== "consistent" || !isDimensionless(dimensions.dimension))
    fail("Normalize dimensions explicitly before expanding in a dimensionless ratio.");
  let work = 0;
  function bounded(value: Rational): Rational {
    if (
      ++work > SERIES_LIMITS.work ||
      value.num.toString(2).length > SERIES_LIMITS.bits ||
      value.den.toString(2).length > SERIES_LIMITS.bits
    )
      fail("Exact series arithmetic exceeds the work or coefficient budget.");
    return value;
  }
  const plus = (a: Rational, b: Rational) => bounded(add(a, b));
  const times = (a: Rational, b: Rational) => bounded(multiply(a, b));
  const over = (a: Rational, b: Rational) => bounded(divide(a, b));
  const scalar = (a: Rational): Rational[] =>
    Array.from({ length: order + 1 }, (_, k) => (k ? ZERO : a));
  function sum(a: readonly Rational[], b: readonly Rational[]): Rational[] {
    return a.map((value, k) => plus(value, b[k]!));
  }
  function product(a: readonly Rational[], b: readonly Rational[]): Rational[] {
    return a.map((_, k) => {
      let value = ZERO;
      for (let j = 0; j <= k; j++) value = plus(value, times(a[j]!, b[k - j]!));
      return value;
    });
  }
  function quotient(a: readonly Rational[], b: readonly Rational[]): Rational[] {
    if (b[0]!.num === 0n)
      fail("Division by a zero-at-origin expression needs a separate removable-limit check.");
    const result: Rational[] = [];
    for (let k = 0; k <= order; k++) {
      let rest = ZERO;
      for (let j = 1; j <= k; j++) rest = plus(rest, times(b[j]!, result[k - j]!));
      result.push(over(subtract(a[k]!, rest), b[0]!));
    }
    return result;
  }
  function power(base: readonly Rational[], exponent: Rational): Rational[] {
    if (exponent.den > 16n || exponent.num > 16n || exponent.num < -16n)
      fail("Power exceeds the supported exact series budget.");
    if (exponent.den === 1n) {
      let value = scalar(ONE);
      const count = Number(exponent.num < 0n ? -exponent.num : exponent.num);
      for (let k = 0; k < count; k++) value = product(value, base);
      return exponent.num < 0n ? quotient(scalar(ONE), value) : value;
    }
    if (base[0]!.num !== base[0]!.den)
      fail("A fractional power requires base(0) = 1 and the real identity-connected branch.");
    const u = [...base];
    u[0] = ZERO;
    let term = scalar(ONE),
      value = scalar(ONE),
      binomial = ONE;
    for (let k = 1; k <= order; k++) {
      term = product(term, u);
      binomial = times(
        binomial,
        over(subtract(exponent, rational(BigInt(k - 1))), rational(BigInt(k))),
      );
      value = sum(
        value,
        term.map((coefficient) => times(coefficient, binomial)),
      );
    }
    return value;
  }
  function visit(node: Expression): Rational[] {
    // Matching is by exact canonical quantity identities, not glyphs or the
    // occurrence IDs a renderer assigns. Scaled occurrences are not the atom.
    if (
      node.kind === "quotient" &&
      node.numerator.kind === "symbol" &&
      node.denominator.kind === "symbol" &&
      unitScale(node.numerator) &&
      unitScale(node.denominator) &&
      node.numerator.quantityId === variable.numerator &&
      node.denominator.quantityId === variable.denominator
    ) {
      const value = scalar(ZERO);
      if (order >= 1) value[1] = ONE;
      return value;
    }
    switch (node.kind) {
      case "number":
        return scalar(exactPolynomial(node).get("[]") ?? ZERO);
      case "group":
        return visit(node.argument);
      case "negate":
        return visit(node.argument).map((value) => times(rational(-1n), value));
      case "sum":
        return node.args.map(visit).reduce(sum, scalar(ZERO));
      case "product":
        return node.args.map(visit).reduce(product, scalar(ONE));
      case "quotient":
        return quotient(visit(node.numerator), visit(node.denominator));
      case "root":
        return power(visit(node.radicand), rational(1n, BigInt(node.degree)));
      case "power":
        return power(
          visit(node.base),
          rational(BigInt(node.exponent.num), BigInt(node.exponent.den)),
        );
      default:
        return fail("Unsupported operation or unbound quantity; no local series was inferred.");
    }
  }
  const coefficients = visit(expression).map(formatRational);
  return Object.freeze({
    order,
    coefficients: Object.freeze(coefficients),
    variable: Object.freeze({ ...variable }),
    regularity: "real-analytic-near-zero",
    scope: "local-series-not-finite-error-bound",
  });
}

/** If f is admitted analytic and its coefficients below x^k vanish exactly,
 * f(x)/x^k has a removable singularity. Its limit is coefficient k, not f(0)/0.
 * No equality of truncated polynomials is promoted to equality of functions.
 */
export function monomialQuotientLimit(request: SeriesRequest, power: number) {
  if (!Number.isSafeInteger(power) || power < 1 || power > request.order)
    fail("The division order must be positive and within the calculated jet.");
  const jet = exactSeriesAtZero(request);
  if (jet.coefficients.slice(0, power).some((coefficient) => parseRational(coefficient).num !== 0n))
    fail("A lower-order coefficient survives. There is no finite two-sided removable limit.");
  return Object.freeze({
    status: "analytic-limit" as const,
    limit: jet.coefficients[power]!,
    quotientAtZero: "not-applicable" as const,
    removedPower: power,
    order: jet.order - power,
    coefficients: Object.freeze(jet.coefficients.slice(power)),
    variable: jet.variable,
    scope: jet.scope,
  });
}
