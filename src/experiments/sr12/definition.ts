import { C_SI, type Sr12Mode, type Sr12UnitLayer } from "../../physics/reference/fields.ts";
import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Sr12Parameters = Readonly<{
  mode: Sr12Mode;
  unitLayer: Sr12UnitLayer;
  descriptionFrame: "stationary" | "moving";
  chargeDensity: number;
  currentDensityX: number;
  currentDensityY: number;
  currentDensityZ: number;
  boost: number;
  carrierVelocityX: number;
  carrierVelocityY: number;
  carrierVelocityZ: number;
  sphereRadius: number;
  sphereCharge: number;
  loopCurrent: number;
  loopLengthX: number;
  loopLengthY: number;
  pulseWidth: number;
  pulseAmplitude: number;
}>;

export const SR12_DEFAULTS: Sr12Parameters = Object.freeze({
  mode: "neutral-conductor",
  unitLayer: "si",
  descriptionFrame: "stationary",
  chargeDensity: 0,
  currentDensityX: 1,
  currentDensityY: 0,
  currentDensityZ: 0,
  boost: 0.6 * C_SI,
  carrierVelocityX: 0.5 * C_SI,
  carrierVelocityY: 0,
  carrierVelocityZ: 0,
  sphereRadius: 1,
  sphereCharge: (4 / 3) * Math.PI,
  loopCurrent: 1,
  loopLengthX: 1,
  loopLengthY: 0.5,
  pulseWidth: 1,
  pulseAmplitude: 1,
});

export const SR12_CLASSES: Readonly<Record<keyof Sr12Parameters, ParameterClass>> = Object.freeze({
  mode: "presentation",
  unitLayer: "presentation",
  descriptionFrame: "observer",
  chargeDensity: "input",
  currentDensityX: "input",
  currentDensityY: "input",
  currentDensityZ: "input",
  boost: "observer",
  carrierVelocityX: "input",
  carrierVelocityY: "input",
  carrierVelocityZ: "input",
  sphereRadius: "input",
  sphereCharge: "input",
  loopCurrent: "input",
  loopLengthX: "input",
  loopLengthY: "input",
  pulseWidth: "input",
  pulseAmplitude: "input",
});

export const SR12_QUESTION =
  "How do charge density and current density transform between inertial frames, and why is a neutral current-carrying wire charged in a moving frame?";

export const SR12_NOT_MODELED = Object.freeze([
  "microscopic lattice dynamics and thermal vibrations",
  "self-inductance and transient current startup",
  "radiation reaction from accelerated charges",
  "material resistance and Joule heating",
  "finite wire thickness effects",
  "gravitational fields and general relativistic curvature",
]);

export const SR12_MODEL = Object.freeze({
  id: "charge-current-host",
  constantSetId: "modern-si-2019",
  label: "Ideal relativistic four-current model, host calculation",
});

export const SR12_CAPTION = Object.freeze({
  r0: "Electric charge density and current density transform together under a boost; a wire that is electrically neutral in one frame carries a net charge density in another.",
  r1: "The four-current (cρ, J) transforms as a Lorentz four-vector. The combination (cρ)² − |J|² is an exact relativistic invariant in all inertial frames.",
  r2: "For a current-carrying loop, Lorentz contraction shortens the wire segments while the charge per unit length shifts, ensuring total charge remains invariant while opposite legs carry equal and opposite static charges.",
  r3: "Section 9 shows that the continuity equation ∂ρ/∂t + ∇·J = 0 is invariant under Lorentz transformation: charge conservation holds identically in all inertial frames without modifying Maxwell's electrodynamics.",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const SR12_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  chargeDensityStationary: c(
    "C/m^3",
    "charge-density-stationary",
    "fields.transformChargeCurrent",
    ["value", "outside-domain"],
  ),
  chargeDensityMoving: c("C/m^3", "charge-density-moving", "fields.transformChargeCurrent", [
    "value",
    "outside-domain",
  ]),
  currentDensityStationary: c(
    "A/m^2",
    "current-density-stationary",
    "fields.transformChargeCurrent",
    ["value", "outside-domain"],
  ),
  currentDensityMoving: c("A/m^2", "current-density-moving", "fields.transformChargeCurrent", [
    "value",
    "outside-domain",
  ]),
  fourCurrentInvariant: c("A^2/m^4", "four-current-invariant", "fields.fourCurrentInvariants", [
    "value",
    "outside-domain",
  ]),
  fourCurrentInvariantNormalized: c(
    "1",
    "four-current-invariant-normalized",
    "fields.fourCurrentInvariants",
    ["value", "outside-domain"],
  ),
  lorentzFactor: c("1", "lorentz-factor", "kinematics.gamma", ["value", "outside-domain"]),
  continuityResidualStationary: c(
    "A/m^3",
    "continuity-residual-stationary",
    "fields.gaussianPulseContinuity",
    ["value", "outside-domain"],
  ),
  continuityResidualMoving: c(
    "A/m^3",
    "continuity-residual-moving",
    "fields.gaussianPulseContinuity",
    ["value", "outside-domain"],
  ),
  loopLegChargePositive: c("C", "loop-leg-charge-positive", "fields.currentLoopCharges", [
    "value",
    "outside-domain",
  ]),
  loopLegChargeNegative: c("C", "loop-leg-charge-negative", "fields.currentLoopCharges", [
    "value",
    "outside-domain",
  ]),
  loopTotalCharge: c("C", "loop-total-charge", "fields.currentLoopCharges", [
    "value",
    "outside-domain",
  ]),
  sphereTotalChargeStationary: c(
    "C",
    "sphere-total-charge-stationary",
    "fields.sphereTotalCharge",
    ["value", "outside-domain"],
  ),
  sphereTotalChargeMoving: c("C", "sphere-total-charge-moving", "fields.sphereTotalCharge", [
    "value",
    "outside-domain",
  ]),
});
