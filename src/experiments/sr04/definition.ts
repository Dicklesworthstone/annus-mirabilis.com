import type { ConstraintId } from "../../physics/reference/kinematics.ts";
import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

/** Re-exported so components read this type through the experiment layer, never by importing
 * src/physics/reference/* directly (the import-boundary guard, src/testing/noPhysicsInComponents.test.ts). */
export type { ConstraintId };

export const ALL_CONSTRAINTS: readonly ConstraintId[] = Object.freeze([
  "right-moving-light",
  "left-moving-light",
  "reciprocity",
  "isotropy",
  "identity-branch",
  "transverse-light",
]);

export type Sr04Parameters = Readonly<{
  /** Frame speed v, as a fraction of c (|v/c| <= 0.95). */
  vOverC: number;
  /** Which construction constraints the reader has enabled, as a comma-joined list (the shared
   * Parameters record type is Record<string, number | string | boolean>, so an array cannot
   * travel here directly; splitConstraints()/joinConstraints() convert at the boundary). */
  enabledConstraints: string;
  /** A hand-built candidate the reader is testing against checkCandidateMap; undefined means
   * "no hand-built candidate yet, just the enabled-constraint family." */
  candidateA: number;
  candidateB: number;
  candidateD: number;
  candidateTransverseScale: number;
  testCandidate: boolean;
  /** The slow-case demonstration (am-sr-04-lorentz-map-px1k: "needs a slow observer"). */
  observerSpeed: number;
  objectSpeed: number;
  showLaterAids: boolean;
}>;

export function joinConstraints(ids: readonly ConstraintId[]): string {
  return ids.join(",");
}

export function splitConstraints(joined: string): readonly ConstraintId[] {
  return joined.length === 0 ? [] : (joined.split(",") as ConstraintId[]);
}

export const SR04_DEFAULTS: Sr04Parameters = Object.freeze({
  vOverC: 0.6,
  enabledConstraints: "",
  candidateA: 1,
  candidateB: 1,
  candidateD: 0,
  candidateTransverseScale: 1,
  testCandidate: false,
  observerSpeed: 30,
  objectSpeed: 10,
  showLaterAids: false,
});

export const SR04_CLASSES: Readonly<Record<keyof Sr04Parameters, ParameterClass>> = Object.freeze({
  vOverC: "observer",
  enabledConstraints: "estimator",
  candidateA: "input",
  candidateB: "input",
  candidateD: "input",
  candidateTransverseScale: "input",
  testCandidate: "input",
  observerSpeed: "measurement",
  objectSpeed: "measurement",
  showLaterAids: "presentation",
});

export const SR04_MODEL = Object.freeze({
  id: "sr-04-host-v1",
  constantSetId: "modern-si-2019",
  label: "Ideal model, host calculation",
});

export const SR04_QUESTION =
  "What map between two inertial frames keeps both postulates, and what does each requirement decide?";

export const SR04_NOT_MODELED = Object.freeze([
  "non-aligned axes and rotations",
  "accelerated frames",
  "gravity",
  "a fully rigorous derivation of linearity",
  "origins that do not coincide",
  "non-collinear composition (the velocity-composition laboratory)",
]);

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const SR04_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  constraintFamily: c("1", "candidate-map-family-status", "kinematics.solveCandidateFamily", [
    "value",
    "underdetermined",
    "outside-domain",
  ]),
  candidateResiduals: c("1", "candidate-map-residuals", "kinematics.checkCandidateMap"),
  slowCaseGalilean: c("m/s", "galilean-composed-velocity", "kinematics.galileanVelocity"),
  slowCaseDeviation: c(
    "m/s",
    "relativistic-galilean-deviation",
    "kinematics.galileanRelativisticVelocityDifference",
  ),
  rightRayFraction: c(
    "1",
    "galilean-transformed-light-speed-fraction",
    "kinematics.galileanVelocity",
  ),
  leftRayFraction: c(
    "1",
    "galilean-transformed-light-speed-fraction",
    "kinematics.galileanVelocity",
  ),
  lorentzFactor: c("1", "lorentz-factor", "kinematics.gamma"),
  rapidity: c("1", "rapidity", "kinematics.rapidity", ["value", "outside-domain"]),
});

/**
 * The instrument's four readings (R0 to R3), checked against §3 of the relativity paper and
 * against the owner (kinematics/constraints.ts through evaluateSr04) at the default v = 0.6c: the
 * Galilean ray fractions 0.4c and −1.6c, the fixed map a = b = 1.25, d = −2.50 × 10^{−9} s/m, the
 * slow-case difference 6.7 × 10^{−14} m/s, and the later aids (eigenvalues 2 and 0.5, rapidity
 * ln 2). The readings-owners record am-sr-04-lorentz-map-px1k.yaml carries the same text.
 */
export const SR04_CAPTION = Object.freeze({
  r0: "Here you build, one requirement at a time, the rule that turns one observer's positions and times into another's. Ask that light have the same speed for both observers and that neither observer be special, and only one rule is left: the one Einstein found in 1905.",
  r1: "The candidate maps have the form x′ = a(x − vt) and t′ = bt + dx, with a separate scale across the motion, and the engine solves only the requirements you tick. With none ticked it tests the ordinary change of frame, a = b = 1 and d = 0: a slow object's speeds subtract as mechanics expects, but at v = 0.6c a ray of light comes out at 0.4c going one way and 1.6c going the other. Requiring light at c in both directions forces b = a and d = −av/c^{2}, and leaves a free. Reciprocity, that the map from k back to K is the same kind of map with −v, gives a(v)a(−v)(1 − v^{2}/c^{2}) = 1. Isotropy, that space has no preferred direction, gives a(v) = a(−v). Together they leave a = ±1/√(1 − v^{2}/c^{2}), and the branch that does nothing at v = 0 takes the positive root, 1.25 at 0.6c. A ray crossing at right angles then fixes the scale across the motion at 1. Section 3 of the paper reaches the same map by another path. It synchronizes k's clocks by the rule of Section 1, solves the resulting equation for the time τ of k, and is left with an unknown factor φ(v). Einstein then shows φ(v)φ(−v) = 1 and, by symmetry, φ(v) = φ(−v), so φ(v) = 1. Those two steps are this instrument's reciprocity and isotropy.",
  r2: "A candidate map takes a position x and time t in K to x′ and t′ in k, which moves at speed v along x: x′ = a(x − vt) and t′ = bt + dx. The numbers a, b and d are what we want to find. First requirement: a ray of light moving right at speed c in K, x = ct, must move at c in k too. Put x = ct into the map: x′ = a(ct − vt) = a(c − v)t, and t′ = bt + dct = (b + dc)t. Light at c in k means x′ = ct′, so a(c − v) = c(b + dc). Second requirement: a ray moving left, x = −ct. Then x′ = −a(c + v)t and t′ = (b − dc)t, and x′ = −ct′ gives a(c + v) = c(b − dc). Add the two equations: the terms in d cancel and 2ac = 2bc, so b = a. Subtract the first from the second: 2av = −2dc^{2}, so d = −av/c^{2}. The map is now x′ = a(x − vt) and t′ = a(t − vx/c^{2}), with one unknown, a. Third requirement, reciprocity: going from k back to K must be the same kind of map with speed −v and its own factor a(−v). Do one map and then the other: x″ = a(−v)(x′ + vt′) = a(−v)a(v)[(x − vt) + v(t − vx/c^{2})] = a(v)a(−v)(1 − v^{2}/c^{2})x. Coming back must return x unchanged, so a(v)a(−v)(1 − v^{2}/c^{2}) = 1. Fourth requirement, isotropy: turning the x-axis around turns motion at v into motion at −v, and if space has no preferred direction the factor cannot care, so a(v) = a(−v). Put that into the third: a^{2}(1 − v^{2}/c^{2}) = 1, so a = ±1/√(1 − v^{2}/c^{2}). Fifth, the branch: at v = 0 the map must leave everything alone, x′ = x, which needs a = +1, and a cannot jump from +1 to −1 as v changes smoothly. So a is the positive root. At v = 0.6c: 1 − 0.36 = 0.64, √0.64 = 0.8, and a = 1/0.8 = 1.25. Then b = 1.25, and d = −1.25 × 0.6c/c^{2} = −0.75/c, which in seconds per metre is −0.75/(2.998 × 10^{8}) = −2.50 × 10^{−9} s/m, the value in the table. Last, a ray crossing k at right angles, moving along y′ at c in k. In K it also drifts along x with the frame, so it crosses at √(c^{2} − v^{2}) = 0.8c, and y = 0.8ct. The map gives t′ = 1.25(t − 0.6 × 0.6t) = 1.25 × 0.64t = 0.8t. If the scale across the motion is s, then y′ = sy = 0.8sct, and y′ = ct′ = 0.8ct, so s = 1. The slow case shows why nobody noticed: an object at 10 m/s seen by an observer moving at 30 m/s moves at 10 − 30 = −20 m/s by the ordinary rule, and the exact map differs from that by 6.7 × 10^{−14} m/s.",
  r3: "Einstein wrote V for the speed of light and ξ, η, ζ, τ for k's coordinates, and he set x′ = x − vt as a Galilean auxiliary, not the moving coordinate. His Section 3 begins from clocks, not from light speeds in two directions: light leaves k's origin at τ_{0}, is reflected at x′ at τ_{1} and returns at τ_{2}, and the rule of Section 1 requires ½(τ_{0} + τ_{2}) = τ_{1}. For small x′ this gives ∂τ/∂x′ + v/(V^{2} − v^{2}) ∂τ/∂t = 0, and with linearity, which he takes from the homogeneity of space and time, τ = φ(v)β(t − vx/V^{2}), where β is the factor now written γ. He fixes φ(v) with a third system moving at −v and a rod set across the motion, whose length in K cannot depend on the direction of travel. Lorentz had published equivalent coordinate equations in 1904, as a change of variables with a local time, and Poincaré named them the Lorentz transformation in June 1905 and showed they form a group; the paper cites neither. The matrix, its eigenvalues 2 and 0.5 on the light lines at 0.6c, and the rapidity ln 2 = 0.693 are later aids: the matrix picture is Minkowski's of 1908, and the word rapidity is Robb's of 1911.",
});
