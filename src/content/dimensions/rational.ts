/** Exact expression dimensions in the pinned fs-qty order; no floating exponents. */
export const DIMENSION_BASIS = ["length", "mass", "time", "temperature", "current", "amount"] as const;
export type Rational = Readonly<{ num: bigint; den: bigint }>;
export type Dimension = readonly Rational[];
export function rational(num: bigint, den = 1n): Rational {
  if (den === 0n) throw new RangeError("A rational denominator cannot be zero.");
  if (den < 0n) { num = -num; den = -den; }
  let a = num < 0n ? -num : num, b = den;
  while (b) { const r = a % b; a = b; b = r; }
  return Object.freeze({ num: num / a, den: den / a });
}
export function parseRational(text: string): Rational {
  if (!/^-?(?:0|[1-9]\d*)(?:\/[1-9]\d*)?$/.test(text) || text.length > 160) throw new TypeError("Invalid exact rational.");
  const [num, den = "1"] = text.split("/"); return rational(BigInt(num!), BigInt(den));
}
export const add = (a: Rational, b: Rational) => rational(a.num * b.den + b.num * a.den, a.den * b.den);
export const multiply = (a: Rational, b: Rational) => rational(a.num * b.num, a.den * b.den);
export function dimension(values: readonly string[]): Dimension {
  if (values.length !== DIMENSION_BASIS.length) throw new TypeError("A dimension needs all six exponents.");
  return Object.freeze(values.map(parseRational));
}
export const DIMENSIONLESS = dimension(["0", "0", "0", "0", "0", "0"]);
export function combine(a: Dimension, b: Dimension, sign: 1 | -1 = 1): Dimension {
  return Object.freeze(a.map((v, i) => add(v, multiply(b[i]!, rational(BigInt(sign))))));
}
export const power = (d: Dimension, e: Rational): Dimension => Object.freeze(d.map(v => multiply(v, e)));
export const sameDimension = (a: Dimension, b: Dimension): boolean => a.length === b.length && a.every((v, i) => v.num === b[i]!.num && v.den === b[i]!.den);
export const dimensionText = (d: Dimension): string => d.map(v => v.den === 1n ? String(v.num) : `${v.num}/${v.den}`).join(",");
export function runtimeDimension(d: Dimension): readonly number[] {
  if (d.length !== 6 || d.some(v => v.den !== 1n || v.num < -128n || v.num > 127n)) throw new RangeError("Runtime dimensions require six integer SI exponents in the i8 range.");
  return Object.freeze(d.map(v => Number(v.num)));
}
