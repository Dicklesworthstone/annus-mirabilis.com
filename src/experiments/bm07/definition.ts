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

/**
 * The instrument's four readings (R0 to R3), checked against §5 of the Brownian paper (transcript
 * ap-17-549, Annalen pp. 559–560) and against the owner (createBm07Recording and measureBm07) at
 * BM07_DEFAULTS and with radiusKnown: hidden N = 3.026 × 10^{23}, D̂ = 8.83 × 10^{−13} m²/s in
 * [6.81, 11.89] × 10^{−13}, a·N = 1.465 × 10^{17} m/mol, N̂ = 2.93 × 10^{23} in [2.17, 3.80] × 10^{23},
 * inverse bias 100/98. These replace the record's earlier bm-07 texts, whose R1 and R3 were lists of
 * topics; the record am-bm-07-infer-molecular-number-frf9.yaml carries the same text.
 */
export const BM07_CAPTION = Object.freeze({
  r0: "Watching a small sphere wander tells you how fast it spreads. If you also know the temperature, how thick the liquid is and how big the sphere is, the spreading tells you how many molecules make up a mole, and the lab shows how sure a limited number of observations can make you.",
  r1: "Section 5 ends by turning its formula around: N = (t/λ_{x}^{2})(RT/(3πkP)), so a measured mean square displacement, with the temperature, the viscosity and the radius, gives the number of molecules in a gram-molecule. The instrument does this with synthetic data from a generator whose number is hidden, 3.03 × 10^{23}, deliberately not today's value, so the exercise tests the method and not the world. From 50 steps of 1 s in two directions, 100 squared steps, it estimates D = 8.83 × 10^{−13} m^{2}/s, with a 95 percent interval from 6.81 to 11.89 × 10^{−13}. Displacements alone fix only the product of radius and number, a·N = 1.46 × 10^{17} m/mol. Given the radius, 0.5 μm, the estimate is N = 2.93 × 10^{23}, with an interval from 2.17 to 3.80 × 10^{23} that contains the hidden value. With today's defined constants the same inversion is only a consistency check, because N_{A} is now fixed by definition.",
  r2: "Start from what each step tells you. Along one axis a sphere's step Δ over a time τ has mean square 2Dτ, so D can be estimated as the average of Δ^{2}/(2τ). The instrument records 50 steps of τ = 1 s in two directions, 100 squared steps in all, and their average divided by 2 gives D̂ = 8.83 × 10^{−13} m^{2}/s. Because each step is a Gaussian draw, 100 D̂/D follows a chi-square law with 100 degrees of freedom, whose middle 95 percent runs from 74.2 to 129.6. So D lies between 100 D̂/129.6 = 6.81 × 10^{−13} and 100 D̂/74.2 = 11.89 × 10^{−13} m^{2}/s; the generator's own D, 8.55 × 10^{−13}, is inside. Now invert. Einstein's D = (RT/N)/(6πηa) gives a·N = RT/(6πηD̂). With R = 8.314 J/(mol K), T = 293.15 K and η = 0.001 Pa s, RT = 2437 J/mol and 6πηD̂ = 6 × 3.1416 × 0.001 × 8.83 × 10^{−13} = 1.664 × 10^{−14}, so a·N = 2437/(1.664 × 10^{−14}) = 1.465 × 10^{17} m/mol. A sphere twice as large with half as many molecules per mole wanders in exactly the same way, so the data cannot tell them apart. Give the radius, a = 0.5 × 10^{−6} m, and N = 1.465 × 10^{17}/(0.5 × 10^{−6}) = 2.93 × 10^{23}. Because N goes as 1/D, the interval turns over: the largest D gives the smallest N, so N lies between 2.17 and 3.80 × 10^{23}. Inverting also biases the estimate, since the average of 1/D̂ exceeds 1/D by the factor 100/98 = 1.020.",
  r3: "Einstein's printed form is N = (t/λ_{x}^{2})(RT/(3πkP)), with k the viscosity and P the radius, and he closed by hoping a researcher would soon decide the question. Perrin did, in 1908 and 1909, following grains of gamboge and mastic whose radius he measured separately, and found N near 7 × 10^{23}. The chi-square interval, the turned-over interval for N and the bias factor are modern statistics that Einstein did not give. Since 2019 N_{A} = 6.022 140 76 × 10^{23} mol^{−1} exactly and k_{B} is fixed too, so an inversion with today's constants recovers its own inputs: it checks the method and does not count molecules.",
});
