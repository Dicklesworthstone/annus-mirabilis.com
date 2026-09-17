/** Inverse questions for the existing Brownian owners. No random draws occur here.
 * Camera relations: Berglund (2010), doi:10.1103/PhysRevE.82.011917.
 * These are later measurement models, not Einstein's printed derivation.
 */
import { makeRefusal } from "../../../experiments/results/refusals.ts";
import type { ConstantSet } from "../constants.ts";
import {
  type Assessment,
  combinedMolecularNumberInterval,
  type DeclaredInterval,
  type Estimate,
  estimatorInterval,
  identifiabilityFamily,
  type StatisticalInterval,
} from "../inference.ts";
import { cameraMoments } from "./observation.ts";

const invalid = (requirements: string): Assessment<never> => ({
  kind: "refused",
  refusal: makeRefusal(
    "invalid-parameter",
    { capabilityId: "diffusion.inference" },
    { details: { requirements } },
  ),
});
const positive = (value: number) => Number.isFinite(value) && value > 0;

/** The same confidence interval for D maps to an entire band, not a unique N. */
export function diffusionCompatibleBand(
  input: {
    estimate: Estimate;
    T: number;
    eta: number;
    alpha: number;
    radiusRange: readonly [number, number];
    synthetic: boolean;
  },
  constants: ConstantSet,
) {
  const interval = estimatorInterval(input.estimate, input.alpha);
  if (interval.kind !== "accepted") return interval;
  const conditions = {
    T: input.T,
    eta: input.eta,
    radiusRange: input.radiusRange,
    synthetic: input.synthetic,
  };
  const center = identifiabilityFamily({ ...conditions, D: input.estimate.dHat }, constants);
  if (center.kind !== "accepted") return center;
  const lower = identifiabilityFamily({ ...conditions, D: interval.data.upper }, constants);
  if (lower.kind !== "accepted") return lower;
  const upper = identifiabilityFamily({ ...conditions, D: interval.data.lower }, constants);
  if (upper.kind !== "accepted") return upper;
  return {
    kind: "accepted" as const,
    data: Object.freeze({
      ...center.data,
      interval: interval.data,
      lowerNumbers: lower.data.numbers,
      upperNumbers: upper.data.numbers,
    }),
  };
}

export type IndependentMeasurement = Readonly<{
  value: number;
  interval: DeclaredInterval;
  provenance: string;
}>;
/** Bonferroni allocation across D and every uncertain auxiliary input.
 * The reader declares the coverage and provenance; we cannot certify a calibration.
 * Dependence between marginal intervals does not invalidate the union bound.
 * R and timing/calibration remain exact within the declared model.
 */
export function conditionalMolecularNumberInterval(
  input: {
    estimate: Estimate;
    T: number;
    eta: number;
    alpha: number;
    synthetic: boolean;
    radius: IndependentMeasurement | null;
    radiusProvenance: "independently-declared" | "same-displacements";
    temperature?: IndependentMeasurement;
    viscosity?: IndependentMeasurement;
  },
  constants: ConstantSet,
): Assessment<StatisticalInterval> {
  if (!positive(input.alpha) || input.alpha >= 1)
    return invalid("Choose a total error probability strictly between zero and one.");
  if (!input.radius)
    return {
      kind: "no-value",
      status: "underdetermined",
      reason:
        "Diffusion fixes a radius–number product. Add an independently established radius interval before asking for a molecular-number interval.",
    };
  const measurements = [input.radius, input.temperature, input.viscosity].filter(
    (value): value is IndependentMeasurement => value !== undefined,
  );
  const alphaD = input.alpha / (measurements.length + 1);
  for (const value of measurements) {
    if (
      !value ||
      typeof value.provenance !== "string" ||
      !value.provenance.trim() ||
      value.provenance.length > 512
    )
      return invalid(
        "Every added measurement needs a provenance description of at most 512 characters.",
      );
    const interval = value.interval;
    if (
      !positive(value.value) ||
      !interval ||
      !positive(interval.lower) ||
      !positive(interval.upper) ||
      interval.lower > value.value ||
      interval.upper < value.value ||
      !Number.isFinite(interval.coverage) ||
      interval.coverage > 1 ||
      interval.coverage <= 0
    )
      return invalid(
        "Positive ordered measurement bounds must contain their point value and have a declared coverage.",
      );
    if (interval.coverage < 1 - alphaD)
      return {
        kind: "no-value",
        status: "not-applicable",
        reason: `Each auxiliary interval needs coverage of at least ${100 * (1 - alphaD)} percent for this Bonferroni allocation. A lower-coverage interval cannot be relabeled.`,
      };
  }
  return combinedMolecularNumberInterval(
    {
      estimate: input.estimate,
      alphaD,
      synthetic: input.synthetic,
      T: input.temperature?.value ?? input.T,
      eta: input.viscosity?.value ?? input.eta,
      a: input.radius.value,
      radiusProvenance: input.radiusProvenance,
      inputs: {
        a: input.radius.interval,
        ...(input.temperature ? { T: input.temperature.interval } : {}),
        ...(input.viscosity ? { eta: input.viscosity.interval } : {}),
      },
    },
    constants,
  );
}

/** Inverting one camera variance gives a segment of compatible (D, sigma²) pairs.
 * The sampled points exclude D=0, which is separately reported as a boundary.
 * Their predicted covariance is evaluated by cameraMoments, not by a view.
 */
export function cameraCompatibleFamily(input: {
  variance: number;
  dt: number;
  exposure: number;
}): Assessment<
  Readonly<{
    maximumDiffusion: number;
    maximumNoiseVariance: number;
    diffusion: Float64Array;
    noiseVariance: Float64Array;
    covariance: Float64Array;
  }>
> {
  const { variance, dt, exposure } = input;
  if (
    !positive(variance) ||
    !positive(dt) ||
    !Number.isFinite(exposure) ||
    exposure < 0 ||
    exposure > dt
  )
    return invalid(
      "Use a positive coordinate variance and frame spacing, with known uniform exposure between zero and that spacing.",
    );
  const effectiveTime = dt - exposure / 3;
  const maximumDiffusion = variance / 2 / effectiveTime;
  const maximumNoiseVariance = variance / 2;
  if (!positive(maximumDiffusion) || !positive(maximumNoiseVariance))
    return invalid("The compatible segment cannot be represented at this numerical scale.");
  const diffusion = new Float64Array(41),
    noiseVariance = new Float64Array(41),
    covariance = new Float64Array(41);
  for (let i = 0; i < diffusion.length; i++) {
    const fraction = (i + 1) / diffusion.length;
    // Parameterization avoids a negative endpoint caused by subtracting rounded products.
    const D = maximumDiffusion * fraction,
      sigma2 = maximumNoiseVariance * (1 - fraction);
    const predicted = cameraMoments({ D, dt, exposure, sigma: Math.sqrt(sigma2), drift: 0, d: 1 });
    if (predicted.kind !== "accepted") return predicted;
    diffusion[i] = D;
    noiseVariance[i] = sigma2;
    covariance[i] = predicted.data.covariance;
  }
  return {
    kind: "accepted",
    data: Object.freeze({
      maximumDiffusion,
      maximumNoiseVariance,
      diffusion,
      noiseVariance,
      covariance,
    }),
  };
}

/** Two distinct frame spacings, SAME exposure duration and localization variance.
 * These are unconstrained moment estimates, not confidence intervals. Negative
 * estimates are retained as model/sample diagnostics, never clipped to zero.
 */
export function twoIntervalCameraEstimate(input: {
  firstVariance: number;
  secondVariance: number;
  firstDt: number;
  secondDt: number;
  exposure: number;
}): Assessment<Readonly<{ D: number; sigma2: number; physical: boolean }>> {
  const { firstVariance, secondVariance, firstDt, secondDt, exposure } = input;
  if (
    ![firstVariance, secondVariance, firstDt, secondDt].every(positive) ||
    !Number.isFinite(exposure) ||
    exposure < 0 ||
    exposure > Math.min(firstDt, secondDt) ||
    secondDt <= firstDt
  )
    return invalid(
      "Use positive moments at two increasing spacings and the same known exposure duration, no longer than either spacing.",
    );
  const D = (secondVariance - firstVariance) / 2 / (secondDt - firstDt);
  const sigma2 = firstVariance / 2 - D * (firstDt - exposure / 3);
  if (![D, sigma2].every(Number.isFinite))
    return invalid("The two-interval inverse is not representable.");
  return { kind: "accepted", data: Object.freeze({ D, sigma2, physical: D >= 0 && sigma2 >= 0 }) };
}
