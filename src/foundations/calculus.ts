/**
 * Calculus foundations numerical evaluators and mathematical identities.
 *
 * Implements:
 * - Planck ratio h/e constant
 * - Logarithm properties and 1905 "lg" notation concordance
 * - Cancellation-free evaluation of the relativistic Lorentz factor (gamma - 1)
 * - Binomial expansion partial sums for (1 - x)^(-1/2) - 1
 *
 * Specification: AGENTS.md and am-found-calculus-6agg
 */

/** Planck-to-elementary-charge ratio h/e in V*s (or J*s/C) */
export const PLANCK_TO_ELEMENTARY_CHARGE_RATIO = 4.135667696e-15;

/** Natural logarithm of 2 */
export const LN_2 = Math.LN2; // 0.6931471805599453

/** Common logarithm (base 10) of 2 */
export const LOG10_2 = Math.LN10 !== 0 ? Math.log10(2) : 0.3010299956639812;

/**
 * Computes the logarithm power law: ln(f^n) = n * ln(f).
 */
export function logarithmPower(f: number, n: number): number {
  if (f <= 0) {
    throw new RangeError("Logarithm argument must be positive.");
  }
  return n * Math.log(f);
}

/**
 * Partial sums of the binomial expansion for (1 - x)^(-1/2) - 1
 * Series: (1 - x)^(-1/2) - 1 = 1/2*x + 3/8*x^2 + 5/16*x^3 + 35/128*x^4 + ...
 */
export interface BinomialGammaSums {
  x: number;
  exact: number;
  terms: readonly [number, number, number, number];
  partialSums: readonly [number, number, number, number];
}

export function binomialPartialSumsGamma(x: number): BinomialGammaSums {
  if (x < 0 || x >= 1) {
    throw new RangeError("x must be in [0, 1) for binomial expansion.");
  }
  const t1 = 0.5 * x;
  const t2 = (3 / 8) * x ** 2;
  const t3 = (5 / 16) * x ** 3;
  const t4 = (35 / 128) * x ** 4;

  const s1 = t1;
  const s2 = s1 + t2;
  const s3 = s2 + t3;
  const s4 = s3 + t4;

  const exact = 1 / Math.sqrt(1 - x) - 1;

  return {
    x,
    exact,
    terms: [t1, t2, t3, t4],
    partialSums: [s1, s2, s3, s4],
  };
}

/**
 * Cancellation-free evaluation of gamma - 1 = (1 - (v/c)^2)^(-1/2) - 1.
 * Uses expm1 and log1p to avoid catastrophic subtractive cancellation when v/c << 1.
 */
export function gammaMinusOneCancellationFree(vOverC: number): number {
  const x = vOverC * vOverC;
  if (x >= 1) {
    throw new RangeError("v/c must be strictly less than 1.");
  }
  // (1 - x)^(-1/2) - 1 = exp(-0.5 * ln(1 - x)) - 1 = expm1(-0.5 * log1p(-x))
  return Math.expm1(-0.5 * Math.log1p(-x));
}

/**
 * Naive floating-point evaluation of gamma - 1 = 1 / sqrt(1 - (v/c)^2) - 1.
 * Demonstrates catastrophic cancellation at low velocities (e.g. v/c = 1e-4).
 */
export function gammaMinusOneNaive(vOverC: number): number {
  const x = vOverC * vOverC;
  return 1 / Math.sqrt(1 - x) - 1;
}
