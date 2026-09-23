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
