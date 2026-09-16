import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

/** BM-06's executable host-reference subset. No physics is evaluated by this manifest. */
export type Bm06Parameters = Readonly<{
  T: number;
  eta: number;
  a: number;
  t: number;
  lower: number;
  upper: number;
  gridEnabled: boolean;
  n: number;
  dx: number;
  steps: number;
}>;
export const BM06_DEFAULTS: Bm06Parameters = Object.freeze({
  T: 293.15,
  eta: 0.001,
  a: 0.5e-6,
  t: 1,
  lower: -1e-6,
  upper: 1e-6,
  gridEnabled: false,
  n: 101,
  dx: 1e-7,
  steps: 250,
});
export const BM06_PARAMETER_CLASSES: Readonly<Record<keyof Bm06Parameters, ParameterClass>> =
  Object.freeze({
    T: "input",
    eta: "input",
    a: "input",
    t: "input",
    lower: "measurement",
    upper: "measurement",
    gridEnabled: "input",
    n: "input",
    dx: "input",
    steps: "input",
  });
export const BM06_BUDGET = Object.freeze({ workUnits: 4_000_000, allocationBytes: 16_000_000 });
export const BM06_MODEL = Object.freeze({
  id: "bm06-host-preview-v1",
  constantSetId: "modern-si-2019",
  ownerKind: "host-reference",
  label: "Ideal model, host calculation",
  source: "src/workers/operations/bm06.ts",
  assumptions: Object.freeze([
    "Dilute spherical tracers in a homogeneous Newtonian liquid; no drift or particle interactions.",
    "Low Reynolds number and times long compared with momentum relaxation are assumed, not checked.",
    "The analytic curve describes an unbounded line; the numerical grid has reflecting walls.",
    "These are consequences of a model, not measurements or evidence that the model describes nature.",
  ]),
});
function contract(
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract {
  return Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });
}
export const BM06_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  diffusionCoefficient: contract("m2/s", "latent-diffusivity", "diffusion.stokesEinsteinD"),
  rmsDisplacement1d: contract("m", "latent-coordinate-rms", "diffusion.rmsDisplacement"),
  meanSquareDisplacement1d: contract("m2", "latent-coordinate-second-moment", "diffusion.moments"),
  intervalProbability: contract("1", "probability", "diffusion.intervalProbability"),
  positionCoordinate1d: contract("m", "plot-sample-coordinate", "bm06.evaluate"),
  probabilityDensity: contract("1/m", "coordinate-density", "diffusion.gaussianPropagator", [
    "value",
    "analytic-limit",
  ]),
  comparisonTimes: contract("s", "declared-comparison-times", "bm06.evaluate"),
  comparisonRms: contract("m", "latent-coordinate-rms", "diffusion.rmsDisplacement"),
  gridDensity: contract("1/m", "finite-box-cell-density", "diffusion.ftcs1d", [
    "value",
    "not-applicable",
  ]),
  cellMasses: contract("1", "finite-box-cell-probability", "diffusion.ftcsAnalyticComparison", [
    "value",
    "not-applicable",
  ]),
  cellProbabilities: contract(
    "1",
    "unbounded-cell-probability",
    "diffusion.ftcsAnalyticComparison",
    ["value", "not-applicable"],
  ),
  maxCellMassDifference: contract(
    "1",
    "probability-difference",
    "diffusion.ftcsAnalyticComparison",
    ["value", "not-applicable"],
  ),
  wallContact: contract("1", "wall-contact-indicator", "diffusion.ftcsAnalyticComparison", [
    "value",
    "not-applicable",
  ]),
  stabilityRatio: contract("1", "explicit-diffusion-number", "diffusion.ftcs1d", [
    "value",
    "not-applicable",
  ]),
  gridTimeStep: contract("s", "numerical-time-step", "bm06.evaluate", ["value", "not-applicable"]),
});
export const BM06_PRESETS = Object.freeze({
  "modern-one-second": Object.freeze({ label: "One second", parameters: BM06_DEFAULTS }),
  "modern-one-minute": Object.freeze({
    label: "One minute",
    parameters: Object.freeze({ ...BM06_DEFAULTS, t: 60 }),
  }),
  "point-distribution": Object.freeze({
    label: "The starting point",
    parameters: Object.freeze({ ...BM06_DEFAULTS, t: 0 }),
  }),
  "grid-comparison": Object.freeze({
    label: "Compare with a numerical grid",
    parameters: Object.freeze({ ...BM06_DEFAULTS, gridEnabled: true }),
  }),
  "unstable-grid": Object.freeze({
    label: "Try a step that is too large",
    parameters: Object.freeze({ ...BM06_DEFAULTS, gridEnabled: true, steps: 1 }),
  }),
});
