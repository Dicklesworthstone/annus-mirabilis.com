import type { ExecutionOutcome } from "../../../experiments/results/outcomes.ts";
import { makeRefusal, type RequestRefusal } from "../../../experiments/results/refusals.ts";
import type { ScientificResult } from "../../../experiments/results/types.ts";
import type { Computation } from "./ftcs.ts";

const invalid = (): Computation<never> => ({
  kind: "refused",
  refusal: makeRefusal("invalid-parameter", { capabilityId: "diffusion.statistics" }),
});
const unconverged = (q: number, p: number, iterations: number): Computation<never> => ({
  kind: "refused",
  refusal: makeRefusal(
    "quantile-not-converged",
    { capabilityId: "diffusion.statistics" },
    { details: { q, p, iterations } },
  ),
});
// Wichura Algorithm AS 241 double-precision coefficients (Applied Statistics 37 (1988) 477-484)
const AS241_A = [
  3.387132872796366608, 1.3314166789178437745e2, 1.9715909503065514427e3,
  1.3731693765509461125e4, 4.5921953931549871457e4, 6.7265770927008700853e4,
  3.3430575583588128105e4, 2.5090809287301226727e3,
] as const;
const AS241_B = [
  1.0, 4.2313330701600911252e1, 6.871870074920579083e2, 5.3941960214247511077e3,
  2.1213794301586595867e4, 3.930789580009271061e4, 2.8729085735721942674e4,
  5.226495278852854561e3,
] as const;
const AS241_C = [
  1.42343711074968357734, 4.6303378461565452959, 5.7694972214606914055,
  3.64784832476320460504, 1.27045825245236838258, 2.4178072517745061177e-1,
  2.27238449892691845833e-2, 7.7454501427834140764e-4,
] as const;
const AS241_D = [
  1.0, 2.05319162663775882187, 1.6763848301838038494, 6.8976733498510000455e-1,
  1.4810397642748007459e-1, 1.51986665636164571966e-2, 5.475938084995344946e-4,
  1.05075007164441684324e-9,
] as const;
const AS241_E = [
  6.6579046435011037772, 5.4637849111641143699, 1.7848265399172913358,
  2.9656057182850489123e-1, 2.6532189526576123093e-2, 1.2426609473880784386e-3,
  2.71155556874348757815e-5, 2.01033439929228813265e-7,
] as const;
const AS241_F = [
  1.0, 5.9983220655588793769e-1, 1.3692988092273580531e-1,
  1.48753612908506148525e-2, 7.868691311456132591e-4, 1.8463183175100546818e-5,
  1.4215117583164458887e-7, 2.04426310338993978564e-15,
] as const;

function evaluatePolynomial(coeffs: readonly number[], x: number): number {
  let val = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    val = val * x + (coeffs[i] ?? 0);
  }
  return val;
}

/** Standard normal quantile via Wichura's AS 241 rational approximation. */
export function normalQuantile(p: number): Computation<number> {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return invalid();
  if (p === 0.5) return { kind: "accepted", data: 0 };
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    const val = q * (evaluatePolynomial(AS241_A, r) / evaluatePolynomial(AS241_B, r));
    return { kind: "accepted", data: val };
  }
  const r = q < 0 ? p : 1 - p;
  const s = Math.sqrt(-Math.log(r));
  let val: number;
  if (s <= 5.0) {
    const t = s - 1.6;
    val = evaluatePolynomial(AS241_C, t) / evaluatePolynomial(AS241_D, t);
  } else {
    const t = s - 5.0;
    val = evaluatePolynomial(AS241_E, t) / evaluatePolynomial(AS241_F, t);
  }
  return { kind: "accepted", data: q < 0 ? -val : val };
}
/** Stirling expansion (DLMF 5.11.1), shifted to z>=16 before evaluation. */
function logGamma(a: number): number {
  let z = a,
    adjustment = 0;
  while (z < 16) {
    adjustment -= Math.log(z);
    z++;
  }
  const r = 1 / z,
    r2 = r * r;
  const correction =
    r *
    (1 / 12 +
      r2 *
        (-1 / 360 + r2 * (1 / 1260 + r2 * (-1 / 1680 + r2 * (1 / 1188 + r2 * (-691 / 360360))))));
  return adjustment + (z - 0.5) * Math.log(z) - z + 0.5 * Math.log(2 * Math.PI) + correction;
}
/** Regularized gamma P,Q via positive series / continued fraction (DLMF 8.7,8.9). */
function gammaPair(a: number, x: number): readonly [number, number] | null {
  if (x === 0) return [0, 1];
  const factor = Math.exp(a * Math.log(x) - x - logGamma(a));
  if (x < a + 1) {
    let term = 1 / a,
      sum = term;
    for (let i = 1; i <= 20000; i++) {
      term *= x / (a + i);
      sum += term;
      if (term <= sum * 2e-16) {
        const p = factor * sum;
        return [p, 1 - p];
      }
    }
  } else {
    let b = x + 1 - a,
      c = 1e300,
      d = 1 / b,
      h = d;
    for (let i = 1; i <= 20000; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) <= 4e-16) {
        const q = factor * h;
        return [1 - q, q];
      }
    }
  }
  return null;
}
/** Bounded inversion, with upper-tail comparisons that do not subtract from one. */
export function chiSquareQuantile(q: number, p: number, maxIterations = 512): Computation<number> {
  if (
    !Number.isFinite(q) ||
    q < 0.5 ||
    q > 10000 ||
    !Number.isFinite(p) ||
    p <= 0 ||
    p >= 1 ||
    !Number.isInteger(maxIterations) ||
    maxIterations < 0 ||
    maxIterations > 4096
  )
    return invalid();
  const lessThan = (x: number): boolean | null => {
    const pair = gammaPair(q / 2, x / 2);
    return pair === null ? null : p <= 0.5 ? pair[0] < p : pair[1] > 1 - p;
  };
  let lo = 0,
    hi = Math.max(1, q * 2);
  while (lessThan(hi) === true && hi < 1e8) hi *= 2;
  if (lessThan(hi) !== false) return unconverged(q, p, 0);
  for (let i = 0; i < maxIterations; i++) {
    const mid = lo + (hi - lo) / 2,
      below = lessThan(mid);
    if (below === null) return unconverged(q, p, i);
    if (below) lo = mid;
    else hi = mid;
    if (lo > 0 && hi - lo <= hi * 2e-13) return { kind: "accepted", data: lo + (hi - lo) / 2 };
  }
  return unconverged(q, p, maxIterations);
}
export type MomentBand = Readonly<{
  alpha: number;
  meanHalfWidth: number;
  meanSquare: readonly [number, number];
  totalMeanSquare: readonly [number, number];
  label: "sampling band under the model";
}>;

export type EnsembleMomentBandsResult = Readonly<
  | { kind: "accepted"; data: readonly MomentBand[] }
  | { kind: "refused"; refusal: RequestRefusal }
  | { kind: "outcome"; outcome: ExecutionOutcome }
  | {
      kind: "underdetermined";
      status: "underdetermined";
      quantityId: string;
      unit: string;
      semanticKind: string;
      ownerId: string;
      compatibleFamily: string;
      neededInformation: readonly string[];
      reason: string;
    }
  | {
      kind: "outside-domain";
      status: "outside-domain";
      domainKind: "model" | "input";
      quantityId: string;
      unit: string;
      semanticKind: string;
      ownerId: string;
      condition: string;
      reason: string;
      boundary: { alternativeModel: string };
    }
>;

/** Model sampling bands: deliberately accepts no sampled displacements. */
export function ensembleMomentBands({
  M,
  d,
  modelVariance,
  alphas,
}: {
  M: number;
  d: number;
  modelVariance: number;
  alphas: readonly number[];
}): EnsembleMomentBandsResult {
  if (Number.isInteger(M) && M < 2) {
    return {
      kind: "underdetermined",
      status: "underdetermined",
      quantityId: "modelSamplingBand",
      unit: "m",
      semanticKind: "model-sampling-band",
      ownerId: "diffusion.ensembleMomentBands",
      compatibleFamily: "Sampling bands require an ensemble of at least two members.",
      neededInformation: ["Use at least two members (M >= 2)."],
      reason: "a band needs at least two members",
    };
  }
  if (!Number.isFinite(modelVariance) || modelVariance <= 0) {
    return {
      kind: "outside-domain",
      status: "outside-domain",
      domainKind: "model",
      quantityId: "modelSamplingBand",
      unit: "m",
      semanticKind: "model-sampling-band",
      ownerId: "diffusion.ensembleMomentBands",
      condition: "positive-finite-variance",
      reason: "Model variance must be strictly positive and finite.",
      boundary: { alternativeModel: "Use a positive model variance (2 * D * dt > 0)." },
    };
  }
  if (Array.isArray(alphas) && alphas.some((a) => !Number.isFinite(a) || a <= 0 || a >= 1)) {
    return {
      kind: "outside-domain",
      status: "outside-domain",
      domainKind: "input",
      quantityId: "modelSamplingBand",
      unit: "m",
      semanticKind: "model-sampling-band",
      ownerId: "diffusion.ensembleMomentBands",
      condition: "alpha-in-open-unit-interval",
      reason: "Significance levels alphas must lie strictly between zero and one.",
      boundary: { alternativeModel: "Use alphas in (0, 1)." },
    };
  }
  if (
    !Number.isInteger(M) ||
    M < 2 ||
    ![1, 2, 3].includes(d) ||
    M * d > 10000 ||
    !Array.isArray(alphas) ||
    alphas.length < 1 ||
    alphas.length > 8
  ) {
    return invalid();
  }
  const bands: MomentBand[] = [];
  for (const alpha of alphas) {
    const z = normalQuantile(1 - alpha / 2),
      low = chiSquareQuantile(M, alpha / 2),
      high = chiSquareQuantile(M, 1 - alpha / 2);
    const totalLow = chiSquareQuantile(d * M, alpha / 2),
      totalHigh = chiSquareQuantile(d * M, 1 - alpha / 2);
    for (const result of [z, low, high, totalLow, totalHigh])
      if (result.kind !== "accepted") return result;
    if (
      z.kind !== "accepted" ||
      low.kind !== "accepted" ||
      high.kind !== "accepted" ||
      totalLow.kind !== "accepted" ||
      totalHigh.kind !== "accepted"
    )
      return invalid();
    const factor = modelVariance / M;
    const band: MomentBand = {
      alpha,
      meanHalfWidth: z.data * Math.sqrt(factor),
      meanSquare: [factor * low.data, factor * high.data],
      totalMeanSquare: [factor * totalLow.data, factor * totalHigh.data],
      label: "sampling band under the model",
    };
    if (
      ![band.meanHalfWidth, ...band.meanSquare, ...band.totalMeanSquare].every(
        (v) => Number.isFinite(v) && v > 0,
      )
    )
      return invalid();
    bands.push(Object.freeze(band));
  }
  return { kind: "accepted", data: Object.freeze(bands) };
}
