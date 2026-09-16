import type { EstimatorId } from "../../physics/reference/inference.ts";
import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";
export type Bm07ObservationSet = "synthetic" | "perrin-1909" | "kitchen";
export type Bm07Parameters = Readonly<{
  seed: string;
  generatorT: number;
  generatorEta: number;
  generatorRadius: number;
  M: number;
  d: number;
  dt: number;
  T: number;
  eta: number;
  a: number;
  radiusKnown: boolean;
  estimator: EstimatorId;
  coverage: number;
  intervalKind: "conditional" | "combined";
  temperatureError: number;
  viscosityError: number;
  radiusError: number;
  inputCoverage: number;
  coverageTrials: number;
  observationSet: Bm07ObservationSet;
  constantSetId: string;
  calibrationScale: number;
}>;
export const BM07_DEFAULTS: Bm07Parameters = Object.freeze({
  seed: "1905",
  generatorT: 293.15,
  generatorEta: 0.001,
  generatorRadius: 0.5e-6,
  M: 50,
  d: 2,
  dt: 1,
  T: 293.15,
  eta: 0.001,
  a: 0.5e-6,
  radiusKnown: false,
  estimator: "independent-increment-known-zero-drift",
  coverage: 0.95,
  intervalKind: "conditional",
  temperatureError: 0.005,
  viscosityError: 0.02,
  radiusError: 0.1,
  inputCoverage: 0.99,
  coverageTrials: 0,
  observationSet: "synthetic",
  constantSetId: "scenario-bm07-hidden-number",
  calibrationScale: 1,
});
export const BM07_CLASSES: Readonly<Record<keyof Bm07Parameters, ParameterClass>> = Object.freeze({
  seed: "input",
  generatorT: "input",
  generatorEta: "input",
  generatorRadius: "input",
  M: "measurement",
  d: "measurement",
  dt: "measurement",
  T: "estimator",
  eta: "estimator",
  a: "estimator",
  radiusKnown: "estimator",
  estimator: "estimator",
  coverage: "estimator",
  intervalKind: "estimator",
  temperatureError: "estimator",
  viscosityError: "estimator",
  radiusError: "estimator",
  inputCoverage: "estimator",
  coverageTrials: "estimator",
  observationSet: "input",
  constantSetId: "estimator",
  calibrationScale: "measurement",
});
export const BM07_SEMANTIC_KIND_TEXT = Object.freeze({
  "synthetic-recovery":
    "This checks the inference method on data made with a hidden number. It is not evidence that molecules exist.",
  "independent-estimate":
    "This combines the measured displacements with a gas constant measured without counting molecules, so it is an independent estimate of the number of molecules in a mole.",
  "consistency-check":
    "With the 2019 SI constants the gas constant is defined as N_A × k_B, so this compares the measurement with the defined Avogadro constant (equivalently, it estimates Boltzmann's constant). It is not an independent count of molecules.",
} as const);
export const BM07_MODEL = Object.freeze({
  id: "bm07-host-preview-v1",
  constantSetId: "scenario-bm07-hidden-number",
  label: "Synthetic inverse exercise · ideal model, host calculation",
});
const c = (
  unit: string,
  semanticKind: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({
    unit,
    semanticKind,
    ownerId: "inference.bm07",
    statuses: Object.freeze([...statuses]),
  });
const inferred = ["value", "underdetermined"] as const;
const interval = ["value", "underdetermined", "not-applicable"] as const;
export const BM07_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  diffusionCoefficientEstimate: c("m2/s", "statistical-diffusion-estimate", inferred),
  diffusionInterval: c("m2/s", "exact-model-confidence-interval", inferred),
  avogadroNumberEstimate: c("1/mol", "synthetic-recovery", inferred),
  molecularInterval: c("1/mol", "synthetic-recovery", interval),
  conditionalInterval: c("1/mol", "synthetic-recovery", inferred),
  degreesOfFreedom: c("1", "statistical-degrees-of-freedom"),
  sampleCount: c("1", "independent-displacement-count"),
  driftVelocity: c("m/s", "sample-coordinate-mean-velocity", inferred),
  diffusionBiasFactor: c("1", "diffusion-estimator-mean-factor", inferred),
  inverseBiasFactor: c("1", "inverse-estimator-mean-factor", interval),
  inverseVarianceFactor: c("1", "inverse-estimator-variance-factor", interval),
  radiusNumberProduct: c("m/mol", "synthetic-recovery", inferred),
  familyRadii: c("m", "compatible-radius-grid", inferred),
  familyNumbers: c("1/mol", "synthetic-recovery", inferred),
  generatorMolecularNumber: c("1/mol", "hidden-synthetic-parameter"),
  generatorDiffusionCoefficient: c("m2/s", "synthetic-generator-parameter"),
  observationPositions: c("m", "selected-synthetic-positions"),
  observationIncrements: c("m", "selected-synthetic-increments"),
  observationTimes: c("s", "selected-synthetic-times"),
  recordingDraws: c("1", "logical-recording-draws"),
  requestDraws: c("1", "request-evaluation-draws"),
  coverageDraws: c("1", "hypothetical-experiment-draws"),
  reusedRecording: c("1", "recording-cache-reuse"),
  retainedBytes: c("1", "retained-recording-bytes"),
  coverageDiffusion: c("1", "normalized-conditional-diffusion-intervals", interval),
  coverageMolecular: c("1", "normalized-conditional-molecular-intervals", interval),
  diffusionCoveringCount: c("1", "observed-interval-covering-count", interval),
  molecularCoveringCount: c("1", "observed-interval-covering-count", interval),
  observationDigest: c("1", "observation-data-digest"),
});
export function bm07Layout(id: string, p: Bm07Parameters): number | null {
  if (["diffusionInterval", "molecularInterval", "conditionalInterval"].includes(id)) return 2;
  if (id === "driftVelocity") return p.d;
  if (["familyRadii", "familyNumbers"].includes(id)) return 41;
  if (id === "observationPositions") return (p.M + 1) * p.d;
  if (id === "observationIncrements") return p.M * p.d;
  if (id === "observationTimes") return p.M + 1;
  if (["coverageDiffusion", "coverageMolecular"].includes(id)) return p.coverageTrials * 4;
  return null;
}
