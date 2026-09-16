/**
 * erf/erfc via regularized incomplete gamma at a=1/2.
 * Formula sources: NIST DLMF 8.4.1, 8.7.1, 8.9.2.
 * https://dlmf.nist.gov/8.4.E1 https://dlmf.nist.gov/8.7.E1 https://dlmf.nist.gov/8.9.E2
 * Positive series below x=1.5; contracted continued fraction above it.
 * No empirical coefficients, copied library code, or subtraction from 1 in the tail.
 * Independent high-precision fixtures cover x through 26. Beyond 27, erfc
 * rounds to zero in binary64; that is numerical underflow, not a point mass.
 */
const INV_SQRT_PI = 1 / Math.sqrt(Math.PI);
function validate(x: number): void {
  if (!Number.isFinite(x)) throw new RangeError("erf/erfc require a finite argument");
}
function erfPositive(x: number): number {
  if (x === 0) return 0;
  const z = x * x;
  let term = 2;
  let sum = term;
  for (let n = 1; n <= 200; n++) {
    term *= z / (n + 0.5);
    sum += term;
    if (term <= sum * Number.EPSILON) return x * INV_SQRT_PI * Math.exp(-z) * sum;
  }
  throw new RangeError("erf series did not converge");
}
function erfcPositive(x: number): number {
  if (x < 1.5) return 1 - erfPositive(x);
  if (x > 27) return 0;
  const z = x * x;
  let b = z + 0.5;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 1000; i++) {
    const a = -i * (i - 0.5);
    b += 2;
    d = b + a * d;
    c = b + a / c;
    if (Math.abs(d) < 1e-300) d = d < 0 ? -1e-300 : 1e-300;
    if (Math.abs(c) < 1e-300) c = c < 0 ? -1e-300 : 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) <= 2 * Number.EPSILON) return x * INV_SQRT_PI * Math.exp(-z) * h;
  }
  throw new RangeError("erfc continued fraction did not converge");
}
export function erf(x: number): number {
  validate(x);
  if (x < 0) return -erf(-x);
  return x < 1.5 ? erfPositive(x) : 1 - erfcPositive(x);
}
export function erfc(x: number): number {
  validate(x);
  return x < 0 ? 2 - erfcPositive(-x) : erfcPositive(x);
}
