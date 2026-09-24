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

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-sr-08-field-frame-change-5ibt.yaml, which the readings audit reads. */
export const SR08_CAPTION = Object.freeze({
  r0: "Whether a field is electric, magnetic or both depends on who describes it. A field that is purely electric for one observer has a magnetic part for an observer moving past, and the two descriptions agree about what a charge in it does.",
  r1: "§6 applies the transformation of §3 to the Maxwell–Hertz equations for empty space and asks what fields must hold in the moving system k if the equations are to keep their form there. For a boost with speed v along x, the components along the motion are unchanged, X′ = X and L′ = L, while the transverse ones mix: Y′ = β(Y − (v/V)N) and N′ = β(N − (v/V)Y), and likewise for Z and M. Einstein's β is the modern γ, and V is the speed of light. The lab's default is a pure electric field of 1 V/m along y and a boost of 0.6c, so γ = 1.25. In k the electric field is 1.25 V/m, and a magnetic field of −2.50 × 10^{−9} T along z appears where there was none. A charge at rest in K feels 1.60 × 10^{−19} N; in k it moves at −0.6c through both fields and feels 1.28 × 10^{−19} N, the value in K divided by γ. §6 then states the result in two ways. The old manner: a charge moving in a field feels, besides the electric force, an electromotive force equal, to first order in v/V, to its velocity crossed with the magnetic force and divided by the speed of light. The new manner: the force on a moving charge is the electric force found by transforming the field to a frame in which the charge is at rest. Let the charge move with k and the lab shows that force, 2.00 × 10^{−19} N, all of it electric. The electromotive force becomes an auxiliary concept, and the asymmetry between magnet and conductor from the introduction disappears. The ledger also prints two combinations that the boost leaves unchanged, E·B = 0 and E² − c²B² = 1 (V/m)², as a check on the arithmetic; §6 does not use them.",
  r2: "Take the lab's default. In the stationary system K there is an electric field of 1 V/m pointing along y and no magnetic field. The moving system k travels along x at v = 0.6c. First the factor: γ = 1/√(1 − v²/c²) = 1/√(1 − 0.36) = 1/√0.64 = 1/0.8 = 1.25. Now §6's formulas, written in SI units, where the magnetic field carries a factor of c. The component of E along the motion is unchanged, so E′_{x} = 0. The y component becomes E′_{y} = γ(E_{y} − vB_{z}) = 1.25 × (1 − 0) = 1.25 V/m. The z component of the magnetic field becomes B′_{z} = γ(B_{z} − vE_{y}/c²) = 1.25 × (0 − 0.6c × 1/c²) = −0.75/c = −0.75/(2.998 × 10^{8}) = −2.50 × 10^{−9} T. So a field that was purely electric in K is electric and magnetic in k. Now place a charge q = 1.602 × 10^{−19} C at rest in K. There the force is qE = 1.602 × 10^{−19} × 1 = 1.60 × 10^{−19} N along y. In k the charge moves at u′ = −0.6c along x, so the force there is q(E′ + u′ × B′). The y component of u′ × B′ is −u′_{x}B′_{z} = −(−0.6c)(−0.75/c) = −0.45 V/m, so the total is 1.25 − 0.45 = 0.80 V/m, and the force is 0.80q = 1.28 × 10^{−19} N, smaller than in K by the factor 0.8 = 1/γ. This is not a contradiction. Force is momentum gained per unit time; the transverse momentum is the same in both frames, but the time between two events on the charge is longer in the frame in which it moves, so the force there is smaller. Next, put the charge at rest in k instead. There its velocity is zero, only the electric field acts, and the force is qE′ = 1.25q = 2.00 × 10^{−19} N: this is §6's new manner, the electric force in the charge's rest frame. In K the same charge moves at +0.6c through a field with no magnetic part, so the force there is qE = 1.60 × 10^{−19} N, again smaller by γ. Last, the check. E·B is 0 in K, and E′·B′ is also 0 in k, since E′ points along y and B′ along z. E² − c²B² is 1 in K, and in k it is 1.25² − c²(0.75/c)² = 1.5625 − 0.5625 = 1.",
  r3: "In §6 Einstein writes the electric force as (X, Y, Z), the magnetic force as (L, M, N), the speed of light as V and the modern γ as β, in units in which electric and magnetic forces have the same dimension. He fixes an undetermined factor ψ(v) to 1 by requiring the transformation and its inverse to agree and by symmetry. He calls the electromotive force an auxiliary concept, owed to the fact that electric and magnetic forces have no existence independent of the state of motion of the coordinate system, and says that questions about the seat of the electromotive force in unipolar machines lose their point. Lorentz's 1904 theory had already transformed the fields, as mathematical aids in an ether at rest. The invariants E·B and E² − c²B², and the treatment of the field as one object, come from Minkowski in 1908.",
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
