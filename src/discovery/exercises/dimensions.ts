/**
 * Dimension feedback for the exercise checker (am-disc-exercise-checker-i4h2): when an exercise's
 * variables declare dimensions, a reader's expression is checked with the site's exact
 * rational-exponent dimensions (src/content/dimensions/rational.ts) before any numeric comparison,
 * and a mismatch is said in words. Functions other than sqrt and abs need a dimensionless argument;
 * sqrt halves every exponent exactly.
 *
 * Three outcomes, and the third matters: "unknown" is returned when the dimension cannot be fixed
 * from the expression alone, a power with a symbolic exponent for instance. The checker then falls
 * back to the numeric comparison rather than blaming the reader for its own limit. Nothing throws.
 */
import {
  combine,
  DIMENSIONLESS,
  type Dimension,
  dimension,
  isDimensionless,
  power,
  type Rational,
  rational,
  sameDimension,
} from "../../content/dimensions/rational.ts";
import type { Expr } from "./grammar.ts";

export type DimensionResult =
  | { readonly kind: "known"; readonly dimension: Dimension }
  | { readonly kind: "unknown" }
  | { readonly kind: "refused"; readonly message: string };

/** Names for the dimensions an exercise is likely to meet, keyed by their six exponents. */
const NAMED: Readonly<Record<string, string>> = {
  "0,0,0,0,0,0": "a pure number",
  "1,0,0,0,0,0": "a length",
  "2,0,0,0,0,0": "an area",
  "3,0,0,0,0,0": "a volume",
  "0,0,1,0,0,0": "a time",
  "0,0,-1,0,0,0": "a frequency",
  "0,1,0,0,0,0": "a mass",
  "1,0,-1,0,0,0": "a speed",
  "2,0,-2,0,0,0": "a speed squared",
  "1,0,-2,0,0,0": "an acceleration",
  "2,0,-1,0,0,0": "an area per unit time, the dimension of a diffusion coefficient",
  "1,1,-1,0,0,0": "a momentum",
  "1,1,-2,0,0,0": "a force",
  "2,1,-2,0,0,0": "an energy",
  "0,0,0,1,0,0": "a temperature",
};

const key = (d: Dimension) =>
  d.map((r) => (r.den === 1n ? String(r.num) : `${r.num}/${r.den}`)).join(",");

/** SI base units in the order a unit is usually written, kg·m²·s⁻², with the index of each in a Dimension. */
const UNITS: readonly (readonly [number, string])[] = [
  [1, "kg"],
  [0, "m"],
  [2, "s"],
  [3, "K"],
  [4, "A"],
  [5, "mol"],
];
const SUPERSCRIPT: Readonly<Record<string, string>> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/**
 * A dimension in words: "an area", or, when it has no common name, the SI units a reader would
 * measure it in, "a quantity in kg·m²". Units read more plainly than exponent lists such as
 * "length^2 · mass", and a fractional exponent keeps its fraction: "m^(1/2)".
 */
export function describeDimension(d: Dimension): string {
  const named = NAMED[key(d)];
  if (named) return named;
  const parts = UNITS.map(([i, unit]) => {
    const r = d[i];
    if (!r || r.num === 0n) return "";
    if (r.den !== 1n) return `${unit}^(${r.num}/${r.den})`;
    if (r.num === 1n) return unit;
    return `${unit}${[...String(r.num)].map((c) => SUPERSCRIPT[c] ?? c).join("")}`;
  }).filter(Boolean);
  return `a quantity in ${parts.join("·")}`;
}

/** An exponent written as a plain number, a negated one, or a quotient of two, as a fraction. */
function exponentOf(expr: Expr): Rational | null {
  if (expr.kind === "number") {
    for (const den of [1, 2, 3, 4, 6]) {
      const num = expr.value * den;
      if (Number.isInteger(num)) return rational(BigInt(num), BigInt(den));
    }
    return null;
  }
  if (expr.kind === "unary") {
    const inner = exponentOf(expr.operand);
    return inner ? rational(-inner.num, inner.den) : null;
  }
  if (expr.kind === "binary" && expr.op === "/") {
    const top = exponentOf(expr.left);
    const bottom = exponentOf(expr.right);
    if (!top || !bottom || bottom.num === 0n) return null;
    return rational(top.num * bottom.den, top.den * bottom.num);
  }
  return null;
}

const FUNCTION_WORDS: Readonly<Record<string, string>> = {
  exp: "an exponential",
  ln: "a logarithm",
  sin: "a sine",
  cos: "a cosine",
};

/** The dimension of an expression, given each variable's dimension. */
export function dimensionOf(
  expr: Expr,
  dimensions: Readonly<Record<string, Dimension>>,
): DimensionResult {
  switch (expr.kind) {
    case "number":
      return { kind: "known", dimension: DIMENSIONLESS };
    case "identifier": {
      if (expr.name === "pi") return { kind: "known", dimension: DIMENSIONLESS };
      const d = dimensions[expr.name];
      return d ? { kind: "known", dimension: d } : { kind: "unknown" };
    }
    case "unary":
      return dimensionOf(expr.operand, dimensions);
    case "call": {
      const inner = dimensionOf(expr.arg, dimensions);
      if (inner.kind !== "known") return inner;
      if (expr.name === "sqrt")
        return { kind: "known", dimension: power(inner.dimension, rational(1n, 2n)) };
      if (expr.name === "abs") return inner;
      if (!isDimensionless(inner.dimension))
        return {
          kind: "refused",
          message: `The quantity inside ${FUNCTION_WORDS[expr.name] ?? expr.name} must be a pure number, but here it is ${describeDimension(inner.dimension)}.`,
        };
      return { kind: "known", dimension: DIMENSIONLESS };
    }
    case "binary": {
      const left = dimensionOf(expr.left, dimensions);
      if (left.kind === "refused") return left;
      if (expr.op === "^") {
        if (left.kind !== "known") return left;
        const exponent = exponentOf(expr.right);
        const exponentDimension = dimensionOf(expr.right, dimensions);
        if (exponentDimension.kind === "refused") return exponentDimension;
        if (exponentDimension.kind === "known" && !isDimensionless(exponentDimension.dimension))
          return {
            kind: "refused",
            message: `A power must be a pure number, but here it is ${describeDimension(exponentDimension.dimension)}.`,
          };
        if (isDimensionless(left.dimension)) return { kind: "known", dimension: DIMENSIONLESS };
        return exponent
          ? { kind: "known", dimension: power(left.dimension, exponent) }
          : { kind: "unknown" };
      }
      const right = dimensionOf(expr.right, dimensions);
      if (right.kind === "refused") return right;
      if (left.kind !== "known" || right.kind !== "known") return { kind: "unknown" };
      if (expr.op === "*")
        return { kind: "known", dimension: combine(left.dimension, right.dimension, 1) };
      if (expr.op === "/")
        return { kind: "known", dimension: combine(left.dimension, right.dimension, -1) };
      if (!sameDimension(left.dimension, right.dimension))
        return {
          kind: "refused",
          message: `Your expression ${expr.op === "+" ? "adds" : "subtracts"} ${describeDimension(right.dimension)} ${expr.op === "+" ? "to" : "from"} ${describeDimension(left.dimension)}, and quantities of different dimensions cannot be added or subtracted.`,
        };
      return left;
    }
  }
}

/**
 * Compares the reader's expression with the reference's dimension. Returns null when they agree or
 * when either cannot be fixed, and a sentence when the reader's expression is wrong in dimension.
 */
export function dimensionMessage(
  reader: Expr,
  reference: Expr,
  dimensions: Readonly<Record<string, Dimension>>,
): string | null {
  const expected = dimensionOf(reference, dimensions);
  if (expected.kind !== "known") return null;
  const actual = dimensionOf(reader, dimensions);
  if (actual.kind === "refused") return actual.message;
  if (actual.kind === "unknown") return null;
  if (sameDimension(actual.dimension, expected.dimension)) return null;
  return `Your expression has the dimension of ${describeDimension(actual.dimension)}; the quantity asked for is ${describeDimension(expected.dimension)}.`;
}

/**
 * Reads an exercise's declared dimensions, six exponents each as in content/quantities, for exactly
 * the named variables. Returns null for a malformed or incomplete map, and the checker then skips
 * the dimension check: a mis-authored map turns the pre-check off, and never breaks the exercise.
 */
export function readDimensions(
  raw: unknown,
  variables: readonly string[],
): Readonly<Record<string, Dimension>> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  const names = new Set(entries.map(([name]) => name));
  if (names.size !== variables.length || variables.some((v) => !names.has(v))) return null;
  const parsed: [string, Dimension][] = [];
  for (const [name, values] of entries) {
    if (!Array.isArray(values) || values.length !== 6 || values.some((v) => typeof v !== "string"))
      return null;
    try {
      parsed.push([name, dimension(values as string[])]);
    } catch {
      return null;
    }
  }
  return Object.freeze(Object.fromEntries(parsed));
}
