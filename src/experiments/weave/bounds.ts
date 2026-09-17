/**
 * The Dvoretzky-Kiefer-Wolfowitz bound (am-read-result-weave-jex). The evaluator computes only
 * this bound: it never computes normal or chi-square quantiles, never recomputes a sample
 * statistic, and never imports src/testing/ modules (see importBoundary.test.ts).
 */

/** sqrt(ln(2/alpha) / (2n)). The familiar asymptotic Kolmogorov critical values 1.36/sqrt(n)
 * and 1.63/sqrt(n) are this expression at alpha = 0.05 and 0.01. */
export function dkwBound(alpha: number, n: number): number {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new RangeError(`dkwBound: alpha must be in (0, 1), got ${alpha}.`);
  }
  if (!Number.isFinite(n) || n <= 0) {
    throw new RangeError(`dkwBound: n must be a positive finite sample size, got ${n}.`);
  }
  return Math.sqrt(Math.log(2 / alpha) / (2 * n));
}

/** The dkw bound plus an optional exact named offset (BM-05's Kolmogorov shape term: binomial
 * enumeration for the coin kernel, the Irwin-Hall form for the uniform kernel, 0 for Gaussian).
 * Adds exactly -- the offset is not itself derived here, only summed. */
export function dkwBoundWithOffset(alpha: number, n: number, offset: number): number {
  if (!Number.isFinite(offset)) {
    throw new RangeError(`dkwBoundWithOffset: offset must be finite, got ${offset}.`);
  }
  return dkwBound(alpha, n) + offset;
}
