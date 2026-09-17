/** Later camera models, not Einstein's 1905 derivation.
 * Berglund (2010), doi:10.1103/PhysRevE.82.011917; covariance estimator:
 * Vestergaard et al. (2014), doi:10.1103/PhysRevE.89.022726.
 * All units are SI. No numerical quantile implementation is duplicated here.
 */

import { makeRefusal } from "../../../experiments/results/refusals.ts";
import type { Computation } from "../diffusion/ftcs.ts";
import {
  type Assessment,
  chiSquareInterval,
  estimateIncrements,
  type StatisticalInterval,
} from "../inference.ts";

const invalid = (requirements: string): Computation<never> => ({
  kind: "refused",
  refusal: makeRefusal(
    "invalid-parameter",
    { capabilityId: "diffusion.inference" },
    { details: { requirements } },
  ),
});
const missing = (reason: string): Assessment<never> => ({
  kind: "no-value",
  status: "not-applicable",
  reason,
});
const finite = (...values: number[]) => values.every(Number.isFinite);
export type CameraModel = Readonly<{
  D: number;
  dt: number;
  exposure: number;
  sigma: number;
  drift: number;
  d: number;
}>;
export function cameraMoments(p: CameraModel): Computation<
  Readonly<{
    variance: number;
    covariance: number;
    naiveExpectation: number;
    idealApparentSpeed: number;
    measuredApparentSpeed: number;
    apparentSpeedRatio: number;
    crossover: number | null;
  }>
> {
  if (
    !finite(p.D, p.dt, p.exposure, p.sigma, p.drift) ||
    p.D <= 0 ||
    p.dt <= 0 ||
    p.exposure < 0 ||
    p.exposure > p.dt ||
    p.sigma < 0 ||
    ![1, 2].includes(p.d)
  )
    return invalid(
      "Use positive diffusion and spacing, nonnegative localization error, exposure between zero and spacing, and one or two coordinates.",
    );
  const variance = 2 * p.D * (p.dt - p.exposure / 3) + 2 * p.sigma ** 2;
  const covariance = (p.D * p.exposure) / 3 - p.sigma ** 2;
  const naiveExpectation = variance / (2 * p.dt) + (p.drift ** 2 * p.dt) / (2 * p.d);
  // These speeds describe the mean-subtracted coordinate spread, not drift.
  const idealApparentSpeed = Math.sqrt(2 * p.D * p.dt) / p.dt;
  const measuredApparentSpeed =
    p.exposure === 0 && p.sigma === 0 ? idealApparentSpeed : Math.sqrt(variance) / p.dt;
  const apparentSpeedRatio = measuredApparentSpeed / idealApparentSpeed;
  const crossover = p.sigma > 0 && p.exposure === 0 ? p.sigma ** 2 / p.D : null;
  if (
    !finite(
      variance,
      covariance,
      naiveExpectation,
      idealApparentSpeed,
      measuredApparentSpeed,
      apparentSpeedRatio,
      crossover ?? 0,
    ) ||
    variance <= 0 ||
    idealApparentSpeed <= 0
  )
    return invalid("Camera moments cannot be represented at this numerical scale.");
  return {
    kind: "accepted",
    data: Object.freeze({
      variance,
      covariance,
      naiveExpectation,
      idealApparentSpeed,
      measuredApparentSpeed,
      apparentSpeedRatio,
      crossover,
    }),
  };
}
/** Known-drift moments. Do not silently substitute a fitted mean: centering
 * changes the finite-sample covariance expectation. Channels are independent. */
export function covarianceEstimator(
  increments: Float64Array,
  dt: number,
  { d, exposure, knownDrift = 0 }: { d: number; exposure: number; knownDrift?: number },
): Assessment<Readonly<{ variance: number; covariance: number; D: number; sigma2: number }>> {
  if (
    !(increments instanceof Float64Array) ||
    ![1, 2].includes(d) ||
    increments.length % d ||
    increments.length > 100000 ||
    !finite(dt, exposure, knownDrift) ||
    dt <= 0 ||
    exposure < 0 ||
    exposure > dt ||
    !increments.every(Number.isFinite)
  )
    return invalid(
      "Use finite equally spaced increments, admitted exposure and an explicitly known drift.",
    );
  const M = increments.length / d;
  if (M < 3) return missing("The covariance estimator needs at least three increments.");
  let variance = 0,
    covariance = 0;
  for (let c = 0; c < d; c++)
    for (let i = 0; i < M; i++) {
      const incA = increments[i * d + c];
      if (incA === undefined) continue;
      const a = incA - (c === 0 ? knownDrift * dt : 0);
      variance += (a * a) / (d * M);
      if (i < M - 1) {
        const incB = increments[(i + 1) * d + c];
        if (incB !== undefined) {
          const b = incB - (c === 0 ? knownDrift * dt : 0);
          covariance += (a * b) / (d * (M - 1));
        }
      }
    }
  const R = exposure / (6 * dt),
    D = (variance / 2 + covariance) / dt;
  const sigma2 = R * variance + (2 * R - 1) * covariance;
  if (!finite(variance, covariance, D, sigma2))
    return invalid("The sample moments cannot be represented.");
  // Negative finite-sample estimates are diagnostics, not silently clipped.
  return { kind: "accepted", data: Object.freeze({ variance, covariance, D, sigma2 }) };
}
/** Asymptotic MA(1) sampling bands, NOT confidence intervals for diffusivity. */
export function bartlettBandsMA1(
  gamma0: number,
  gamma1: number,
  M: number,
  d = 1,
): Computation<Readonly<{ sdVariance: number; sdCovariance: number }>> {
  if (
    !finite(gamma0, gamma1) ||
    gamma0 <= 0 ||
    Math.abs(gamma1) > gamma0 / 2 ||
    !Number.isSafeInteger(M) ||
    M < 3 ||
    ![1, 2].includes(d)
  )
    return invalid("Use an admissible MA(1) covariance and at least three increments.");
  const sdVariance = Math.sqrt((2 * (gamma0 ** 2 + 2 * gamma1 ** 2)) / (M * d));
  const sdCovariance = Math.sqrt((gamma0 ** 2 + 3 * gamma1 ** 2) / (M * d));
  if (!finite(sdVariance, sdCovariance) || sdVariance === 0 || sdCovariance === 0)
    return invalid("The sampling band is outside the numerical range.");
  return { kind: "accepted", data: { sdVariance, sdCovariance } };
}
export type ClickNoise = Readonly<{ sigma2: number; q: number; clicks: number; d: number }>;
export function stationaryClickNoiseEstimate(
  clicks: Float64Array,
  { d }: { d: number },
): Assessment<ClickNoise> {
  if (
    !(clicks instanceof Float64Array) ||
    ![1, 2].includes(d) ||
    clicks.length % d ||
    clicks.length / d < 5
  )
    return invalid("At least five stationary-feature clicks per coordinate are required.");
  const e = estimateIncrements(clicks, 0.5, d, "drift-centered");
  if (e.kind !== "accepted") return e;
  return {
    kind: "accepted",
    data: Object.freeze({ sigma2: e.data.unbiasedDHat, q: e.data.q, clicks: clicks.length / d, d }),
  };
}
export type PairInterval = Readonly<{
  estimate: number;
  pairs: number;
  q: number;
  lowerClipped: boolean;
  interval: StatisticalInterval | null;
  empty: boolean;
  noiseInterval: readonly [number, number];
  coverage: number;
  coverageKind: "exact" | "conservative";
}>;
/** Disjoint frame pairs (0,1),(2,3),... share neither frames nor noise.
 * Uniform exposures are forward [t_i,t_i+Te], Te <= dt. Their Brownian
 * supports are disjoint too. Constant drift is fitted, not taken from truth.
 * A negative upper endpoint gives an EMPTY physical confidence set, a miss
 * which must be retained in coverage studies, not retried or made positive.
 */
export function disjointPairsKnownNoiseInterval(
  input: Readonly<{
    positions: Float64Array;
    dt: number;
    exposure: number;
    d: number;
    alpha: number;
    noise: { kind: "exact"; sigma2: number } | { kind: "stationary-clicks"; estimate: ClickNoise };
    equalSpacing?: boolean;
    independentNoise?: boolean;
  }>,
): Assessment<PairInterval> {
  const { positions, dt, exposure, d, alpha, noise } = input;
  if (
    !(positions instanceof Float64Array) ||
    ![1, 2].includes(d) ||
    positions.length % d ||
    !finite(dt, exposure, alpha) ||
    dt <= 0 ||
    exposure < 0 ||
    exposure > dt ||
    alpha <= 0 ||
    alpha >= 1 ||
    !positions.every(Number.isFinite)
  )
    return invalid(
      "Use finite frame positions, one or two coordinates, uniform exposure no longer than frame spacing, and valid coverage.",
    );
  if (input.equalSpacing === false || input.independentNoise === false)
    return missing(
      "This pair procedure requires equal spacing and independent Gaussian localization errors.",
    );
  const pairs = Math.floor(positions.length / d / 2);
  if (pairs < 2) return missing("At least two disjoint frame pairs are needed when fitting drift.");
  if (!noise || !["exact", "stationary-clicks"].includes(noise.kind))
    return invalid("Declare exact localization variance or a stationary-click estimate.");
  const sigma2 = noise.kind === "exact" ? noise.sigma2 : noise.estimate?.sigma2;
  if (!Number.isFinite(sigma2) || sigma2 < 0)
    return invalid("Localization variance must be finite and nonnegative.");
  const increments = new Float64Array(pairs * d);
  for (let k = 0; k < pairs; k++)
    for (let c = 0; c < d; c++) {
      const posNext = positions[(2 * k + 1) * d + c];
      const posPrev = positions[2 * k * d + c];
      if (posNext !== undefined && posPrev !== undefined) {
        increments[k * d + c] = posNext - posPrev;
      }
    }
  const e = estimateIncrements(increments, 0.5, d, "drift-centered");
  if (e.kind !== "accepted") return e;
  const estimatedNoise = noise.kind === "stationary-clicks",
    alphaVariance = estimatedNoise ? alpha / 2 : alpha;
  const varianceBand = chiSquareInterval({
    dHat: e.data.unbiasedDHat,
    q: e.data.q,
    alpha: alphaVariance,
    estimatorId: "disjoint-pair-coordinate-variance",
  });
  if (varianceBand.kind !== "accepted") return varianceBand;
  let noiseInterval: readonly [number, number] = [sigma2, sigma2];
  if (noise.kind === "stationary-clicks") {
    const n = noise.estimate;
    if (n.d !== d || !Number.isSafeInteger(n.clicks) || n.clicks < 5 || n.q !== d * (n.clicks - 1))
      return invalid(
        "Stationary-click dimensions and degrees of freedom must match the noise declaration.",
      );
    const band = chiSquareInterval({
      dHat: sigma2,
      q: n.q,
      alpha: alpha / 2,
      estimatorId: "stationary-feature-noise-variance",
    });
    if (band.kind !== "accepted") return band;
    noiseInterval = [band.data.lower, band.data.upper];
  }
  const denominator = 2 * (dt - exposure / 3);
  const rawLower = (varianceBand.data.lower - 2 * noiseInterval[1]) / denominator;
  const upper = (varianceBand.data.upper - 2 * noiseInterval[0]) / denominator;
  const estimate = (e.data.unbiasedDHat - 2 * sigma2) / denominator;
  if (!finite(rawLower, upper, estimate))
    return invalid("The noise-corrected interval cannot be represented.");
  const coverageKind = estimatedNoise ? "conservative" : "exact";
  const interval: StatisticalInterval | null =
    upper < 0
      ? null
      : Object.freeze({
          lower: Math.max(0, rawLower),
          upper,
          q: e.data.q,
          coverage: 1 - alpha,
          uncertaintyKind: "statistical-interval",
          coverageKind,
          estimatorId: estimatedNoise
            ? "disjoint-pairs; stationary clicks; Bonferroni"
            : "disjoint-pairs; exact localization variance",
        });
  return {
    kind: "accepted",
    data: Object.freeze({
      estimate,
      pairs,
      q: e.data.q,
      interval,
      empty: interval === null,
      lowerClipped: rawLower < 0,
      noiseInterval: Object.freeze(noiseInterval),
      coverage: 1 - alpha,
      coverageKind,
    }),
  };
}
