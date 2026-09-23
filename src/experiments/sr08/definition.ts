import {
  C_SI,
  ELEMENTARY_CHARGE,
  type Sr08Frame,
  type Sr08UnitLayer,
} from "../../physics/reference/fields.ts";
import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Sr08Parameters = Readonly<{
  unitLayer: Sr08UnitLayer;
  descriptionFrame: Sr08Frame;
  electricFieldX: number;
  electricFieldY: number;
  electricFieldZ: number;
  magneticFieldX: number;
  magneticFieldY: number;
  magneticFieldZ: number;
  boost: number;
  testCharge: number;
  chargeVelocityX: number;
  chargeVelocityY: number;
  chargeVelocityZ: number;
  decomposeComponents: boolean;
  detectorMotion: boolean;
  detectorSpeed: number;
}>;

export const SR08_DEFAULTS: Sr08Parameters = Object.freeze({
  unitLayer: "si",
  descriptionFrame: "stationary",
  electricFieldX: 0,
  electricFieldY: 1,
  electricFieldZ: 0,
  magneticFieldX: 0,
  magneticFieldY: 0,
  magneticFieldZ: 0,
  boost: 0.6 * C_SI,
  testCharge: ELEMENTARY_CHARGE,
  chargeVelocityX: 0,
  chargeVelocityY: 0,
  chargeVelocityZ: 0,
  decomposeComponents: true,
  detectorMotion: false,
  detectorSpeed: 0,
});

export const SR08_CLASSES: Readonly<Record<keyof Sr08Parameters, ParameterClass>> = Object.freeze({
  unitLayer: "presentation",
  descriptionFrame: "observer",
  electricFieldX: "input",
  electricFieldY: "input",
  electricFieldZ: "input",
  magneticFieldX: "input",
  magneticFieldY: "input",
  magneticFieldZ: "input",
  boost: "observer",
  testCharge: "input",
  chargeVelocityX: "input",
  chargeVelocityY: "input",
  chargeVelocityZ: "input",
  decomposeComponents: "presentation",
  detectorMotion: "input",
  detectorSpeed: "input",
});

export const SR08_QUESTION =
  "How do electric and magnetic descriptions change together under a boost, and what does a test charge experience in each frame?";

export const SR08_NOT_MODELED = Object.freeze([
  "field sources and currents",
  "radiation and self-fields",
  "radiation reaction",
  "back-reaction on the field",
  "media and polarization",
  "nonuniform fields",
  "accelerated observers",
]);

export const SR08_MODEL = Object.freeze({
  id: "field-frame-change-host",
  constantSetId: "modern-si-2019",
  label: "Ideal model, host calculation",
});

export const SR08_CAPTION = Object.freeze({
  r0: "Electric and magnetic forces do not exist independently of the coordinate system; a pure electric field in one frame appears as both electric and magnetic fields in another.",
  r1: "Under a boost along x, the parallel field components are unchanged while perpendicular components mix with the factor γ. The field combinations E·B and E² − c²B² are Lorentz invariants.",
  r2: "A test charge experiences force q(E + u × B) in the laboratory frame and q(E' + u' × B') in the moving frame. Transforming the fields and velocities predicts the comoving force exactly according to the relativistic force law.",
  r3: "Section 6's new manner of expression determines the force on a moving charge by transforming the field to the charge's instantaneous rest frame, where the force is purely electric qE''. Electrodynamics becomes kinematic and frame-independent.",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const SR08_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  electricFieldStationary: c("V/m", "electric-field-stationary", "fields.transformSI", [
    "value",
    "outside-domain",
  ]),
  electricFieldMoving: c("V/m", "electric-field-moving", "fields.transformSI", [
    "value",
    "outside-domain",
  ]),
  magneticFieldStationary: c("T", "magnetic-field-stationary", "fields.transformSI", [
    "value",
    "outside-domain",
  ]),
  magneticFieldMoving: c("T", "magnetic-field-moving", "fields.transformSI", [
    "value",
    "outside-domain",
  ]),
  fieldInvariantEDotB: c("T V/m", "field-invariant-dot", "fields.fieldInvariants", [
    "value",
    "outside-domain",
  ]),
  fieldInvariantE2MinusC2B2: c("V^2/m^2", "field-invariant-difference", "fields.fieldInvariants", [
    "value",
    "outside-domain",
  ]),
  lorentzFactor: c("1", "lorentz-factor", "kinematics.gamma", ["value", "outside-domain"]),
  chargeVelocityStationary: c("m/s", "charge-velocity-stationary", "fields.transformVelocity3D", [
    "value",
    "outside-domain",
  ]),
  chargeVelocityMoving: c("m/s", "charge-velocity-moving", "fields.transformVelocity3D", [
    "value",
    "outside-domain",
  ]),
  transverseForceLaboratory: c("N", "lorentz-force-stationary", "fields.lorentzForce", [
    "value",
    "outside-domain",
  ]),
  transverseForceComoving: c("N", "lorentz-force-moving", "fields.lorentzForce", [
    "value",
    "outside-domain",
  ]),
});
