/**
 * Exact Laurent polynomials in declared positive quantities and their logarithms.
 * This small vocabulary proves the Wien antiderivative and its one-sided boundary;
 * it is not a numerical sampler or a general symbolic integrator. Logarithms only
 * admit positive monomials, and denominators only nonzero monomials. Log expansion
 * is internal algebra on values in fixed units, never a rendered dimensional log.
 */
import {
  add,
  divide,
  multiply,
  type Rational,
  rational,
} from "../../content/dimensions/rational.ts";
import { children, type Expression, record } from "../ast.ts";
import { equalPolynomials, exactPolynomial } from "./exactPolynomial.ts";
import { structurallyEqual } from "./treeUtils.ts";

type Symbol = Extract<Expression, { kind: "symbol" }>;
type Powers = readonly (readonly [number, number])[];
type LogPolynomial = ReadonlyMap<string, Rational>;
const ZERO = rational(0n);
const ONE = rational(1n);
const LIMITS = { nodes: 512, terms: 256, work: 32768, power: 32, bits: 4096 } as const;

export class LogarithmicCalculusRefusal extends Error {
  readonly code = "logarithmic-calculus-unsupported";
  constructor(message: string) {
    super(message);
    this.name = "LogarithmicCalculusRefusal";
  }
}
function refuse(message: string): never {
  throw new LogarithmicCalculusRefusal(message);
}

/** Every symbol is explicitly either positive or a parameter held fixed in the calculation. */
export function logarithmicCalculus(domain: Readonly<{
  positive: readonly Symbol[];
  constants?: readonly Symbol[];
}>) {
  const positiveSymbols = [...domain.positive];
  const symbols = [...positiveSymbols, ...(domain.constants ?? [])];
  if (symbols.length === 0 || symbols.length > 24)
    refuse("Declare a bounded, nonempty symbol domain.");
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i]!;
    if (symbols.slice(0, i).some((other) => structurallyEqual(symbol, other)))
      refuse("A symbol cannot be declared twice in the logarithmic domain.");
    record(symbol, "logarithmic.symbol", ["kind", "termId", "quantityId"], ["at", "index"]);
    if (symbol.kind !== "symbol") refuse("The domain must consist of unscaled bound symbols.");
  }
  const blank = (): [number, number][] => symbols.map(() => [0, 0]);
  const scalarKey = JSON.stringify(blank());
  let work = 0;
  function bounded(value: Rational): Rational {
    if (
      ++work > LIMITS.work ||
      value.num.toString(2).length > LIMITS.bits ||
      value.den.toString(2).length > LIMITS.bits
    )
      refuse("Exact logarithmic arithmetic exceeds its work or coefficient budget.");
    return value;
  }
  function key(powers: Powers): string {
    if (
      powers.some(([power, logarithm]) =>
        !Number.isSafeInteger(power) || Math.abs(power) > LIMITS.power ||
        !Number.isSafeInteger(logarithm) || logarithm < 0 || logarithm > LIMITS.power,
      )
    )
      refuse("Logarithmic powers exceed the finite vocabulary.");
    return JSON.stringify(powers);
  }
  function put(result: Map<string, Rational>, powers: string, value: Rational): void {
    const next = bounded(add(result.get(powers) ?? ZERO, value));
    if (next.num === 0n) result.delete(powers);
    else result.set(powers, next);
    if (result.size > LIMITS.terms) refuse("Logarithmic polynomial exceeds its term budget.");
  }
  const scalar = (value: Rational): LogPolynomial =>
    value.num === 0n ? new Map() : new Map([[scalarKey, bounded(value)]]);
  function plus(left: LogPolynomial, right: LogPolynomial, sign = 1): LogPolynomial {
    const result = new Map(left);
    for (const [powers, value] of right)
      put(result, powers, multiply(value, rational(BigInt(sign))));
    return result;
  }
  function times(left: LogPolynomial, right: LogPolynomial): LogPolynomial {
    const result = new Map<string, Rational>();
    for (const [aKey, a] of left)
      for (const [bKey, b] of right) {
        const ap = JSON.parse(aKey) as Powers;
        const bp = JSON.parse(bKey) as Powers;
        const combined = ap.map(([power, logarithm], i) =>
          [power + bp[i]![0], logarithm + bp[i]![1]] as const,
        );
        put(result, key(combined), multiply(a, b));
      }
    return result;
  }
  function positiveMonomial(polynomial: LogPolynomial) {
    if (polynomial.size !== 1) refuse("Only a single positive monomial is admitted here.");
    const [entry] = polynomial;
    if (!entry) return refuse("A zero monomial cannot be positive.");
    const powers = JSON.parse(entry[0]) as Powers;
    if (
      entry[1].num <= 0n ||
      powers.some(([power, logarithm], i) => logarithm !== 0 ||
        (power !== 0 && i >= positiveSymbols.length))
    )
      refuse("A denominator or logarithm requires explicitly positive quantities.");
    return { powers, coefficient: entry[1] };
  }
  function parse(expression: Expression): LogPolynomial {
    let nodes = 0;
    function visit(node: Expression, depth: number): LogPolynomial {
      if (++nodes > LIMITS.nodes || depth > 24)
        refuse("Logarithmic expression exceeds its structural budget.");
      switch (node.kind) {
        case "number": {
          const value = exactPolynomial(node).get("[]") ?? ZERO;
          return scalar(value);
        }
        case "symbol": {
          const index = symbols.findIndex((candidate) => structurallyEqual(node, candidate));
          if (index < 0) refuse("The expression uses an undeclared or differently bound symbol.");
          const powers = blank();
          powers[index] = [1, 0];
          return new Map([[key(powers), ONE]]);
        }
        case "group":
          return visit(node.argument, depth + 1);
        case "negate":
          return times(scalar(rational(-1n)), visit(node.argument, depth + 1));
        case "sum":
        case "product": {
          if (node.args.length === 0 || node.args.length > 32)
            refuse("Expected a bounded, nonempty list of operands.");
          // Parse every factor before reducing: multiplying by zero never hides an invalid domain.
          const parts = node.args.map((part) => visit(part, depth + 1));
          return node.kind === "sum"
            ? parts.reduce((result, part) => plus(result, part), scalar(ZERO))
            : parts.reduce(times, scalar(ONE));
        }
        case "quotient": {
          const numerator = visit(node.numerator, depth + 1);
          const denominator = positiveMonomial(visit(node.denominator, depth + 1));
          const inverse = new Map([[key(denominator.powers.map(([p]) => [-p, 0])),
            divide(ONE, denominator.coefficient)]]);
          return times(numerator, inverse);
        }
        case "power": {
          if (node.exponent.den !== 1 || !Number.isSafeInteger(node.exponent.num) ||
              node.exponent.num < 0 || node.exponent.num > 16)
            refuse("Only bounded nonnegative integer powers are admitted.");
          const base = visit(node.base, depth + 1);
          let result = scalar(ONE);
          for (let i = 0; i < node.exponent.num; i++) result = times(result, base);
          return result;
        }
        case "function": {
          if (node.name !== "ln") refuse("Only monomial natural logarithms are admitted.");
          const argument = positiveMonomial(visit(node.argument, depth + 1));
          if (argument.coefficient.num !== argument.coefficient.den)
            refuse("Logarithms of numeric coefficients need a separate identity.");
          const result = new Map<string, Rational>();
          argument.powers.forEach(([power], i) => {
            if (power === 0) return;
            const powers = blank();
            powers[i] = [0, 1];
            put(result, key(powers), rational(BigInt(power)));
          });
          return result;
        }
        default:
          return refuse("The operation is outside the exact logarithmic vocabulary.");
      }
    }
    return visit(expression, 0);
  }
  function variableIndex(variable: Symbol): number {
    const index = positiveSymbols.findIndex((candidate) => structurallyEqual(variable, candidate));
    if (index < 0) refuse("The calculus variable must be an explicitly positive symbol.");
    // A parameter evaluated at this variable is a function, not a free constant.
    let nodes = 0;
    const depends = (node: Expression, depth = 0): boolean => {
      if (++nodes > LIMITS.nodes || depth > 24)
        refuse("A parameter's dependence exceeds the structural budget.");
      return structurallyEqual(node, variable) ||
        children(node).some((child) => depends(child, depth + 1));
    };
    if (symbols.some((symbol, i) => i !== index && symbol.at && depends(symbol.at)))
      refuse("A declared parameter depends on the differentiation variable.");
    return index;
  }
  function derivative(polynomial: LogPolynomial, variable: number): LogPolynomial {
    const result = new Map<string, Rational>();
    for (const [powersKey, coefficient] of polynomial) {
      const powers = JSON.parse(powersKey) as [number, number][];
      const [power, logarithm] = powers[variable]!;
      if (power !== 0) {
        const next = powers.map(([p, l]) => [p, l] as [number, number]);
        next[variable] = [power - 1, logarithm];
        put(result, key(next), multiply(coefficient, rational(BigInt(power))));
      }
      if (logarithm !== 0) {
        const next = powers.map(([p, l]) => [p, l] as [number, number]);
        next[variable] = [power - 1, logarithm - 1];
        put(result, key(next), multiply(coefficient, rational(BigInt(logarithm))));
      }
    }
    return result;
  }
  function limitAtZero(polynomial: LogPolynomial, variable: number): LogPolynomial {
    const result = new Map<string, Rational>();
    for (const [powersKey, coefficient] of polynomial) {
      const [power, logarithm] = (JSON.parse(powersKey) as Powers)[variable]!;
      // For integer p > 0 and finite k, x^p (ln x)^k tends to zero as x -> 0+.
      // Put x = exp(-t): exponential decay dominates the polynomial t^k.
      if (power > 0) continue;
      if (power < 0 || logarithm !== 0)
        refuse("The one-sided zero limit is not finite in the admitted logarithmic form.");
      put(result, powersKey, coefficient);
    }
    return result;
  }
  return Object.freeze({
    equal(left: Expression, right: Expression): boolean {
      work = 0;
      return equalPolynomials(parse(left), parse(right));
    },
    differentiatesTo(antiderivative: Expression, variable: Symbol, slope: Expression): boolean {
      work = 0;
      const index = variableIndex(variable);
      return equalPolynomials(derivative(parse(antiderivative), index), parse(slope));
    },
    tendsToAtZero(expression: Expression, variable: Symbol, expected: Expression): boolean {
      work = 0;
      const index = variableIndex(variable);
      return equalPolynomials(limitAtZero(parse(expression), index), parse(expected));
    },
  });
}
