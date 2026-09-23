import {
  ELEMENTARY_CHARGE,
  type Sr02FieldModel,
  type Sr02Frame,
  type Sr02Mode,
  type Sr02Path,
} from "../../physics/reference/fields.ts";
import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Sr02Parameters = Readonly<{
  mode: Sr02Mode;
  descriptionFrame: Sr02Frame;
  speed: number;
  fieldModel: Sr02FieldModel;
  magneticField: number;
  dipoleMoment: number;
  testPointDistance: number;
  segmentLength: number;
  testCharge: number;
  pathOrientation: Sr02Path;
  sliceDeclared: boolean;
  resolution: "withheld" | "shown";
  motionState: "magnet-moves" | "coil-moves";
}>;

export const SR02_DEFAULTS: Sr02Parameters = Object.freeze({
  mode: "analytic",
  descriptionFrame: "magnet-rest",
  speed: 10,
  fieldModel: "uniform",
  magneticField: 1,
  dipoleMoment: 1,
  testPointDistance: 0.05,
  segmentLength: 0.1,
  testCharge: ELEMENTARY_CHARGE,
  pathOrientation: "transverse",
  sliceDeclared: false,
  resolution: "shown",
  motionState: "magnet-moves",
});

export const SR02_CLASSES: Readonly<Record<keyof Sr02Parameters, ParameterClass>> = Object.freeze({
  mode: "presentation",
  descriptionFrame: "observer",
  speed: "input",
  fieldModel: "input",
  magneticField: "input",
  dipoleMoment: "input",
  testPointDistance: "input",
  segmentLength: "input",
  testCharge: "input",
  pathOrientation: "measurement",
  sliceDeclared: "measurement",
  resolution: "presentation",
  motionState: "presentation",
});

export const SR02_QUESTION =
  "Why does moving the magnet instead of the conductor create an explanatory asymmetry, and how does the transformation remove it?";

export const SR02_NOT_MODELED = Object.freeze([
  "conductor resistance and induced currents",
  "self-inductance",
  "magnetization dynamics and extended-magnet fields beyond the ideal dipole",
  "time-varying flux of extended circuits",
  "edge fields",
  "radiation",
  "unipolar machines",
  "electromotive-force comparison across frames for a path with a component along the direction of motion, which needs a declared simultaneity slice this model does not supply",
]);

export const SR02_MODEL = Object.freeze({
  id: "magnet-conductor-host",
  constantSetId: "modern-si-2019",
  label: "Ideal model, host calculation",
});

export const SR02_APPARATUS_LABEL = "Static worked example";

export const SR02_CAPTION = Object.freeze({
  r0: "The same relative motion of magnet and conductor can be told two ways; nature does not care which body we call at rest.",
  r1: "In the magnet's rest frame the charges in the moving conductor feel q(v × B). In the conductor's rest frame those charges feel qE', and E' is the transform of the magnet's field. The two electromotive forces along a path across the motion differ by the factor gamma.",
  r2: "A path across the boost has endpoint events with Δx = 0, so they are simultaneous in both frames and the length is unchanged. Then the magnet-frame electromotive force is vBℓ and the conductor-frame value is γvBℓ. The excess, γ − 1, is computed as γ²β²/(γ + 1), not by subtracting 1 from γ, which loses the small difference at everyday speeds.",
  r3: "The paper's first paragraph states the classical asymmetry. Section 6 removes it: electric and magnetic forces do not exist independently of the state of motion of the coordinate system. Lorentz's ether plus local time produces the same first-order formulae; that account is empirically equivalent at the speeds of real apparatus, not declared refuted here.",
});

export const SR02_APPARATUS_CAPTIONS = Object.freeze({
  magnetMoves:
    "With the magnet moving and the conductor at rest, an electric field with a definite energy arises near the magnet and produces a current in the conductor.",
  coilMoves:
    "With the conductor moving and the magnet at rest, no electric field arises, but the conductor experiences an electromotive force with no corresponding energy that produces currents of the same size and course, assuming equal relative motion.",
  observation:
    "The observable current depends only on the relative motion, to the precision of the observations. The two classical accounts agree to first order in v/c.",
  resolution:
    "In the paper's new manner of expression, the force on the conductor's charges is, in the conductor's rest frame, an electric field obtained by transforming the magnet's field. Electric and magnetic forces do not exist independently of the state of motion of the coordinate system.",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const SR02_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  magneticFieldStationary: c("T", "magnetic-field-magnet", "fields.emfBothDescriptions", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  electricFieldStationary: c("V/m", "electric-field-magnet", "fields.transformSI", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  magneticFieldMoving: c("T", "magnetic-field-conductor", "fields.transformSI", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  electricFieldMoving: c("V/m", "electric-field-conductor", "fields.transformSI", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  transverseForceLaboratory: c("N", "lorentz-force-magnet", "fields.lorentzForce", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  transverseForceComoving: c("N", "lorentz-force-conductor", "fields.lorentzForce", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  electromotiveForceMagnetFrame: c("V", "emf-magnet", "fields.emfBothDescriptions", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  electromotiveForceConductorFrame: c("V", "emf-conductor", "fields.emfBothDescriptions", [
    "value",
    "symbolic",
    "not-applicable",
    "underdetermined",
    "outside-domain",
  ]),
  electromotiveForceExcess: c("1", "emf-excess", "fields.emfBothDescriptions", [
    "value",
    "symbolic",
    "not-applicable",
    "underdetermined",
    "outside-domain",
  ]),
  fieldInvariantEDotB: c("T V/m", "field-invariant-dot", "fields.fieldInvariants", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  fieldInvariantE2MinusC2B2: c("V^2/m^2", "field-invariant-difference", "fields.fieldInvariants", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  lorentzFactor: c("1", "lorentz-factor", "kinematics.gamma", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  pathBoostParallelComponent: c("1", "path-boost-parallel", "fields.emfBothDescriptions", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  endpointSimultaneityOffset: c("s", "endpoint-offset", "fields.emfBothDescriptions", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  inducedCircuitCurrent: c("A", "circuit-current", "fields.emfBothDescriptions", [
    "not-applicable",
    "symbolic",
    "outside-domain",
  ]),
});
