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

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-sr-12-charge-current-bgq0.yaml, which the readings audit reads. */
export const SR12_CAPTION = Object.freeze({
  r0: "A wire carrying a current, with no net charge for an observer standing beside it, has a net charge for an observer moving along it. Charge and current mix under a change of frame, while the total charge of a body stays the same.",
  r1: "§9 takes the Maxwell–Hertz equations with convection currents, in which ρ is 4π times the density of electricity and (u_{x}, u_{y}, u_{z}) its velocity. For charges bound to small rigid bodies, ions and electrons, these equations are the foundation of Lorentz's electrodynamics of moving bodies. Transforming them by §3 and §6, Einstein finds the same equations in k, provided the velocity of the charges transforms by the addition theorem of §5 and the density by ρ′ = β(1 − v u_{x}/V²)ρ. So Lorentz's foundation agrees with the principle of relativity, and a charged body whose charge does not change in its own frame keeps a constant charge seen from K as well. The lab's default is a neutral conductor carrying 1 A/m² along x, seen from a frame moving at 0.6c along the current. In that frame the current density is 1.25 A/m², and the conductor carries a net charge density of −2.50 × 10^{−9} C/m³ where the stationary observer found none. For a rectangular loop carrying 1 A, 1 m long, the two legs parallel to the motion pick up ±2.00 × 10^{−9} C, and the loop's total stays zero. The lab also checks two things the paper does not state in this form: (cρ)² − |J|² is −1 A²/m⁴ in both frames, and charge conservation, ∂ρ/∂t + div J = 0, holds in both.",
  r2: "Take γ = 1.25 at v = 0.6c. The conductor holds two kinds of charge: carriers that make up the current, and an equal and opposite charge at rest. Say the carriers move at 0.5c, as in the lab's default. For a current density of 1 A/m² their charge density is J/u = 1/(0.5 × 2.998 × 10^{8}) = 6.67 × 10^{−9} C/m³, and the charge at rest is −6.67 × 10^{−9} C/m³, so the sum in K is zero. Now apply §9's ρ′ = γ(1 − v u_{x}/c²)ρ to each. For the charge at rest, u_{x} = 0, so ρ′ = 1.25 × (−6.67 × 10^{−9}) = −8.34 × 10^{−9} C/m³. For the carriers, v u_{x}/c² = 0.6 × 0.5 = 0.3, so ρ′ = 1.25 × 0.7 × 6.67 × 10^{−9} = 5.84 × 10^{−9} C/m³. The sum is −2.50 × 10^{−9} C/m³. The two densities change differently because each depends on that charge's own velocity, through the factor 1 − v u_{x}/c². The carrier speed cancels from the sum: in general the net density is −γvJ/c² = −1.25 × 0.6c × 1/c² = −0.75/c, the same −2.50 × 10^{−9} C/m³ whatever speed the carriers have. The current density becomes J′ = γ(J − vρ) = 1.25 × (1 − 0) = 1.25 A/m². Check the invariant: in K, (cρ)² − J² = 0 − 1 = −1; in k, (c × (−0.75/c))² − 1.25² = 0.5625 − 1.5625 = −1. Last, the loop. Its two legs along x carry the current in opposite directions. In k, a leg carrying +1 A has a charge per unit length of −γvI/c² and is shortened to 1/γ of its length, so its charge is −vIL/c² = −0.6c × 1 × 1/c² = −0.6/c = −2.00 × 10^{−9} C. The leg carrying the current the other way has +2.00 × 10^{−9} C, and the sum is zero, as §9's constancy of charge requires for a loop that is neutral in its own frame.",
  r3: "§9 writes ρ for 4π times the density of electricity and (u_{x}, u_{y}, u_{z}) for its velocity, in the units of §6. It proves only that the transformed equations keep their form, with charge density and velocity transformed as stated, and draws from them the constancy of a body's charge; it does not write a four-current or an invariant, and it does not discuss the continuity equation. Joining charge and current density into one four-vector, with (cρ)² − |J|² unchanged, is the later language of Poincaré and Minkowski. That a wire carrying a current appears charged to a moving observer is a standard modern consequence, often used to explain magnetism from electrostatics and relativity, and the paper does not discuss it.",
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
