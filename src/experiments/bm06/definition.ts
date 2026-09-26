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
  /** A one-time value copy from a named BM-01 instance's accepted snapshot, never a live
   * subscription: these four fields are ordinary parameters, captured by value at the moment
   * of copying, so a later change to the source instance cannot alter them. The empty-string /
   * zero quadruple is the "not copied" sentinel; any other state must be all four fields set
   * together (see validateBm06Parameters). */
  copiedDiffusivityInstanceId: string;
  copiedDiffusivityRunId: string;
  copiedDiffusivitySnapshotVersion: number;
  copiedDiffusivityValue: number;
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
  copiedDiffusivityInstanceId: "",
  copiedDiffusivityRunId: "",
  copiedDiffusivitySnapshotVersion: 0,
  copiedDiffusivityValue: 0,
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
    copiedDiffusivityInstanceId: "input",
    copiedDiffusivityRunId: "input",
    copiedDiffusivitySnapshotVersion: "input",
    copiedDiffusivityValue: "input",
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
  admittedOwnerIds?: readonly string[],
): OutputContract {
  return Object.freeze({
    unit,
    semanticKind,
    ownerId,
    statuses: Object.freeze([...statuses]),
    ...(admittedOwnerIds ? { admittedOwnerIds: Object.freeze([...admittedOwnerIds]) } : {}),
  });
}
/**
 * The two registered steppers of the optional grid: the host reference and FrankenSim's compiled
 * diffusion1d_frames (am-frankensim-repin-and-bind-jvhg). The field and its diffusion number come
 * from one stepping, so gridDensity and stabilityRatio admit both and name the same one
 * (protocol/bm06.ts checks). The comparison outputs are the host's reading of that field, whoever
 * stepped it, and keep their own owner.
 */
export const BM06_HOST_GRID_OWNER = "diffusion.ftcs1d";
export const BM06_FRANKENSIM_GRID_OWNER = "fs-wasm.diffusion1d_frames";
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
  gridDensity: contract(
    "1/m",
    "finite-box-cell-density",
    BM06_HOST_GRID_OWNER,
    ["value", "not-applicable"],
    [BM06_FRANKENSIM_GRID_OWNER],
  ),
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
  stabilityRatio: contract(
    "1",
    "explicit-diffusion-number",
    BM06_HOST_GRID_OWNER,
    ["value", "not-applicable"],
    [BM06_FRANKENSIM_GRID_OWNER],
  ),
  gridTimeStep: contract("s", "numerical-time-step", "bm06.evaluate", ["value", "not-applicable"]),
  activeDiffusionCoefficient: contract("m2/s", "active-latent-diffusivity", "bm06.evaluate", [
    "value",
  ]),
  meanRadius2d: contract("m", "latent-mean-radius-2d", "diffusion.moments"),
  rmsRadius2d: contract("m", "latent-vector-rms-2d", "diffusion.moments"),
  mostLikelyRadius2d: contract("m", "latent-most-likely-radius", "diffusion.mostLikelyRadius2d"),
  meanRadius3d: contract("m", "latent-mean-radius-3d", "diffusion.moments"),
  rmsRadius3d: contract("m", "latent-vector-rms-3d", "diffusion.moments"),
});
/**
 * Explanations for the radial outputs above, shown beside them in the view (BoldHarbor's "wired
 * into BM06_OUTPUTS ... and have no explanations of their own"). This is a plain text map, not a
 * ReadingSet: the R0-R3 caption/readings-owners pipeline needs schemas from am-cm-schemas-
 * argument-llm and an audit-readings.ts from am-cm-audit-scripts-d34, neither of which exists
 * yet. When that infrastructure lands, these belong in this instrument's readings-owners file.
 */
export const BM06_RADIAL_EXPLANATIONS = Object.freeze({
  meanRadius2d:
    "The mean 2D radius ⟨r⟩ = √(πDt) is smaller than the RMS radius √⟨r²⟩ = √(4Dt): the extra factor of r in the 2D density weights larger radii more heavily than a signed 1D coordinate does, so the two averages of the same spread disagree.",
  rmsRadius2d:
    "The RMS 2D radius √⟨r²⟩ = √(4Dt) is the square root of the mean squared distance from the start, not the mean distance itself. Squaring before averaging always weights the tail more than averaging the radius directly.",
  mostLikelyRadius2d:
    "The most likely 2D radius, where the density p(r, t) = (r/2Dt) exp(−r²/4Dt) peaks, is √(2Dt): the same number as the 1D RMS displacement. The growing circumference of available positions at radius r (proportional to r itself) exactly cancels the falling Gaussian density near the start, moving the peak away from the origin.",
  meanRadius3d:
    "The mean 3D radius ⟨r⟩ = 4√(Dt/π) counts positions on a growing sphere (area proportional to r²), pulling the average distance from the start out further than the 2D circumference case.",
  rmsRadius3d:
    "The RMS 3D radius √⟨r²⟩ = √(6Dt) reflects three independent coordinate directions, each contributing its own 2Dt to the mean squared displacement (compare the 1D case's single 2Dt).",
});
/**
 * Declared as data only (am-read-result-weave-jex, the weave compiler and evaluator these must
 * validate against, does not exist yet). Conditions are written over fields that already exist
 * on a real accepted snapshot today -- `simulationTime` is `AcceptedSnapshot.simulationTime`
 * (a structural field, not a screen value); every other reference is an existing BM06_OUTPUTS
 * key and its published status/value -- never over what is displayed or selected on screen, so
 * they are ready to compile once that bead lands. Two things are placeholders pending the real
 * contract, named here rather than silently guessed: (1) whether the compiler reads snapshot
 * structural fields like `simulationTime` the same way it reads named outputs, and (2) the exact
 * shape of a "regime" condition (grid on/off has no dedicated output today -- the grid-family
 * outputs the operation already publishes carry status "not-applicable" when the grid switch is
 * off, so "grid is ftcs" is expressed here as `stabilityRatio` having status "value" rather than
 * inventing an unpublished `gridMode` output). A structural test checks the shape below; nothing
 * here has been run through a real weave pass.
 */
export const BM06_WEAVE_PREDICATES = Object.freeze([
  Object.freeze({
    id: "bm06-s4-solution",
    targetSentenceId: "s4-solution",
    pointerText: "the instrument is showing the solution this sentence states.",
    conditions: Object.freeze([
      Object.freeze({ kind: "threshold", field: "simulationTime", comparison: ">", value: 0 }),
      Object.freeze({ kind: "status", outputId: "probabilityDensity", equals: "value" }),
      Object.freeze({ kind: "status", outputId: "intervalProbability", equals: "value" }),
    ]),
  }),
  Object.freeze({
    id: "bm06-s4-grid-agreement",
    targetSentenceId: "s4-diffusion-equation",
    pointerText: "the numerical grid and the analytic curve agree within tolerance.",
    conditions: Object.freeze([
      Object.freeze({ kind: "status", outputId: "stabilityRatio", equals: "value" }),
      Object.freeze({ kind: "threshold", outputId: "wallContact", comparison: "<", value: 0.5 }),
      Object.freeze({
        kind: "threshold",
        outputId: "maxCellMassDifference",
        comparison: "<=",
        value: 1e-3,
        exitComparison: ">",
        exitValue: 2e-3,
      }),
    ]),
  }),
]);
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

/**
 * The instrument's four readings (R0 to R3), checked against §3 to §5 of the Brownian paper
 * (transcript ap-17-549, Annalen pp. 556–560) and against the prepared default snapshot
 * (bm06-example.json): D = 0.4294 μm²/s, λ_x = 0.927 μm at 1 s, 0.719 within ±1 μm, the 2D radii
 * 1.16, 1.31 and 0.927 μm and the 3D radii 1.48 and 1.61 μm. The readings-owners record
 * am-bm-06-gaussian-spread-982y.yaml carries the same text.
 */
export const BM06_CAPTION = Object.freeze({
  r0: "A tiny sphere in water wanders at random, so after a given time it could be anywhere nearby, most likely close to where it began. The spread follows a bell curve, grows as the square root of the time, and is smaller for bigger spheres and thicker liquids.",
  r1: "Section 4 solves the diffusion equation for particles that all start at one point: the fraction found between x and x + dx after a time t is the Gaussian law of errors, exp(−x^{2}/4Dt) dx/√(4πDt), and the root-mean-square displacement along one axis is λ_{x} = √(2Dt). Section 3 had found D for spheres of radius P in a liquid of viscosity k, D = (RT/N)/(6πkP), so Section 5 joins the two: λ_{x} = √t √((RT/N)/(3πkP)). The instrument evaluates this with today's constants for a sphere of radius 0.5 μm in water of viscosity 1.0 mPa·s at 293.15 K: D = 0.429 μm^{2}/s and, after 1 s, λ_{x} = 0.927 μm, with a 71.9 percent chance of lying within 1 μm of the start. Measured in a plane or in space, the distance from the start has root-mean-square values √(4Dt) = 1.31 μm and √(6Dt) = 1.61 μm. At t = 0 the distribution is a single point, which the instrument reports as that limit rather than as a curve. An optional grid solves the same equation step by step in a box with walls, and refuses a time step too long for the scheme to stay stable.",
  r2: "First the diffusion coefficient. Section 3 balances the osmotic push of the suspended spheres against the drag of the liquid, which Stokes gave as 6πηa times the speed for a sphere of radius a in a liquid of viscosity η. In today's symbols the balance gives D = k_{B}T/(6πηa), with k_{B} Boltzmann's constant and T the temperature. Here k_{B}T = 1.381 × 10^{−23} × 293.15 = 4.047 × 10^{−21} J, and the drag factor is 6πηa = 6 × 3.1416 × 0.001 × 0.5 × 10^{−6} = 9.425 × 10^{−9} kg/s. Their ratio is D = 4.047 × 10^{−21}/(9.425 × 10^{−9}) = 4.294 × 10^{−13} m^{2}/s, or 0.4294 μm^{2}/s. Now the spread. Particles that all start at x = 0 are found, after a time t, spread as a bell curve with mean square 2Dt: 2 × 0.4294 × 1 = 0.859 μm^{2} after one second, so the root-mean-square displacement is √0.859 = 0.927 μm. The chance of lying within 1 μm of the start is the area under the bell curve between −1 μm and +1 μm. One root-mean-square distance either side holds 68.3 percent; 1 μm is 1/0.927 = 1.08 of them, and the area out to 1.08 is erf(1.08/√2) = 0.719, or 71.9 percent. Double the time and the mean square doubles, so the spread grows by √2, to 1.31 μm after 2 s; after 60 s it is √60 = 7.75 times as far, 7.18 μm. Make the sphere four times larger and D falls to a quarter, so the spread halves. In a plane, add the two independent axes: the mean square distance is 2Dt + 2Dt = 4Dt = 1.72 μm^{2}, a root mean square of 1.31 μm, while the most likely distance is √(2Dt) = 0.927 μm and the mean distance √(πDt) = 1.16 μm. In space the mean square is 6Dt, a root mean square of 1.61 μm, and the mean distance is √(16Dt/π) = 1.48 μm. Einstein's own example takes N = 6 × 10^{23}, water at 17 °C with a viscosity of 1.35 × 10^{−2} in his units (1.35 mPa·s), and spheres 0.001 mm across: λ_{x} = 8 × 10^{−5} cm, or 0.8 μm in a second, and about 6 μm in a minute.",
  r3: "Einstein wrote k for the viscosity and P for the radius. He kept R and N apart because N was the unknown the paper hoped to measure: Section 5 ends by solving for it, N = (t/λ_{x}^{2})(RT/(3πkP)), and by hoping that a researcher will soon decide the question. Perrin's measurements of 1908 and 1909 confirmed the square-root law and gave N near 7 × 10^{23}. The three-dimensional root mean square is Einstein's too: he remarks that the total displacement has root-mean-square value λ_{x}√3, which is √(6Dt). The two-dimensional radial laws and the grid are later aids, not in the paper; the grid's refusal above DΔt/Δx^{2} = 1/2 is a property of the explicit numerical method, not of the physics. Stokes's law for the drag on a sphere dates from 1851.",
});
