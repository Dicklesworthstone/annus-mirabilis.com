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
 * Row 10, wrong: a moving mirror intercepting the fixed-surface incident power.
 *
 * A mirror receding at beta sweeps out less radiation per unit time than a stationary one, so the
 * intercepted power is I*Am*(1 - beta) rather than I*Am. Using the fixed-surface value leaves the
 * energy ledger unbalanced by exactly I*Am*beta, and the error is plausible because I*Am is the
 * right answer for the mirror at rest and nothing in the formula looks frame-dependent.
 */
export function wrongFixedSurfaceIncidentPower(intensity: number, area: number): number {
  return intensity * area;
}

/**
 * Row 8, wrong: a force whose numerical components are the same in both frames.
 *
 * The transverse coefficient is gamma^2 in the source convention and gamma in the laboratory one,
 * so a reader who carries one number between frames is out by gamma. The error is plausible because
 * both are "the transverse mass" and the papers of the period used both conventions.
 */
export function wrongFrameIndependentTransverseCoefficient(laboratoryCoefficient: number): number {
  return laboratoryCoefficient;
}

/**
 * Row 15, wrong: a |J/rho| < c gate applied to a four-current.
 *
 * The constraint on a four-current is the INVARIANT (c*rho)^2 - |J|^2, whose sign says whether it is
 * timelike or spacelike. A ratio test divides by the charge density, so a neutral conductor carrying
 * a current -- rho = 0, which is an ordinary piece of copper -- gives Infinity and is rejected as
 * superluminal. Returns the ratio so the test can show what the gate would see.
 */
export function wrongChargeCurrentRatio(rho: number, jx: number, c = 299792458): number {
  return Math.abs(jx / rho) / c;
}

/**
 * Row 5, wrong: an arbitrary entropy-density constant that cancels.
 *
 * Wien's spectral entropy density is fixed only up to an additive function of frequency. A reader
 * who assumes it cancels in a volume change asserts that the entropy difference is unchanged by
 * C(nu). It is not: at fixed energy and band the retained constant adds dNu * C(nu) * (V - V0).
 */
export function wrongEntropyAssumesConstantCancels(deltaS: number): number {
  return deltaS;
}

/**
 * Row 6, wrong: a spectral density relabelled by substituting lambda = c/nu.
 *
 * A density is per unit of its own axis, so changing the axis requires the Jacobian |dnu/dlambda| =
 * nu^2/c. Substituting the variable alone keeps the NUMBER and changes what it is a density of, and
 * the result still looks like a spectrum.
 */
export function wrongRelabelledDensity(uNu: number): number {
  return uNu;
}

/** Row 14, wrong: the locked-position probability taken as f^n. */
export function wrongLockedPositionsProbability(n: number, f: number): number {
  return f ** n;
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
