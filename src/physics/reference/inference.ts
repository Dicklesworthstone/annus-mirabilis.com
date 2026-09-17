/** BM-07 host reference owner. Intervals assume independent, isotropic Gaussian
 * increments and exact timing/calibration. No camera/noise model is implied.
 * The shared diffusion quantile implementation remains the only quantile owner.
 */

import { makeRefusal } from "../../experiments/results/refusals.ts";
import { type ConstantSet, constantValue } from "./constants.ts";
import type { Computation } from "./diffusion/ftcs.ts";
import { chiSquareQuantile } from "./diffusion.ts";
import { createPhiloxStream, parseU64 } from "./philox.ts";

export type Assessment<T> =
  | Computation<T>
  | Readonly<{
      kind: "no-value";
      status: "underdetermined" | "not-applicable" | "outside-domain";
      reason: string;
    }>;
export type EstimatorId =
  | "independent-increment-known-zero-drift"
  | "drift-centered"
  | "maximum-likelihood-centered";
export type Estimate = Readonly<{
  dHat: number;
  unbiasedDHat: number;
  M: number;
  d: number;
  q: number;
  sumSquares: number;
  normalization: number;
  biasFactor: number;
  drift: Float64Array;
  estimatorId: EstimatorId;
}>;
export type StatisticalInterval = Readonly<{
  lower: number;
  upper: number;
  coverage: number;
  q: number;
  uncertaintyKind: "statistical-interval";
  coverageKind: "exact" | "conservative";
  estimatorId: string;
}>;
export type NumberMeaning = "synthetic-recovery" | "independent-estimate" | "consistency-check";
export type Conditions = Readonly<{
  T: number;
  eta: number;
  a: number;
  radiusProvenance: "independently-declared" | "same-displacements";
}>;
export type DeclaredInterval = Readonly<{ lower: number; upper: number; coverage: number }>;
export const INFERENCE_SENSITIVITIES = Object.freeze({
  molarGasConstant: 1,
  temperature: 1,
  viscosity: -1,
  particleRadius: -1,
  spatialCalibration: -2,
});
const noValue = (
  status: "underdetermined" | "not-applicable" | "outside-domain",
  reason: string,
) => ({ kind: "no-value" as const, status, reason });
const invalid = (reason: string): Computation<never> => ({
  kind: "refused",
  refusal: makeRefusal(
    "invalid-parameter",
    { capabilityId: "diffusion.inference" },
    { details: { requirements: reason } },
  ),
});
const positive = (n: number) => Number.isFinite(n) && n > 0;

/** A caller cannot turn correlated observations into extra degrees of freedom. */
export function independentModelAdmission(
  rule: Readonly<{
    equalSpacing: boolean;
    nonOverlapping: boolean;
    localizationStd: number;
    exposureTime: number;
    censored: boolean;
  }>,
): Assessment<true> {
  if (
    !rule ||
    [rule.localizationStd, rule.exposureTime].some((n) => !Number.isFinite(n) || n < 0) ||
    [rule.equalSpacing, rule.nonOverlapping, rule.censored].some((x) => typeof x !== "boolean")
  )
    return invalid("Declare timing, overlap, noise, exposure and censoring.");
  const reasons = [
    !rule.equalSpacing && "irregular timing",
    !rule.nonOverlapping && "overlapping displacement windows",
    rule.localizationStd > 0 && "localization noise",
    rule.exposureTime > 0 && "exposure blur",
    rule.censored && "censored observations",
  ].filter(Boolean);
  return reasons.length
    ? noValue(
        "outside-domain",
        `The independent-increment interval does not admit ${reasons.join(", ")}. A validated observation model is required; no interval is supplied.`,
      )
    : { kind: "accepted", data: true };
}

export function estimateIncrements(
  increments: Float64Array,
  dt: number,
  d: number,
  estimatorId: EstimatorId,
): Assessment<Estimate> {
  if (
    !(increments instanceof Float64Array) ||
    ![1, 2, 3].includes(d) ||
    increments.length % d ||
    increments.length > 10000 ||
    !positive(dt) ||
    ![
      "independent-increment-known-zero-drift",
      "drift-centered",
      "maximum-likelihood-centered",
    ].includes(estimatorId)
  )
    return invalid(
      "Use finite equally timed increments, 1–3 coordinates, and a registered estimator (at most 10000 coordinates).",
    );
  const M = increments.length / d,
    centered = estimatorId !== "independent-increment-known-zero-drift";
  if (M < (centered ? 2 : 1))
    return noValue(
      "underdetermined",
      centered
        ? "A second independent increment, or a known drift, is needed to separate drift from spread."
        : "No admitted increments are available.",
    );
  let scale = 0;
  for (const x of increments) {
    if (!Number.isFinite(x)) return invalid("Every displacement must be finite.");
    scale = Math.max(scale, Math.abs(x));
  }
  const means = new Float64Array(d),
    drift = new Float64Array(d);
  if (scale > 0)
    for (let i = 0; i < M; i++)
      for (let c = 0; c < d; c++)
        means[c] = means[c]! + (increments[i * d + c]! / scale - means[c]!) / (i + 1);
  let sum = 0,
    compensation = 0;
  if (scale > 0)
    for (let i = 0; i < M; i++)
      for (let c = 0; c < d; c++) {
        const x = increments[i * d + c]! / scale - (centered ? means[c]! : 0);
        const term = x * x - compensation,
          next = sum + term;
        compensation = next - sum - term;
        sum = next;
      }
  const observationInterval = dt,
    q = d * (centered ? M - 1 : M),
    normalization = estimatorId === "maximum-likelihood-centered" ? d * M : q;
  const sumSquares = sum * scale * scale,
    unbiasedDHat = sumSquares / (2 * observationInterval) / q,
    dHat = sumSquares / (2 * observationInterval) / normalization;
  for (let c = 0; c < d; c++) drift[c] = (means[c]! * scale) / dt;
  if (
    ![sumSquares, unbiasedDHat, dHat, ...drift].every(Number.isFinite) ||
    (sum > 0 && (sumSquares === 0 || dHat === 0 || unbiasedDHat === 0))
  )
    return invalid(
      "The displacement scale exceeds this binary64 calculation's representable range.",
    );
  return {
    kind: "accepted",
    data: Object.freeze({
      dHat,
      unbiasedDHat,
      M,
      d,
      q,
      sumSquares,
      normalization,
      biasFactor: q / normalization,
      drift,
      estimatorId,
    }),
  };
}
export const independentIncrementEstimator = (x: Float64Array, dt: number, { d }: { d: number }) =>
  estimateIncrements(x, dt, d, "independent-increment-known-zero-drift");
export const driftCenteredEstimator = (x: Float64Array, dt: number, { d }: { d: number }) =>
  estimateIncrements(x, dt, d, "drift-centered");
export const mleEstimator = (x: Float64Array, dt: number, { d }: { d: number }) =>
  estimateIncrements(x, dt, d, "maximum-likelihood-centered");

/** dHat is the UNBIASED estimate; callers of the centered MLE must rescale it. */
export function chiSquareInterval({
  dHat,
  q,
  alpha,
  estimatorId = "independent-increment-known-zero-drift",
}: {
  dHat: number;
  q: number;
  alpha: number;
  estimatorId?: string;
}): Computation<StatisticalInterval> {
  if (
    !Number.isFinite(dHat) ||
    dHat < 0 ||
    !positive(q) ||
    !Number.isFinite(alpha) ||
    alpha <= 0 ||
    alpha >= 1 ||
    !estimatorId.trim()
  )
    return invalid(
      "An interval requires a nonnegative estimate, positive degrees of freedom and coverage strictly between zero and one.",
    );
  const lo = chiSquareQuantile(q, alpha / 2),
    hi = chiSquareQuantile(q, 1 - alpha / 2);
  if (lo.kind !== "accepted") return lo;
  if (hi.kind !== "accepted") return hi;
  const lower = dHat * (q / hi.data),
    upper = dHat * (q / lo.data);
  if (![lower, upper].every(Number.isFinite) || (dHat > 0 && lower === 0))
    return invalid("The interval cannot be represented at this numerical scale.");
  return {
    kind: "accepted",
    data: Object.freeze({
      lower,
      upper,
      coverage: 1 - alpha,
      q,
      uncertaintyKind: "statistical-interval",
      coverageKind: "exact",
      estimatorId,
    }),
  };
}
export function estimatorInterval(
  estimate: Estimate,
  alpha: number,
): Computation<StatisticalInterval> {
  return chiSquareInterval({
    dHat: estimate.unbiasedDHat,
    q: estimate.q,
    alpha,
    estimatorId: estimate.estimatorId,
  });
}
export function inverseBias(
  q: number,
  normalization = q,
): Assessment<Readonly<{ meanFactor: number; varianceFactor: number | null }>> {
  if (!positive(q) || !positive(normalization))
    return invalid("Positive degrees of freedom and normalization are required.");
  if (q <= 2)
    return noValue(
      "not-applicable",
      "The inverse estimate has no finite expectation with two or fewer degrees of freedom.",
    );
  return {
    kind: "accepted",
    data: {
      meanFactor: normalization / (q - 2),
      varianceFactor: q > 4 ? (2 * normalization ** 2) / ((q - 2) ** 2 * (q - 4)) : null,
    },
  };
}

function gas(
  set: ConstantSet,
  synthetic: boolean,
): Assessment<{ R: number; semanticKind: NumberMeaning }> {
  try {
    const entry = set.entries.find((e) => e.quantityId === "molarGasConstant"),
      R = constantValue(set, "molarGasConstant").value;
    if (!positive(R) || entry?.unit !== "J/(mol K)")
      return invalid("The gas constant needs positive canonical SI units and explicit provenance.");
    if (synthetic) return { kind: "accepted", data: { R, semanticKind: "synthetic-recovery" } };
    if (set.id === "modern-si-2019" && set.gasConstantProvenance === "defined")
      return { kind: "accepted", data: { R, semanticKind: "consistency-check" } };
    if (
      set.gasConstantProvenance === "measured-without-counting-molecules" &&
      entry.evidentialRole === "measured-observation" &&
      !entry.dependsOn.some((id) => /avogadro|boltzmann/i.test(id)) &&
      !set.entries.some((e) => e.quantityId === "avogadroConstant" && e.kind === "exact-defined")
    )
      return { kind: "accepted", data: { R, semanticKind: "independent-estimate" } };
    return noValue(
      "outside-domain",
      "This constant set does not establish a noncircular interpretation for an observational molecular-number estimate.",
    );
  } catch {
    return invalid("The gas constant is unavailable in the declared set.");
  }
}
function checkConditions(input: Conditions): Computation<true> {
  if (input.radiusProvenance === "same-displacements")
    return {
      kind: "refused",
      refusal: makeRefusal("circular-radius-from-displacement", {
        capabilityId: "diffusion.inference",
        parameterIds: ["a"],
      }),
    };
  if (
    input.radiusProvenance !== "independently-declared" ||
    ![input.T, input.eta, input.a].every(positive)
  )
    return invalid(
      "Positive temperature, viscosity and an independently declared radius are required.",
    );
  return { kind: "accepted", data: true };
}
export function invertToMolecularNumber(
  input: Conditions & { dHat: number; interval: StatisticalInterval; synthetic: boolean },
  set: ConstantSet,
): Assessment<
  Readonly<{
    estimate: number;
    interval: StatisticalInterval;
    constantSetId: string;
    semanticKind: NumberMeaning;
    consistencyRatio: number | null;
    estimatedBoltzmannConstant: number | null;
  }>
> {
  const conditions = checkConditions(input);
  if (conditions.kind !== "accepted") return conditions;
  const g = gas(set, input.synthetic);
  if (g.kind !== "accepted") return g;
  if (input.dHat === 0 || input.interval.lower === 0)
    return noValue(
      "underdetermined",
      "No positive diffusion scale was resolved; a finite molecular number cannot be recovered by division by zero.",
    );
  if (
    !positive(input.dHat) ||
    !positive(input.interval.lower) ||
    !positive(input.interval.upper) ||
    input.interval.lower > input.interval.upper
  )
    return invalid("A positive diffusion estimate and ordered interval are required.");
  // Live-term identifiers for show-the-code: diffusionCoefficient, avogadroNumberEstimate,
  // particleRadius, viscosity, temperature, molarGasConstant. Never a modern exact k_B here.
  const temperature = input.T,
    viscosity = input.eta,
    particleRadius = input.a,
    molarGasConstant = g.data.R,
    diffusionCoefficient = input.dHat;
  const C = (molarGasConstant * temperature) / (6 * Math.PI * viscosity * particleRadius);
  const avogadroNumberEstimate = C / diffusionCoefficient;
  const estimate = avogadroNumberEstimate;
  const lower = C / input.interval.upper,
    upper = C / input.interval.lower;
  const modern = g.data.semanticKind === "consistency-check";
  const consistencyRatio = modern ? estimate / constantValue(set, "avogadroConstant").value : null;
  const estimatedBoltzmannConstant = modern
    ? (6 * Math.PI * input.eta * input.a * input.dHat) / input.T
    : null;
  if (
    ![
      estimate,
      lower,
      upper,
      ...(modern ? [consistencyRatio!, estimatedBoltzmannConstant!] : []),
    ].every(positive)
  )
    return invalid("The inverse result cannot be represented at this numerical scale.");
  return {
    kind: "accepted",
    data: Object.freeze({
      estimate,
      interval: Object.freeze({ ...input.interval, lower, upper }),
      constantSetId: set.id,
      semanticKind: g.data.semanticKind,
      consistencyRatio,
      estimatedBoltzmannConstant,
    }),
  };
}

/** Conservative union-bound procedure. Marginal input intervals do NOT need
 * statistical independence. Calibration is held exact in this BM-07 slice. */
export function combinedMolecularNumberInterval(
  input: Conditions & {
    estimate: Estimate;
    alphaD: number;
    inputs: Partial<Record<"T" | "eta" | "a", DeclaredInterval>>;
    synthetic: boolean;
  },
  set: ConstantSet,
): Assessment<StatisticalInterval> {
  const conditions = checkConditions(input);
  if (conditions.kind !== "accepted") return conditions;
  const g = gas(set, input.synthetic);
  if (g.kind !== "accepted") return g;
  let alpha = input.alphaD;
  const ranges: Record<"T" | "eta" | "a", readonly [number, number]> = {
    T: [input.T, input.T],
    eta: [input.eta, input.eta],
    a: [input.a, input.a],
  };
  if (Object.keys(input.inputs).some((k) => !["T", "eta", "a"].includes(k)))
    return invalid(
      "Only temperature, viscosity and radius intervals are admitted by this procedure.",
    );
  for (const k of ["T", "eta", "a"] as const) {
    const v = input.inputs[k];
    if (v === undefined) continue;
    if (!v || !Number.isFinite(v.coverage) || v.coverage <= 0 || v.coverage > 1)
      return noValue("not-applicable", `The ${k} input interval has no valid declared coverage.`);
    if (!positive(v.lower) || !positive(v.upper) || v.lower > input[k] || v.upper < input[k])
      return invalid(`The positive ${k} interval must contain its stated point input.`);
    alpha += 1 - v.coverage;
    ranges[k] = [v.lower, v.upper];
  }
  if (!positive(input.alphaD) || input.alphaD >= 1 || !positive(1 - alpha))
    return noValue(
      "not-applicable",
      "The declared input error rates leave no positive simultaneous coverage guarantee.",
    );
  const interval = estimatorInterval(input.estimate, input.alphaD);
  if (interval.kind !== "accepted") return interval;
  if (interval.data.lower === 0)
    return noValue("underdetermined", "A positive diffusion scale is required before inversion.");
  const lower =
    (g.data.R * ranges.T[0]) / (6 * Math.PI * ranges.eta[1] * ranges.a[1] * interval.data.upper);
  const upper =
    (g.data.R * ranges.T[1]) / (6 * Math.PI * ranges.eta[0] * ranges.a[0] * interval.data.lower);
  if (![lower, upper].every(positive))
    return invalid("The combined interval cannot be represented.");
  return {
    kind: "accepted",
    data: Object.freeze({
      ...interval.data,
      lower,
      upper,
      coverage: 1 - alpha,
      coverageKind: "conservative",
      estimatorId: `${input.estimate.estimatorId}; Bonferroni with declared input intervals`,
    }),
  };
}

export function identifiabilityFamily(
  input: {
    D: number;
    T: number;
    eta: number;
    radiusRange: readonly [number, number];
    synthetic: boolean;
  },
  set: ConstantSet,
): Assessment<
  Readonly<{
    product: number;
    radii: Float64Array;
    numbers: Float64Array;
    semanticKind: NumberMeaning;
    constantSetId: string;
  }>
> {
  const g = gas(set, input.synthetic);
  if (g.kind !== "accepted") return g;
  if (input.D === 0)
    return noValue(
      "underdetermined",
      "A positive diffusion scale is needed to draw the compatible family.",
    );
  if (
    ![input.D, input.T, input.eta, ...input.radiusRange].every(positive) ||
    input.radiusRange[0] >= input.radiusRange[1]
  )
    return invalid("Use positive conditions and an increasing radius range.");
  const product = (g.data.R * input.T) / (6 * Math.PI * input.eta * input.D);
  const radii = Float64Array.from({ length: 41 }, (_, i) =>
    Math.exp(
      Math.log(input.radiusRange[0]) * (1 - i / 40) + (Math.log(input.radiusRange[1]) * i) / 40,
    ),
  );
  const numbers = Float64Array.from(radii, (a) => product / a);
  if (![product, ...numbers].every(positive))
    return invalid("The compatible family cannot be represented.");
  return {
    kind: "accepted",
    data: { product, radii, numbers, semanticKind: g.data.semanticKind, constantSetId: set.id },
  };
}

export const SEMANTIC_KIND_VISITOR_TEXT = Object.freeze({
  "synthetic-recovery":
    "This checks the inference method on data made with a hidden number. It is not evidence that molecules exist.",
  "independent-estimate":
    "This combines the measured displacements with a gas constant measured without counting molecules, so it is an independent estimate of the number of molecules in a mole.",
  "consistency-check":
    "With the 2019 SI constants the gas constant is defined as N_A × k_B, so this compares the measurement with the defined Avogadro constant (equivalently, it estimates Boltzmann's constant). It is not an independent count of molecules.",
} as const);

export function semanticKindVisitorText(kind: NumberMeaning): string {
  return SEMANTIC_KIND_VISITOR_TEXT[kind];
}

export type SummaryEstimate = Readonly<{
  dHat: number;
  meanSquareDisplacement: number;
  observationInterval: number;
  independentCoordinateCount: number | null;
}>;

/** Einstein's one-coordinate summary: D̂ = λ_x² / (2 Δt). The interval needs an independent count. */
export function estimateSummaryStatistics(input: {
  meanSquareDisplacement: number;
  observationInterval: number;
  independentCoordinateCount: number | null;
}): Assessment<SummaryEstimate> {
  const observationInterval = input.observationInterval,
    meanSquareDisplacement = input.meanSquareDisplacement;
  if (!positive(observationInterval) || !positive(meanSquareDisplacement))
    return invalid("A positive mean-square displacement and observation interval are required.");
  const count = input.independentCoordinateCount;
  if (count !== null && (!Number.isSafeInteger(count) || count < 1 || count > 10000))
    return invalid("The independent coordinate count must be a positive integer, or omitted.");
  const dHat = meanSquareDisplacement / (2 * observationInterval);
  if (!positive(dHat))
    return invalid("The summary diffusivity cannot be represented at this numerical scale.");
  return {
    kind: "accepted",
    data: Object.freeze({
      dHat,
      meanSquareDisplacement,
      observationInterval,
      independentCoordinateCount: count,
    }),
  };
}

export function summaryChiSquareInterval(
  summary: SummaryEstimate,
  alpha: number,
): Assessment<StatisticalInterval> {
  if (summary.independentCoordinateCount === null)
    return noValue(
      "not-applicable",
      "The independent displacement count is unreported, so this summary path cannot form a chi-square interval. Only the point estimate is admitted.",
    );
  return chiSquareInterval({
    dHat: summary.dHat,
    q: summary.independentCoordinateCount,
    alpha,
    estimatorId: "summary-statistic",
  });
}

/** Finite-difference logarithmic sensitivities of N̂ = C/D̂. Calibration scale s multiplies displacements. */
export function invertSensitivities(input: {
  dHat: number;
  T: number;
  eta: number;
  a: number;
  calibrationScale: number;
}): Assessment<Readonly<Record<keyof typeof INFERENCE_SENSITIVITIES, number>>> {
  if (![input.dHat, input.T, input.eta, input.a, input.calibrationScale].every(positive))
    return invalid(
      "Positive diffusivity, temperature, viscosity, radius and calibration are required.",
    );
  const n = (T: number, eta: number, a: number, s: number, dHat: number) =>
    T / (6 * Math.PI * eta * a * dHat * s * s);
  const N = n(input.T, input.eta, input.a, input.calibrationScale, input.dHat);
  const rel = 1e-6;
  const slope = (perturbed: number) => Math.log(perturbed / N) / Math.log(1 + rel);
  return {
    kind: "accepted",
    data: Object.freeze({
      molarGasConstant: 1,
      temperature: slope(
        n(input.T * (1 + rel), input.eta, input.a, input.calibrationScale, input.dHat),
      ),
      viscosity: slope(
        n(input.T, input.eta * (1 + rel), input.a, input.calibrationScale, input.dHat),
      ),
      particleRadius: slope(
        n(input.T, input.eta, input.a * (1 + rel), input.calibrationScale, input.dHat),
      ),
      spatialCalibration: slope(
        n(input.T, input.eta, input.a, input.calibrationScale * (1 + rel), input.dHat),
      ),
    }),
  };
}

/** Empirical coverage fraction across repeated synthetic realizations of the chi-square interval. */
export function empiricalCoverageFraction(input: {
  trials: number;
  nominalCoverage?: number | undefined;
  degreesOfFreedom?: number | undefined;
  seed?: string | undefined;
}): Assessment<number> {
  const trials = input.trials;
  const nominalCoverage = input.nominalCoverage ?? 0.95;
  const degreesOfFreedom = input.degreesOfFreedom ?? 100;
  const seed = input.seed ?? "1905";

  if (
    !Number.isSafeInteger(trials) ||
    trials < 1 ||
    !Number.isFinite(nominalCoverage) ||
    nominalCoverage <= 0 ||
    nominalCoverage >= 1 ||
    !Number.isFinite(degreesOfFreedom) ||
    degreesOfFreedom < 1
  ) {
    return invalid(
      "Positive integer trials, positive degrees of freedom and nominal coverage in (0, 1) are required.",
    );
  }

  try {
    parseU64(seed);
  } catch {
    return invalid("Seed must be a valid unsigned 64-bit integer string.");
  }

  const alpha = 1 - nominalCoverage;
  const q = Math.round(degreesOfFreedom);
  const lo = chiSquareQuantile(q, alpha / 2);
  const hi = chiSquareQuantile(q, 1 - alpha / 2);
  if (lo.kind !== "accepted") return lo;
  if (hi.kind !== "accepted") return hi;

  const stream = createPhiloxStream({
    seed,
    kernel: 0x19050003,
    tile: 0,
  });

  let covered = 0;
  for (let i = 0; i < trials; i++) {
    let sumSq = 0;
    for (let k = 0; k < q; k++) {
      const z = stream.nextNormal();
      sumSq += z * z;
    }
    if (sumSq >= lo.data && sumSq <= hi.data) {
      covered++;
    }
  }

  return {
    kind: "accepted",
    data: covered / trials,
  };
}

export {
  bartlettBandsMA1,
  cameraMoments,
  type CameraModel,
  type ClickNoise,
  covarianceEstimator,
  disjointPairsKnownNoiseInterval,
  type PairInterval,
  stationaryClickNoiseEstimate,
} from "./inference/observation.ts";
export {
  CAMERA_GRID_DT,
  CAMERA_GRID_STEPS,
  CAMERA_KERNELS,
  type CameraFrames,
  type CameraObservation,
  type CameraOptions,
  type CameraRecording,
  type CameraSetup,
  cameraGrid,
  observeCameraPath,
  recordCameraPath,
} from "./inference/camera.ts";
