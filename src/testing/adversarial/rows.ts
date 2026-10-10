/**
 * THE FIFTEEN ADVERSARIAL ROWS, AS DATA (am-ver-adversarial-audit-1ef).
 *
 * SPLIT OUT OF wrongComputations.ts BECAUSE THE IMPORT SCAN CAUGHT IT. `scripts/audit-adversarial.ts`
 * needs this registry, and while the two lived in one module the scan correctly reported the audit
 * script as a production module importing the wrong computations -- which is exactly the thing the
 * scan exists to forbid, and an allowlist would have been the wrong repair.
 *
 * So the registry is metadata any consumer may read, and the `wrong*` functions stay in a module
 * nothing outside src/testing/adversarial/ may touch. The separation is the point: a consumer of
 * the row list no longer pulls in the plausible wrong answers.
 */

/**
 * All fifteen rows the audit owes, with the state of each.
 *
 * A registry rather than a comment, so `adversarialRows.test.ts` can assert that the implemented
 * set and the files on disk agree, and so the eleven outstanding rows are a list someone can work
 * from instead of a sentence in a bead. `owner` names the module whose call the row compares
 * against, which is the thing to check exists before starting a row.
 */
export const ADVERSARIAL_ROWS: readonly Readonly<{
  row: number;
  claim: string;
  owner: string;
  state: "implemented" | "not-yet";
  /**
   * A misconception record describing the same error, where one has been CONFIRMED by reading it.
   *
   * Declared rather than inferred. The audit script first computed this column by keyword, and the
   * result was noise: row 13 matched 28 of the 29 records, because "Einstein" appears in nearly all
   * of them. A column of plausible links nobody checked is worse than an empty one, so a link
   * appears here only after someone read the record's `whyTempting` and found the same error, and
   * the script refuses a declared id that is not on disk.
   */
  misconception?: string;
}>[] = Object.freeze([
  Object.freeze({
    row: 1,
    claim: "Half the diffusivity means half the displacement",
    owner: "physics/reference/diffusion/distributions.ts rmsDisplacement",
    state: "implemented" as const,
    /** Confirmed by reading the record: whyTempting: "doubling it halves D, and that halving seems to carry straight over to the distance". */
    misconception: "brownian-motion/misc-bm-viscosity-halves",
  }),
  Object.freeze({
    row: 2,
    claim: "A radial distribution is an ordinary Gaussian",
    owner: "physics/reference/diffusion/distributions.ts radialPropagator2d, moments",
    state: "implemented" as const,
    /** Confirmed by reading the record: whyTempting: "the bell curve is the familiar picture of that law". */
    misconception: "brownian-motion/misc-bm-radial-gaussian",
  }),
  Object.freeze({
    row: 3,
    claim: "Camera noise leaves neighbouring increments independent",
    owner: "physics/reference/inference/observation.ts cameraMoments",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 4,
    claim: "An unbiased estimate stays unbiased after inversion",
    owner: "physics/reference/inference.ts inverseBias",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 5,
    claim: "An arbitrary entropy-density constant cancels",
    owner: "physics/reference/radiation/entropy.ts entropyWithUnfixedConstant",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 6,
    claim: "A spectral-axis relabelling preserves density",
    owner: "physics/reference/radiation/spectra.ts spectralDensityCoordinateTransform, planckPeak*",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 7,
    claim: "A light complex contracts like material volume (corrected fixture)",
    owner:
      "physics/reference/waves.ts lightComplexFactors, lightComplexMaterialContractionCountermodel",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 8,
    claim: "Forces have equal numerical components in different frames",
    owner: "physics/reference/electron.ts transverseMassComoving, transverseMassLaboratory",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 9,
    claim: "Changing observer means starting a new experiment",
    owner: "experiments/commands/invariants.ts checkCommandInvariants (observer-change case)",
    state: "implemented" as const,
    // No misconception link: this is a runtime contract error, not one of the nine
    // special-relativity records, and none of them describes it. Undeclared rather than guessed.
  }),
  Object.freeze({
    row: 10,
    claim: "A moving mirror receives the fixed-surface incident power",
    owner: "physics/reference/waves.ts movingMirror",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 11,
    claim: "The low-speed proxy is the exact mass coefficient at every speed",
    owner: "physics/reference/massEnergy.ts finiteSpeedProxy, limitingCoefficient",
    state: "implemented" as const,
    /** Confirmed by reading the record: whyTempting: "looks like an exact kinetic energy". */
    misconception: "mass-energy/misc-me-low-speed-exact",
  }),
  Object.freeze({
    row: 12,
    claim: "A large seed can be carried as a JSON number",
    owner: "experiments/identity/jsonCodec.ts stringifyWithU64, parseWithU64",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 13,
    claim: "Radius = 1 um reproduces Einstein's 0.8 um",
    owner: "physics/reference/diffusion/printedDisplacement.ts printedBrownianDisplacement",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 14,
    claim: "The locked-position probability is f^n",
    owner: "physics/reference/radiation/configurationCounts.ts lockedPositionsProbability",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 15,
    claim: "A neutral conductor with current violates |J/rho| < c",
    owner: "physics/reference/fields.ts fourCurrentInvariants",
    state: "implemented" as const,
  }),
]);
