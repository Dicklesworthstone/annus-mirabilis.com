import { erfc } from "../special/erf.ts";
import { makeRefusal } from "../../../experiments/results/refusals.ts";
import type { Computation } from "./ftcs.ts";

const invalid = (): Computation<never> => ({ kind: "refused", refusal: makeRefusal("invalid-parameter", { capabilityId: "diffusion.statistics" }) });
const unconverged = (q: number, p: number, iterations: number): Computation<never> => ({ kind: "refused", refusal: makeRefusal("quantile-not-converged", { capabilityId: "diffusion.statistics" }, { details: { q, p, iterations } }) });
/** Tail-safe inversion of the existing independently checked complementary erf. */
export function normalQuantile(p: number): Computation<number> {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return invalid();
  if (p === 0.5) return { kind: "accepted", data: 0 };
  const tail = Math.min(p, 1 - p);
  let lo = 0, hi = 40;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (0.5 * erfc(mid / Math.SQRT2) > tail) lo = mid; else hi = mid;
  }
  return { kind: "accepted", data: (p < 0.5 ? -1 : 1) * ((lo + hi) / 2) };
}
/** Stirling expansion (DLMF 5.11.1), shifted to z>=16 before evaluation. */
function logGamma(a: number): number {
  let z = a, adjustment = 0;
  while (z < 16) { adjustment -= Math.log(z); z++; }
  const r = 1 / z, r2 = r * r;
  const correction = r * (1 / 12 + r2 * (-1 / 360 + r2 * (1 / 1260 + r2 * (-1 / 1680 + r2 * (1 / 1188 + r2 * (-691 / 360360))))));
  return adjustment + (z - 0.5) * Math.log(z) - z + 0.5 * Math.log(2 * Math.PI) + correction;
}
/** Regularized gamma P,Q via positive series / continued fraction (DLMF 8.7,8.9). */
function gammaPair(a: number, x: number): readonly [number, number] | null {
  if (x === 0) return [0, 1];
  const factor = Math.exp(a * Math.log(x) - x - logGamma(a));
  if (x < a + 1) {
    let term = 1 / a, sum = term;
    for (let i = 1; i <= 20000; i++) {
      term *= x / (a + i); sum += term;
      if (term <= sum * 2e-16) { const p = factor * sum; return [p, 1 - p]; }
    }
  } else {
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (let i = 1; i <= 20000; i++) {
      const an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const delta = d * c; h *= delta;
      if (Math.abs(delta - 1) <= 4e-16) { const q = factor * h; return [1 - q, q]; }
    }
  }
  return null;
}
/** Bounded inversion, with upper-tail comparisons that do not subtract from one. */
export function chiSquareQuantile(q: number, p: number, maxIterations = 512): Computation<number> {
  if (!Number.isFinite(q) || q < 0.5 || q > 10000 || !Number.isFinite(p) || p <= 0 || p >= 1 || !Number.isInteger(maxIterations) || maxIterations < 0 || maxIterations > 4096) return invalid();
  const lessThan = (x: number): boolean | null => {
    const pair = gammaPair(q / 2, x / 2);
    return pair === null ? null : p <= 0.5 ? pair[0] < p : pair[1] > 1 - p;
  };
  let lo = 0, hi = Math.max(1, q * 2);
  while (lessThan(hi) === true && hi < 1e8) hi *= 2;
  if (lessThan(hi) !== false) return unconverged(q, p, 0);
  for (let i = 0; i < maxIterations; i++) {
    const mid = lo + (hi - lo) / 2, below = lessThan(mid);
    if (below === null) return unconverged(q, p, i);
    if (below) lo = mid; else hi = mid;
    if (lo > 0 && hi - lo <= hi * 2e-13) return { kind: "accepted", data: lo + (hi - lo) / 2 };
  }
  return unconverged(q, p, maxIterations);
}
export type MomentBand = Readonly<{ alpha: number; meanHalfWidth: number; meanSquare: readonly [number, number]; totalMeanSquare: readonly [number, number]; label: "sampling band under the model" }>;
/** Model sampling bands: deliberately accepts no sampled displacements. */
export function ensembleMomentBands({ M, d, modelVariance, alphas }: { M: number; d: number; modelVariance: number; alphas: readonly number[] }): Computation<readonly MomentBand[]> {
  if (!Number.isInteger(M) || M < 2 || ![1, 2, 3].includes(d) || M * d > 10000 || !Number.isFinite(modelVariance) || modelVariance <= 0 || !Array.isArray(alphas) || alphas.length < 1 || alphas.length > 8 || alphas.some(a => !Number.isFinite(a) || a <= 0 || a >= 1)) return invalid();
  const bands: MomentBand[] = [];
  for (const alpha of alphas) {
    const z = normalQuantile(1 - alpha / 2), low = chiSquareQuantile(M, alpha / 2), high = chiSquareQuantile(M, 1 - alpha / 2);
    const totalLow = chiSquareQuantile(d * M, alpha / 2), totalHigh = chiSquareQuantile(d * M, 1 - alpha / 2);
    for (const result of [z, low, high, totalLow, totalHigh]) if (result.kind !== "accepted") return result;
    if (z.kind !== "accepted" || low.kind !== "accepted" || high.kind !== "accepted" || totalLow.kind !== "accepted" || totalHigh.kind !== "accepted") return invalid();
    const factor = modelVariance / M;
    const band: MomentBand = { alpha, meanHalfWidth: z.data * Math.sqrt(factor), meanSquare: [factor * low.data, factor * high.data], totalMeanSquare: [factor * totalLow.data, factor * totalHigh.data], label: "sampling band under the model" };
    if (![band.meanHalfWidth, ...band.meanSquare, ...band.totalMeanSquare].every(v => Number.isFinite(v) && v > 0)) return invalid();
    bands.push(Object.freeze(band));
  }
  return { kind: "accepted", data: Object.freeze(bands) };
}
