/**
 * A bounded exact field for the §3 coordinate proof, on c > 0 and |v| < c.
 * Its only algebraic extension is w = positive sqrt(c²-v²). Squared w factors
 * reduce to that polynomial; no sampled values or unconstrained root cancellation.
 */
import type { Expression } from "../ast.ts";
import { exactPolynomial, type Polynomial, sumPolynomials } from "./exactPolynomial.ts";
import { structurallyEqual } from "./treeUtils.ts";

type Symbol = Extract<Expression, { kind: "symbol" }>;
type Fraction = Readonly<{ numerator: Expression; denominator: Expression }>;
export class CoordinateCalculationError extends Error {
  constructor(
    readonly code: "sr-coordinate-algebra-refused" | "sr-coordinate-calculation-refused",
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "CoordinateCalculationError";
  }
}
export type CoordinateAlgebraDomain = Readonly<{
  /** The selected outward transverse experiment has t,y,z ≥ 0. */
  positiveFlight?: boolean;
  /** Identically oriented axes and future clocks select the positive identity branch. */
  positiveScale?: boolean;
  /** Compare a nonzero x to determine a speed-only coefficient, not to exclude origin events. */
  nonzeroCoordinate?: boolean;
  /** The isotropy comparison uses a real rod of strictly positive proper length. */
  positiveRodLength?: boolean;
}>;
const symbol = (quantityId: string, suffix = "", fields: Partial<Symbol> = {}): Symbol => ({
  kind: "symbol",
  quantityId,
  termId: quantityId + suffix,
  ...fields,
});
const n = (value: string): Expression => ({ kind: "number", value });
const sum = (...values: Expression[]): Expression => {
  const args = values
    .flatMap((value) => (value.kind === "sum" ? value.args : [value]))
    .filter((value) => value.kind !== "number" || value.value !== "0");
  return args.length === 0 ? n("0") : args.length === 1 ? args[0]! : { kind: "sum", args };
};
const product = (...values: Expression[]): Expression => {
  const args = values
    .flatMap((value) => (value.kind === "product" ? value.args : [value]))
    .filter((value) => value.kind !== "number" || value.value !== "1");
  if (args.some((value) => value.kind === "number" && value.value === "0")) return n("0");
  return args.length === 0 ? n("1") : args.length === 1 ? args[0]! : { kind: "product", args };
};
const negative = (argument: Expression): Expression =>
  argument.kind === "number" && argument.value === "0" ? argument : { kind: "negate", argument };
const difference = (left: Expression, right: Expression): Expression => sum(left, negative(right));
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const power = (base: Expression, exponent: number): Expression =>
  exponent === 0 || (base.kind === "number" && base.value === "1")
    ? n("1")
    : exponent === 1
      ? base
      : { kind: "power", base, exponent: { num: exponent, den: 1 } };
const one = n("1");
const c = symbol("speedOfLight"),
  v = symbol("frameSpeed");
const t = symbol("coordinateTimeStationary"),
  x = symbol("coordinatePositionStationary");
const y = symbol("coordinatePositionStationary", ".y", { index: "y" });
const z = symbol("coordinatePositionStationary", ".z", { index: "z" });
const gamma = symbol("lorentzFactor");
const a = symbol("transformationCoefficientA");
const phi = symbol("scaleFactorUnknown", ".plus", { at: v });
const phiMinus = symbol("scaleFactorUnknown", ".minus", { at: negative(v) });
const length = symbol("lengthProper");
const radicand = difference(power(c, 2), power(v, 2));
const unitRadicand = difference(one, quotient(power(v, 2), power(c, 2)));
const width = symbol("coordinateRootWidth");
const same = (left: Expression, right: Expression): boolean => structurallyEqual(left, right);

export const coordinateAlgebraExpressions = {
  c,
  v,
  t,
  x,
  y,
  z,
  gamma,
  a,
  phi,
  phiMinus,
  radicand,
  unitRadicand,
} as const;

/** An unrecognized operation or divisor is refused, even when multiplied by zero. */
export function exactCoordinateIdentity(
  left: Expression,
  right: Expression,
  domain: CoordinateAlgebraDomain = {},
): Readonly<{ passed: boolean; reason: string }> {
  const atoms = new Map<string, Symbol>();
  let nodes = 0;
  const fail = (message: string): never => {
    throw new CoordinateCalculationError("sr-coordinate-algebra-refused", message);
  };
  const key = (value: unknown, depth = 0): string => {
    if (depth > 24) return fail("Coordinate atom identity exceeds its structural budget.");
    if (Array.isArray(value)) return `[${value.map((item) => key(item, depth + 1)).join(",")}]`;
    if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
    return `{${Object.entries(value)
      .filter(([name]) => name !== "opId")
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([name, item]) => `${JSON.stringify(name)}:${key(item, depth + 1)}`)
      .join(",")}}`;
  };
  const atom = (tree: Expression): Symbol => {
    const identity = key(tree);
    const previous = atoms.get(identity);
    if (previous) return previous;
    const value = symbol(`coordinateAtom${atoms.size}`);
    atoms.set(identity, value);
    return value;
  };
  const literalNonzero = (tree: Expression): boolean => {
    if (tree.kind !== "number") return false;
    const polynomial = exactPolynomial(tree);
    return polynomial.size === 1 && polynomial.get("[]")?.num !== 0n;
  };
  function nonzero(tree: Expression): boolean {
    if (literalNonzero(tree)) return true;
    if (
      [c, gamma, radicand, unitRadicand, difference(c, v), sum(c, v)].some((known) =>
        same(tree, known),
      )
    )
      return true;
    if (domain.positiveRodLength && same(tree, length)) return true;
    if (domain.positiveScale && [a, phi, phiMinus].some((known) => same(tree, known))) return true;
    if (domain.nonzeroCoordinate && same(tree, x)) return true;
    if (tree.kind === "root")
      return (
        tree.degree === 2 && [radicand, unitRadicand].some((known) => same(tree.radicand, known))
      );
    if (tree.kind === "group" || tree.kind === "negate") return nonzero(tree.argument);
    if (tree.kind === "product") return tree.args.length > 0 && tree.args.every(nonzero);
    if (tree.kind === "quotient") return nonzero(tree.numerator) && nonzero(tree.denominator);
    if (tree.kind === "power")
      return tree.exponent.den === 1 && tree.exponent.num >= 0 && nonzero(tree.base);
    return false;
  }
  function rootValue(tree: Extract<Expression, { kind: "root" }>): Expression {
    if (tree.degree !== 2)
      return fail("Only the declared positive square roots belong to this coordinate calculation.");
    if (same(tree.radicand, one)) return one;
    if (same(tree.radicand, radicand)) return width;
    if (same(tree.radicand, unitRadicand)) return quotient(width, c);
    for (const positive of [
      ...(domain.positiveFlight ? [t, y, z] : []),
      ...(domain.positiveScale ? [phi, phiMinus, a] : []),
    ]) {
      if (same(tree.radicand, power(positive, 2))) return positive;
      if (same(tree.radicand, quotient(power(positive, 2), radicand)))
        return quotient(positive, width);
    }
    return fail(
      "A root simplification lacks its specific nonnegative variable and positive-radicand premise.",
    );
  }
  const multiply = (first: Fraction, second: Fraction): Fraction => ({
    numerator: product(first.numerator, second.numerator),
    denominator: product(first.denominator, second.denominator),
  });
  const add = (first: Fraction, second: Fraction): Fraction =>
    same(first.denominator, second.denominator)
      ? { numerator: sum(first.numerator, second.numerator), denominator: first.denominator }
      : {
          numerator: sum(
            product(first.numerator, second.denominator),
            product(second.numerator, first.denominator),
          ),
          denominator: product(first.denominator, second.denominator),
        };
  function fraction(tree: Expression, depth = 0): Fraction {
    if (++nodes > 1024 || depth > 24)
      return fail("Coordinate arithmetic exceeds its structural budget.");
    if (same(tree, width)) return { numerator: width, denominator: one };
    switch (tree.kind) {
      case "number":
        exactPolynomial(tree);
        return { numerator: tree, denominator: one };
      case "symbol":
        if (same(tree, gamma)) return fraction(quotient(c, width), depth + 1);
        if (tree.args?.length)
          return fail(
            "A time-function application must first be reduced using the stated linear ansatz.",
          );
        return { numerator: atom(tree), denominator: one };
      case "derivative":
        if (
          tree.order !== 1 ||
          !tree.partial ||
          !same(tree.expression, symbol("coordinateTimeMoving")) ||
          ![symbol("auxiliaryGalileanCoordinate"), y, z, t].some((variable) =>
            same(tree.variable, variable),
          )
        )
          return fail(
            "Only the admitted linear time function's first partial derivatives are coefficient atoms.",
          );
        return { numerator: atom(tree), denominator: one };
      case "root":
        return fraction(rootValue(tree), depth + 1);
      case "group":
        return fraction(tree.argument, depth + 1);
      case "negate": {
        const result = fraction(tree.argument, depth + 1);
        return { ...result, numerator: negative(result.numerator) };
      }
      case "sum":
      case "product": {
        if (!tree.args.length || tree.args.length > 32)
          return fail("Coordinate arithmetic needs a bounded nonempty list of terms.");
        const values = tree.args.map((item) => fraction(item, depth + 1));
        return values.reduce(tree.kind === "sum" ? add : multiply);
      }
      case "quotient": {
        if (!same(tree.denominator, width) && !nonzero(tree.denominator))
          return fail("The divisor is not nonzero under this step's explicit coordinate premises.");
        const numerator = fraction(tree.numerator, depth + 1),
          denominator = fraction(tree.denominator, depth + 1);
        return {
          numerator: product(numerator.numerator, denominator.denominator),
          denominator: product(numerator.denominator, denominator.numerator),
        };
      }
      case "power": {
        if (
          tree.exponent.den !== 1 ||
          !Number.isSafeInteger(tree.exponent.num) ||
          tree.exponent.num < 0 ||
          tree.exponent.num > 8
        )
          return fail(
            "Only bounded nonnegative integer powers are supported by this coordinate field.",
          );
        const base = fraction(tree.base, depth + 1);
        return {
          numerator: power(base.numerator, tree.exponent.num),
          denominator: power(base.denominator, tree.exponent.num),
        };
      }
      default:
        return fail("This operation is outside the coordinate proof's exact algebra.");
    }
  }
  function reduceWidth(polynomial: Polynomial): Polynomial {
    if (polynomial.size > 64) return fail("Coordinate root reduction exceeds its monomial budget.");
    const squareWidth = fraction(radicand).numerator;
    return sumPolynomials(
      [...polynomial].map(([encoded, coefficient]) => {
        const factors = JSON.parse(encoded) as string[];
        const count = factors.filter((id) => id === width.quantityId).length;
        const ordinary = factors.filter((id) => id !== width.quantityId).map((id) => symbol(id));
        const reduced = product(
          ...ordinary,
          ...(count % 2 ? [width] : []),
          power(squareWidth, Math.floor(count / 2)),
        );
        return { polynomial: exactPolynomial(reduced), coefficient };
      }),
    );
  }
  try {
    const first = fraction(left),
      second = fraction(right);
    const residual = difference(
      product(first.numerator, second.denominator),
      product(second.numerator, first.denominator),
    );
    const reduced = reduceWidth(exactPolynomial(residual));
    return {
      passed: reduced.size === 0,
      reason:
        reduced.size === 0
          ? "Exact rational coefficients agree after w² = c² − v², on the declared positive-root domain."
          : "The displayed expressions have different exact coordinate-polynomial coefficients.",
    };
  } catch (error) {
    return {
      passed: false,
      reason:
        error instanceof Error
          ? error.message
          : "The expression is outside the coordinate proof's bounded algebra.",
    };
  }
}
