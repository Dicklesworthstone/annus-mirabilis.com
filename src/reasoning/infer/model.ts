import { makeRefusal } from "../../experiments/results/refusals.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import type { OutputContract, Parameters } from "../../experiments/store/instanceStore.ts";
import {
  cameraCompatibleFamily,
  conditionalMolecularNumberInterval,
  diffusionCompatibleBand,
  twoIntervalCameraEstimate,
} from "../../physics/reference/inference/identifiability.ts";
import { covarianceEstimator } from "../../physics/reference/inference/observation.ts";
import { INFERENCE_CONSTANTS } from "../../physics/reference/inference/synthetic.ts";
import {
  type Assessment,
  estimateIncrements,
  estimatorInterval,
  invertToMolecularNumber,
} from "../../physics/reference/inference.ts";
import type { InferenceEvidence } from "./evidence.ts";

const contract = (
  unit: string,
  semanticKind: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId: "inference.workbench", statuses });
const inferred = ["value", "underdetermined", "not-applicable", "outside-domain"] as const;
export const FAMILY_OUTPUTS = Object.freeze({
  diffusionCoefficientEstimate: contract("m2/s", "statistical-diffusion-estimate"),
  diffusionInterval: contract("m2/s", "chi-square-confidence-interval"),
  familyRadii: contract("m", "compatible-radius-grid"),
  familyNumbers: contract("1/mol", "synthetic-recovery"),
  familyLowerNumbers: contract("1/mol", "synthetic-recovery"),
  familyUpperNumbers: contract("1/mol", "synthetic-recovery"),
  radiusNumberProduct: contract("m/mol", "synthetic-recovery"),
  avogadroNumberEstimate: contract("1/mol", "synthetic-recovery", inferred),
  molecularInterval: contract("1/mol", "synthetic-recovery", inferred),
  simultaneousCoverage: contract("1", "conservative-coverage-lower-bound", inferred),
});
export const CAMERA_OUTPUTS = Object.freeze({
  sampleVariance: contract("m2", "known-drift-increment-second-moment"),
  sampleCovariance: contract("m2", "known-drift-adjacent-increment-product", inferred),
  secondVariance: contract("m2", "coarse-increment-second-moment", inferred),
  familyDiffusion: contract("m2/s", "compatible-camera-diffusivity"),
  familyNoise: contract("m2", "compatible-camera-localization-variance"),
  familyCovariance: contract("m2", "compatible-camera-covariance"),
  maximumDiffusion: contract("m2/s", "single-moment-compatible-bound"),
  maximumNoise: contract("m2", "single-moment-compatible-bound"),
  diffusionEstimate: contract("m2/s", "unconstrained-camera-moment-estimate", inferred),
  noiseEstimate: contract("m2", "unconstrained-localization-moment-estimate", inferred),
  physicalSolution: contract("1", "nonnegative-moment-solution", inferred),
  diffusionConfidenceInterval: contract("m2/s", "unavailable-camera-confidence-interval", inferred),
});
export const RADIUS_EXAMPLE = Object.freeze({
  radiusKnown: true,
  radius: 0.5e-6,
  radiusLower: 0.45e-6,
  radiusUpper: 0.55e-6,
  radiusCoverage: 0.975,
  radiusProvenance: "independently-declared",
  provenance:
    "Synthetic independent-radius interval for the worked example; not an actual calibration.",
});
export const RADIUS_DEFAULTS = Object.freeze({
  ...RADIUS_EXAMPLE,
  radiusKnown: false,
  provenance: "",
});
export const CAMERA_DEFAULTS = Object.freeze({ information: "variance" });
export type RadiusParameters = { [K in keyof typeof RADIUS_DEFAULTS]: (typeof RADIUS_DEFAULTS)[K] };
function outputsFor(contracts: Readonly<Record<string, OutputContract>>) {
  function meta(id: string) {
    const c = contracts[id];
    if (!c) throw new Error(`Unknown inference output: ${id}.`);
    return { quantityId: id, unit: c.unit, semanticKind: c.semanticKind, ownerId: c.ownerId };
  }
  return {
    value(id: string, value: number | Float64Array): ScientificResult {
      return { ...meta(id), status: "value", value };
    },
    absent(
      id: string,
      status: "underdetermined" | "not-applicable" | "outside-domain",
      reason: string,
    ): ScientificResult {
      return status === "underdetermined"
        ? { ...meta(id), status, compatibleFamily: reason, neededInformation: [reason] }
        : status === "outside-domain"
          ? {
              ...meta(id),
              status,
              reason,
              condition:
                "The inference requires positive, representable inputs in its admitted model.",
              domainKind: "model",
              boundary: { alternativeModel: "Inspect the stated measurement assumptions." },
            }
          : { ...meta(id), status, reason };
    },
  };
}
export const inferenceRefusal = (requirements: string): Assessment<never> => ({
  kind: "refused",
  refusal: makeRefusal(
    "invalid-parameter",
    { capabilityId: "diffusion.inference" },
    { details: { requirements } },
  ),
});
function matchingFields(input: unknown, expected: object): input is Parameters {
  return (
    !!input &&
    typeof input === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(input)) &&
    Reflect.ownKeys(input).length === Object.keys(expected).length &&
    Reflect.ownKeys(input).every(
      (key) =>
        typeof key === "string" &&
        Object.hasOwn(expected, key) &&
        Object.hasOwn(Object.getOwnPropertyDescriptor(input, key) ?? {}, "value"),
    )
  );
}
export function validateRadius(input: unknown): Assessment<Parameters> {
  if (
    !matchingFields(input, RADIUS_DEFAULTS) ||
    typeof input.radiusKnown !== "boolean" ||
    typeof input.provenance !== "string" ||
    input.provenance.length > 512 ||
    !["independently-declared", "same-displacements"].includes(String(input.radiusProvenance))
  )
    return inferenceRefusal("Declare the radius information using the named fields.");
  for (const key of ["radius", "radiusLower", "radiusUpper", "radiusCoverage"])
    if (typeof input[key] !== "number" || !Number.isFinite(input[key]) || input[key] <= 0)
      return inferenceRefusal("Use positive finite calibration inputs.");
  if (
    Number(input.radiusLower) > Number(input.radius) ||
    Number(input.radiusUpper) < Number(input.radius) ||
    Number(input.radiusCoverage) > 1
  )
    return inferenceRefusal(
      "Radius bounds must contain the point value; coverage must not exceed one.",
    );
  if (input.radiusKnown && !input.provenance.trim())
    return inferenceRefusal("State where the independent radius information came from.");
  return { kind: "accepted", data: Object.freeze({ ...input }) };
}
export function evaluateRadius(
  evidence: InferenceEvidence,
  input: unknown,
): Assessment<readonly ScientificResult[]> {
  if (evidence.kind !== "ideal")
    return inferenceRefusal("The radius case requires the ideal displacement example.");
  const valid = validateRadius(input);
  if (valid.kind !== "accepted") return valid;
  const p = valid.data;
  const estimate = estimateIncrements(
    Float64Array.from(evidence.increments),
    evidence.dt,
    evidence.d,
    "independent-increment-known-zero-drift",
  );
  if (estimate.kind !== "accepted") return estimate;
  const band = diffusionCompatibleBand(
    {
      estimate: estimate.data,
      T: evidence.T,
      eta: evidence.eta,
      alpha: 0.05,
      radiusRange: [0.1e-6, 2e-6],
      synthetic: true,
    },
    INFERENCE_CONSTANTS,
  );
  if (band.kind !== "accepted") return band;
  const { value, absent } = outputsFor(FAMILY_OUTPUTS);
  const b = band.data;
  const outputs: ScientificResult[] = [
    value("diffusionCoefficientEstimate", estimate.data.dHat),
    value("diffusionInterval", Float64Array.of(b.interval.lower, b.interval.upper)),
    value("radiusNumberProduct", b.product),
    value("familyRadii", b.radii),
    value("familyNumbers", b.numbers),
    value("familyLowerNumbers", b.lowerNumbers),
    value("familyUpperNumbers", b.upperNumbers),
  ];
  const conditional = conditionalMolecularNumberInterval(
    {
      estimate: estimate.data,
      T: evidence.T,
      eta: evidence.eta,
      alpha: 0.05,
      synthetic: true,
      radius: p.radiusKnown
        ? {
            value: Number(p.radius),
            interval: {
              lower: Number(p.radiusLower),
              upper: Number(p.radiusUpper),
              coverage: Number(p.radiusCoverage),
            },
            provenance: String(p.provenance),
          }
        : null,
      radiusProvenance: p.radiusProvenance as "independently-declared" | "same-displacements",
    },
    INFERENCE_CONSTANTS,
  );
  if (conditional.kind === "refused" || conditional.kind === "outcome") return conditional;
  if (conditional.kind === "no-value") {
    for (const id of ["avogadroNumberEstimate", "molecularInterval", "simultaneousCoverage"])
      outputs.push(absent(id, conditional.status, conditional.reason));
  } else {
    const pointInterval = estimatorInterval(estimate.data, 0.025);
    if (pointInterval.kind !== "accepted") return pointInterval;
    const point = invertToMolecularNumber(
      {
        T: evidence.T,
        eta: evidence.eta,
        a: Number(p.radius),
        radiusProvenance: "independently-declared",
        dHat: estimate.data.dHat,
        interval: pointInterval.data,
        synthetic: true,
      },
      INFERENCE_CONSTANTS,
    );
    if (point.kind !== "accepted") return point;
    outputs.push(
      value("avogadroNumberEstimate", point.data.estimate),
      value("molecularInterval", Float64Array.of(conditional.data.lower, conditional.data.upper)),
      value("simultaneousCoverage", conditional.data.coverage),
    );
  }
  return { kind: "accepted", data: outputs };
}

export function evaluateCamera(
  evidence: InferenceEvidence,
  input: unknown,
): Assessment<readonly ScientificResult[]> {
  if (
    evidence.kind !== "camera" ||
    !matchingFields(input, CAMERA_DEFAULTS) ||
    !["variance", "covariance", "second-interval"].includes(String(input.information))
  )
    return inferenceRefusal(
      "Choose variance alone, neighboring covariance, or a second interval for this fixed camera recording.",
    );
  const { value, absent } = outputsFor(CAMERA_OUTPUTS);
  const sample = covarianceEstimator(Float64Array.from(evidence.increments), evidence.dt, {
    d: evidence.d,
    exposure: evidence.exposure,
    knownDrift: evidence.knownDrift,
  });
  if (sample.kind !== "accepted") return sample;
  const family = cameraCompatibleFamily({
    variance: sample.data.variance,
    dt: evidence.dt,
    exposure: evidence.exposure,
  });
  if (family.kind !== "accepted") return family;
  const f = family.data,
    s = sample.data,
    method = String(input.information);
  const outputs: ScientificResult[] = [
    value("sampleVariance", s.variance),
    value("familyDiffusion", f.diffusion),
    value("familyNoise", f.noiseVariance),
    value("familyCovariance", f.covariance),
    value("maximumDiffusion", f.maximumDiffusion),
    value("maximumNoise", f.maximumNoiseVariance),
    absent(
      "diffusionConfidenceInterval",
      "not-applicable",
      "Correlated camera increments do not satisfy the independent-increment chi-square procedure. These moment solutions are point estimates, not confidence intervals.",
    ),
  ];
  outputs.push(
    method === "covariance"
      ? value("sampleCovariance", s.covariance)
      : absent(
          "sampleCovariance",
          "not-applicable",
          "Neighboring covariance has not been admitted to this question.",
        ),
  );
  let estimate: { D: number; sigma2: number; physical: boolean } | null = null;
  if (method === "second-interval") {
    // Pair adjacent increments from the SAME positions. No regeneration and no new random draw.
    const coarse = new Float64Array(evidence.increments.length / 2);
    for (let i = 0; i < coarse.length / evidence.d; i++)
      for (let c = 0; c < evidence.d; c++) {
        const left = evidence.increments[2 * i * evidence.d + c],
          right = evidence.increments[(2 * i + 1) * evidence.d + c];
        if (left === undefined || right === undefined)
          return inferenceRefusal("The paired observation layout is incomplete.");
        coarse[i * evidence.d + c] = left + right;
      }
    const second = covarianceEstimator(coarse, 2 * evidence.dt, {
      d: evidence.d,
      exposure: evidence.exposure,
      knownDrift: evidence.knownDrift,
    });
    if (second.kind !== "accepted") return second;
    outputs.push(value("secondVariance", second.data.variance));
    const solved = twoIntervalCameraEstimate({
      firstVariance: s.variance,
      secondVariance: second.data.variance,
      firstDt: evidence.dt,
      secondDt: 2 * evidence.dt,
      exposure: evidence.exposure,
    });
    if (solved.kind !== "accepted") return solved;
    estimate = solved.data;
  } else {
    outputs.push(
      absent(
        "secondVariance",
        "not-applicable",
        "A second observation interval has not been admitted to this question.",
      ),
    );
    if (method === "covariance")
      estimate = { D: s.D, sigma2: s.sigma2, physical: s.D >= 0 && s.sigma2 >= 0 };
  }
  if (estimate)
    outputs.push(
      value("diffusionEstimate", estimate.D),
      value("noiseEstimate", estimate.sigma2),
      value("physicalSolution", estimate.physical ? 1 : 0),
    );
  else
    for (const id of ["diffusionEstimate", "noiseEstimate", "physicalSolution"])
      outputs.push(
        absent(
          id,
          "underdetermined",
          "One variance leaves a compatible diffusion–noise family. Admit covariance or a second spacing to separate the two unknowns.",
        ),
      );
  return { kind: "accepted", data: outputs };
}
