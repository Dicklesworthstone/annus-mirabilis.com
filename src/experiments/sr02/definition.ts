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

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-sr-02-magnet-conductor-x1gc.yaml, which the readings audit reads. */
export const SR02_CAPTION = Object.freeze({
  r0: "Move a magnet past a wire, or the wire past the magnet, and the same current flows, yet the physics of 1905 explained the two cases in different ways. The paper's transformation gives one explanation, because what counts as an electric or a magnetic force depends on who is moving.",
  r1: "The paper opens with this case. If the magnet moves and the conductor rests, an electric field with a definite energy arises around the magnet and drives a current. If the conductor moves and the magnet rests, no electric field arises; an electromotive force with no energy of its own drives a current of the same size and course. The observed current depends only on the relative motion, while the explanation depends on which body is called moving. Section 6 removes the asymmetry. Transformed to the conductor's rest frame, the magnet's field has an electric component, Y′ = β(Y − (v/V)N), where β is Einstein's letter for today's γ and V for c, and that electric force is what drives the charges. The lab takes a uniform field B = 1 T across a straight segment 0.1 m long, moving at v across the field. In the magnet's frame the work per unit charge is vBℓ, 1 V at 10 m/s. In the conductor's frame it is γvBℓ, larger by γ − 1 = 5.563 × 10^{−16}. At 0.6c the two are 1.799 × 10^{7} V and 2.248 × 10^{7} V, a ratio of 1.25. A segment laid along the motion gets no work in either frame, because the force points across it; the lab reports 0 V, and it refuses to compare the frames until you say which frame's clock fixes the segment's ends.",
  r2: "Put the magnet at rest in K with a magnetic field B along z and no electric field, and let the conductor move at v along x. A charge q riding in the conductor moves through the field, so in K it feels the magnetic force q(v × B). With v along x and B along z that force points along −y, with size qvB. Along a straight segment of length ℓ laid along y, the work per unit charge is vBℓ; with v = 10 m/s, B = 1 T and ℓ = 0.1 m that is 10 × 1 × 0.1 = 1 V. Now describe the same event from the conductor's rest frame k. The charge is at rest there, so no magnetic force can act on it, and whatever pushes it must be an electric field. Section 6 supplies it: in SI units E′_{y} = γ(E_{y} − vB_{z}) = −γvB, because E_{y} = 0. The segment lies across the motion, so its length is the same in both frames, and the work per unit charge is γvBℓ. At 10 m/s, γ exceeds 1 by about β²/2, where β = v/c = 3.336 × 10^{−8}, so the excess is 5.563 × 10^{−16}. Computing γ first and then subtracting 1 gives 6.661 × 10^{−16}, about 20 percent too large, because numbers near 1 are stored in steps of about 2.2 × 10^{−16}; so the lab computes γ − 1 as γ²β²/(γ + 1). At 0.6c, γ = 1.25: 0.6 × 299 792 458 × 0.1 = 1.799 × 10^{7} V in K, and 1.25 times that, 2.248 × 10^{7} V, in k. The force on the charge obeys the same factor: for the charge e at 0.6c it is 3.602 × 10^{−11} N in k and 3.602/1.25 = 2.882 × 10^{−11} N in K. Turn the segment to lie along x. The force still points along y, across the segment, so it does no work, and the electromotive force is 0 in both frames. There is a second difficulty as well. The segment's two ends, taken at one time in one frame, are not at one time in the other; they differ by γvℓ/c² = 1.25 × 0.6 × 0.1/c = 2.502 × 10^{−10} s at 0.6c. So until you declare which frame's clock fixes the ends, the lab refuses the comparison instead of printing a number.",
  r3: "Einstein writes the electric force as (X, Y, Z) and the magnetic force as (L, M, N), in Gaussian units, with V for the speed of light and β for today's γ. Section 6 sets two accounts side by side: in the old manner of expression ('Alte Ausdrucksweise') a moving unit charge feels, besides the electric force, an electromotive force equal to its velocity crossed with the magnetic force divided by V, to first order in v/V; in the new manner ('Neue Ausdrucksweise') it feels the electric force of the field transformed to its own rest frame. The electromotive force keeps only the role of an auxiliary concept ('eines Hilfsbegriffes'), and questions about the seat of the electromotive forces in unipolar machines lose their point. The magnet-and-conductor case was a textbook example: Föppl's 1894 introduction to Maxwell's theory discussed it, and Holton (1960) pointed to that book as one Einstein read. Lorentz's theory predicts the same currents at the speeds of real apparatus, so the introduction objects to an asymmetry in the explanation, not to a failed prediction.",
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
