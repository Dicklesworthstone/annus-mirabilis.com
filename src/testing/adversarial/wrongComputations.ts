/**
 * THE PLAUSIBLE WRONG COMPUTATIONS, KEPT WHERE THEY CAN NEVER SHIP (am-ver-adversarial-audit-1ef).
 *
 * An adversarial fixture is a deliberately plausible wrong result. It has value only if it FAILS
 * for the intended reason when the wrong computation is used and PASSES when the owner is called,
 * so each row below pairs a named `wrong*` function with the real evaluator and its own test
 * asserts both halves. A fixture that fails for a different reason -- a type error, another check --
 * proves nothing, which is why every row asserts the specific quantity rather than "it threw".
 *
 * Each function here is the error a careful person actually makes. None is a strawman:
 *
 *   row 1   RMS displacement scales with D, so halving D halves it.      It scales with sqrt(D).
 *   row 11  The low-speed proxy IS the mass coefficient.                 It is the v -> 0 limit.
 *   row 12  A 64-bit seed is a number, so JSON carries it.               Above 2^53 it does not.
 *   row 13  Einstein's 0.8 um came from a 1 um particle.                 It came from a = 0.5 um.
 *
 * WHY THEY LIVE IN src/testing/ AND ARE NAMED `wrong*`: so they cannot quietly become fallbacks.
 * `adversarialImports.test.ts` asserts no production module imports this file, which is the
 * mechanical half of that promise; the naming is the half a reader enforces.
 *
 * ELEVEN ROWS ARE NOT HERE YET and are named in ADVERSARIAL_ROWS below rather than left to be
 * rediscovered. The four implemented are the ones whose owner exists today AND whose expected value
 * the bead states, so each assertion is a number that was MEASURED against the real evaluator
 * before it was written down, not copied from the specification and hoped for.
 */

/** Row 1, wrong: RMS displacement taken as proportional to D rather than to sqrt(D). */
export function wrongDiffusivityScaling(rmsAtD: number, factor: number): number {
  return rmsAtD * factor;
}

/** Row 1, right: the scaling the model gives. Stated here so the test compares two claims. */
export function correctDiffusivityScaling(rmsAtD: number, factor: number): number {
  return rmsAtD * Math.sqrt(factor);
}

/**
 * Row 11, wrong: the finite-speed proxy read as the exact mass coefficient at any speed.
 *
 * `2L(gamma - 1)/v^2` is what a reader computes from the paper's own quantities at a finite speed.
 * It tends to L/c^2 only as v -> 0, and the excess is about (3/4)(v/c)^2, so at 0.6c it is already
 * about 39% high. Taking it for the coefficient is the error.
 */
export function wrongMassCoefficientFromProxy(proxyAtBeta: number): number {
  return proxyAtBeta;
}

/**
 * Row 12, wrong: a 64-bit seed carried through ordinary JSON as a number.
 *
 * Returns the seed as it survives, so the test compares strings rather than asserting a throw:
 * nothing throws here, which is exactly why the defect is plausible.
 */
export function wrongSeedTransport(seedDecimal: string): string {
  const round = JSON.parse(JSON.stringify({ seed: Number(seedDecimal) })) as { seed: number };
  return String(round.seed);
}

/**
 * Row 3, wrong: camera noise leaving neighbouring increments independent.
 *
 * Localization error enters two consecutive increments with opposite sign, so it induces a NEGATIVE
 * covariance even when the underlying walk has independent steps. A reader who treats the measured
 * increments as independent gets zero, and nothing about the numbers looks wrong: the variance is
 * still inflated in the right direction, so a variance-only check passes.
 */
export function wrongNeighbouringCovariance(): number {
  return 0;
}

/**
 * Row 4, wrong: an unbiased estimate staying unbiased after inversion.
 *
 * E[1/X] is not 1/E[X]. For a chi-square-distributed diffusivity estimate with q degrees of
 * freedom the inverse carries a factor q/(q - 2), which is 1.25 at q = 10 and diverges as q -> 2.
 * Taking the inversion as bias-preserving means asserting a factor of exactly 1.
 */
export function wrongInversionMeanFactor(): number {
  return 1;
}

/**
 * Row 2, wrong: the radial distribution taken as an ordinary Gaussian in r.
 *
 * The real 2D radial density is p_r(r,t) = r/(2Dt) e^{-r^2/(4Dt)}, which carries the factor r from
 * the growing circumference of available positions. A reader who writes the familiar Gaussian in r
 * instead keeps the exponential and drops that factor, and the result still looks like a
 * distribution: positive, peaked, decaying. It fails three separate ways, which is why the row
 * checks normalization AND both moments rather than one of them.
 */
export function wrongRadialDensity(r: number, t: number, D: number): number {
  return Math.exp(-(r * r) / (4 * D * t)) / Math.sqrt(4 * Math.PI * D * t);
}
/** Row 2, right: the radial density the model gives, with the circumference factor. */
export function correctRadialDensity(r: number, t: number, D: number): number {
  return (r / (2 * D * t)) * Math.exp(-(r * r) / (4 * D * t));
}
/** Row 2, wrong: the second moment that naive density implies, 2Dt rather than 4Dt. */
export function wrongRadialSecondMoment(D: number, t: number): number {
  return 2 * D * t;
}
/** Row 2, wrong: the mean radius it implies, 2 sqrt(Dt/pi) rather than sqrt(pi D t). */
export function wrongRadialMeanRadius(D: number, t: number): number {
  return 2 * Math.sqrt((D * t) / Math.PI);
}

/**
 * Row 7, wrong: a light complex contracting like a material volume, by 1/gamma.
 *
 * Expressed as the angle-independent factor, because that IS the error: the packet's volume factor
 * is 1/q with q = gamma(1 - beta cos theta), so it depends on the ray's direction, and a reader who
 * reaches for length contraction gets 1/gamma at every angle. `waves.ts` already carries this as
 * `lightComplexMaterialContractionCountermodel`; this wrapper exists so the row reads with the
 * same shape as the others and names the claim in its own terms.
 */
export function wrongLightComplexVolumeFactor(gammaValue: number): number {
  return 1 / gammaValue;
}

/** Row 13, wrong: Einstein's printed displacement attributed to a 1 micron radius. */
export const WRONG_PRINTED_RADIUS_M = 1e-6;
/** Row 13, right: the radius that actually reproduces the printed figure. */
export const CORRECT_PRINTED_RADIUS_M = 0.5e-6;

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
}>[] = Object.freeze([
  Object.freeze({
    row: 1,
    claim: "Half the diffusivity means half the displacement",
    owner: "physics/reference/diffusion/distributions.ts rmsDisplacement",
    state: "implemented" as const,
  }),
  Object.freeze({
    row: 2,
    claim: "A radial distribution is an ordinary Gaussian",
    owner: "physics/reference/diffusion/distributions.ts radialPropagator2d, moments",
    state: "implemented" as const,
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
    owner: "physics/reference/radiation",
    state: "not-yet" as const,
  }),
  Object.freeze({
    row: 6,
    claim: "A spectral-axis relabelling preserves density",
    owner: "physics/reference/radiation",
    state: "not-yet" as const,
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
    owner: "physics/reference/electron.ts",
    state: "not-yet" as const,
  }),
  Object.freeze({
    row: 9,
    claim: "Changing observer means starting a new experiment",
    owner: "experiments/store command classes (browser row)",
    state: "not-yet" as const,
  }),
  Object.freeze({
    row: 10,
    claim: "A moving mirror receives the fixed-surface incident power",
    owner: "physics/reference/waves.ts",
    state: "not-yet" as const,
  }),
  Object.freeze({
    row: 11,
    claim: "The low-speed proxy is the exact mass coefficient at every speed",
    owner: "physics/reference/massEnergy.ts finiteSpeedProxy, limitingCoefficient",
    state: "implemented" as const,
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
    owner: "physics/reference/radiation",
    state: "not-yet" as const,
  }),
  Object.freeze({
    row: 15,
    claim: "A neutral conductor with current violates |J/rho| < c",
    owner: "physics/reference/fields.ts",
    state: "not-yet" as const,
  }),
]);
