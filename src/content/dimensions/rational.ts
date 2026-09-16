/**
 * Exact rational-exponent dimension arithmetic over the six-slot basis.
 *
 * Preserves roots (1/2, 1/3, etc.) and large fractions without floating-point rounding.
 * Basis order matches upstream fs-qty Dims([i8; 6]): length, mass, time, temperature, current, amount.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md ("Precision and tolerance", §11.5).
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-dimension-validator-aoz
 */

import { DIMENSION_BASIS } from "./dimensionBasis.ts";

export { DIMENSION_BASIS };

export type Rational = Readonly<{ num: bigint; den: bigint }>;
export type Dimension = readonly Rational[];

/**
 * Creates a canonical rational number in lowest terms with a positive denominator.
 */
export function rational(num: bigint, den = 1n): Rational {
  if (den === 0n) {
    throw new RangeError("A rational denominator cannot be zero.");
  }
  let n = num;
  let d = den;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  let a = n < 0n ? -n : n;
  let b = d;
  while (b !== 0n) {
    const r = a % b;
    a = b;
    b = r;
  }
  const gcd = a === 0n ? 1n : a;
  return Object.freeze({ num: n / gcd, den: d / gcd });
}

/**
 * Parses an exact rational string (e.g. "0", "1", "-2", "1/2", "-3/7").
 */
export function parseRational(text: string): Rational {
  const trimmed = text.trim();
  if (!/^-?(?:0|[1-9]\d*)(?:\/[1-9]\d*)?$/.test(trimmed) || trimmed.length > 160) {
    throw new TypeError(`Invalid exact rational '${text}'.`);
  }
  const [numStr, denStr = "1"] = trimmed.split("/");
  return rational(BigInt(numStr!), BigInt(denStr));
}

export const add = (a: Rational, b: Rational): Rational =>
  rational(a.num * b.den + b.num * a.den, a.den * b.den);

export const subtract = (a: Rational, b: Rational): Rational =>
  rational(a.num * b.den - b.num * a.den, a.den * b.den);

export const multiply = (a: Rational, b: Rational): Rational =>
  rational(a.num * b.num, a.den * b.den);

export const divide = (a: Rational, b: Rational): Rational => {
  if (b.num === 0n) {
    throw new RangeError("Division by a zero rational is refused.");
  }
  return rational(a.num * b.den, a.den * b.num);
};

export const negate = (a: Rational): Rational => rational(-a.num, a.den);

/**
 * Constructs a 6-element Dimension vector from string exponents or Rational objects.
 */
export function dimension(values: readonly (string | Rational)[]): Dimension {
  if (values.length !== DIMENSION_BASIS.length) {
    throw new TypeError(
      `A dimension vector requires exactly ${DIMENSION_BASIS.length} exponents, got ${values.length}.`,
    );
  }
  return Object.freeze(
    values.map((v) => (typeof v === "string" ? parseRational(v) : rational(v.num, v.den))),
  );
}

export const DIMENSIONLESS: Dimension = dimension(["0", "0", "0", "0", "0", "0"]);

/**
 * Combines two dimension vectors: a + b (sign = 1) or a - b (sign = -1).
 */
export function combine(a: Dimension, b: Dimension, sign: 1 | -1 = 1): Dimension {
  if (a.length !== DIMENSION_BASIS.length || b.length !== DIMENSION_BASIS.length) {
    throw new TypeError("Dimension vectors must have length 6.");
  }
  return Object.freeze(a.map((v, i) => add(v, multiply(b[i]!, rational(BigInt(sign))))));
}

/**
 * Scales all exponents of a dimension vector by a rational power exponent.
 */
export function power(d: Dimension, e: Rational): Dimension {
  return Object.freeze(d.map((v) => multiply(v, e)));
}

/**
 * Checks exact equality between two dimension vectors across all 6 slots.
 */
export function sameDimension(a: Dimension, b: Dimension): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v.num === b[i]!.num && v.den === b[i]!.den);
}

/**
 * Returns true if all 6 exponents are zero.
 */
export function isDimensionless(d: Dimension): boolean {
  return d.every((v) => v.num === 0n);
}

/**
 * Formats a dimension vector as comma-separated rational strings (e.g. "1,0,-2,0,0,0" or "1/2,1/2,-1,0,0,0").
 */
export function dimensionText(d: Dimension): string {
  return d.map((v) => (v.den === 1n ? String(v.num) : `${v.num}/${v.den}`)).join(",");
}

/**
 * Converts a dimension vector to 6 integer SI exponents for runtime fs-qty interop.
 * Refuses fractional exponents (e.g. 1/2) or non-i8 ranges.
 */
export function runtimeDimension(d: Dimension): readonly number[] {
  if (d.length !== 6 || d.some((v) => v.den !== 1n || v.num < -128n || v.num > 127n)) {
    throw new RangeError(
      "Runtime dimensions require six integer SI exponents in the i8 range [-128, 127]. Fractional exponents cannot be mapped.",
    );
  }
  return Object.freeze(d.map((v) => Number(v.num)));
}
