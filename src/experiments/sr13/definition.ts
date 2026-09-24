import type {
  DatasetOverlayId,
  ForceConvention,
  MassLanguage,
  ParticleChoice,
} from "../../physics/reference/electron.ts";
import { ELECTRON_MASS, ELEMENTARY_CHARGE } from "../../physics/reference/electron.ts";
import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Sr13Parameters = Readonly<{
  electricFieldX: number;
  electricFieldY: number;
  electricFieldZ: number;
  magneticFieldX: number;
  magneticFieldY: number;
  magneticFieldZ: number;
  initialSpeed: number;
  initialDirectionDeg: number;
  integrationInterval: number;
  forceConvention: ForceConvention;
  massLanguage: MassLanguage;
  particle: ParticleChoice;
  customCharge?: number | undefined;
  customMass?: number | undefined;
  datasetOverlay: DatasetOverlayId;
}>;

export const SR13_DEFAULTS: Sr13Parameters = Object.freeze({
  electricFieldX: 0,
  electricFieldY: 1e5,
  electricFieldZ: 0,
  magneticFieldX: 0,
  magneticFieldY: 0,
  magneticFieldZ: 0,
  initialSpeed: 0.6,
  initialDirectionDeg: 0,
  integrationInterval: 2e-9,
  forceConvention: "source",
  massLanguage: "1905",
  particle: "electron",
  customCharge: -ELEMENTARY_CHARGE,
  customMass: ELECTRON_MASS,
  datasetOverlay: "none",
});

export const SR13_CLASSES: Readonly<Record<keyof Sr13Parameters, ParameterClass>> = Object.freeze({
  electricFieldX: "input",
  electricFieldY: "input",
  electricFieldZ: "input",
  magneticFieldX: "input",
  magneticFieldY: "input",
  magneticFieldZ: "input",
  initialSpeed: "input",
  initialDirectionDeg: "input",
  integrationInterval: "input",
  forceConvention: "presentation",
  massLanguage: "presentation",
  particle: "input",
  customCharge: "input",
  customMass: "input",
  datasetOverlay: "presentation",
});

export const SR13_QUESTION =
  'What force, work, energy, and deflection relations follow for a slowly accelerated electron, and why do two different "transverse masses" appear?';

export const SR13_NOT_MODELED = Object.freeze([
  "radiation reaction from accelerated charges",
  "self-electromagnetic fields and structure of the electron",
  "quantum electrodynamic corrections and spin",
  "space charge interactions in beam ensembles",
  "non-uniform and fringe electromagnetic fields",
  "apparatus-specific geometry of historical deflection experiments",
]);

export const SR13_MODEL = Object.freeze({
  id: "electron-dynamics-host",
  constantSetId: "modern-si-2019",
  label: "Ideal relativistic electron dynamics, host calculation",
});

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-sr-13-electron-dynamics-b6v7.yaml, which the readings audit reads. */
export const SR13_CAPTION = Object.freeze({
  r0: "An electron pushed toward the speed of light gets harder and harder to speed up, and the energy needed to reach light's speed is infinite. Einstein ended the paper with three measurements that could test these predictions.",
  r1: "§10 assumes that an electron at rest, or moving slowly, obeys Newton's law μ d²x/dt² = εX in its own frame, and transforms that law to the stationary system K by §3 and §6. With force defined as the force measured in the frame moving with the electron, and acceleration measured in K, Einstein finds a longitudinal mass μ/(√(1 − (v/V)²))³ and a transverse mass μ/(1 − (v/V)²), and adds at once that other definitions of force and acceleration would give other numbers, so that theories of the electron must be compared with care. At the lab's default speed, 0.6c, these are 1.779 × 10^{−30} kg and 1.423 × 10^{−30} kg for an electron of mass 9.109 × 10^{−31} kg. With the laboratory convention that Planck introduced in 1906, force as the rate of change of momentum, the transverse mass is 1.139 × 10^{−30} kg instead, and the trajectories are the same either way. The kinetic energy is W = μV²{1/√(1 − (v/V)²) − 1}, here 2.047 × 10^{−14} J against 1.474 × 10^{−14} J from ½mv²; it becomes infinite at v = V, so, as with the earlier results, speeds above light's have no possibility of existence. §10 ends with three relations open to experiment, which the lab computes: the ratio of magnetic to electric deflectability equals v/V, here 0.6; the potential difference needed to reach a speed, here 127.75 kV instead of the Newtonian 91.98 kV; and the radius of curvature in a magnetic field, 0.128 m at 0.01 T. In the default electric field of 10^{5} V/m the path curves with a radius of 2.30 m.",
  r2: "Start with γ = 1/√(1 − 0.6²) = 1.25. Einstein's longitudinal mass is μγ³ = 9.109 × 10^{−31} × 1.953 = 1.779 × 10^{−30} kg, and his transverse mass is μγ² = 9.109 × 10^{−31} × 1.5625 = 1.423 × 10^{−30} kg. Where do the powers come from? Across the motion, lengths are unchanged, but each second of the electron's own time is γ seconds in K, so an acceleration seen in K is smaller by γ² than in the electron's frame; dividing the force measured in the electron's frame by it gives μγ². Measure the force in K instead, as Planck did in 1906: across the motion that force is smaller by γ, and the transverse mass becomes μγ = 1.139 × 10^{−30} kg. Along the motion the force is the same in both frames, and the acceleration seen in K is smaller by γ³, the extra factor coming from the change of simultaneity along the motion, so the longitudinal mass is μγ³ in both conventions. The motion itself is the same in both descriptions; only the word mass is defined differently. Next the energy. The work done by the field is ∫εX dx, and with the first equation of motion this is μV²(γ − 1). The electron's rest energy is μc² = 9.109 × 10^{−31} × (2.998 × 10^{8})² = 8.187 × 10^{−14} J, and γ − 1 = 0.25, so W = 2.047 × 10^{−14} J. Newton's ½μv² gives 0.5 × 9.109 × 10^{−31} × (1.799 × 10^{8})² = 1.474 × 10^{−14} J. As v approaches c, γ grows without limit, and so does W. The three testable relations follow. Dividing W by the electron's charge gives the potential needed: 2.047 × 10^{−14}/1.602 × 10^{−19} = 127 750 V, against 91 980 V for Newton. An electron moving at v across a magnetic field B curves with radius R = γμv/(εB); at 0.01 T that is 1.25 × 9.109 × 10^{−31} × 1.799 × 10^{8}/(1.602 × 10^{−19} × 0.01) = 0.128 m. Across an electric field E the radius is γμv²/(εE), 2.30 m at 10^{5} V/m. A magnetic force and an electric force deflect the electron equally when E = vB, which is why the ratio of the two deflectabilities is v/c, 0.6 here.",
  r3: "§10 writes μ and ε for the electron's mass and charge, V for the speed of light and β for the modern γ, and defines force by a spring balance at rest in the electron's moving frame. Einstein notes that the masses hold for any ponderable point, since a small charge can be added to one. Kaufmann's deflection measurements of fast β-ray electrons, made from 1901 to 1906, seemed at first to favour Abraham's rival electron theory over the Lorentz–Einstein formulas, while Bucherer's of 1908 favoured the latter, and the question stayed open for some years. None of these data are digitized here yet, so the lab draws no measured points. The paper ends by thanking M. Besso and is dated Bern, June 1905; the Annalen received it on 30 June.",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const SR13_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  longitudinalMass: c("kg", "mass", "electron", ["value", "outside-domain"]),
  transverseMassComoving: c("kg", "mass", "electron", ["value", "outside-domain"]),
  transverseMassLaboratory: c("kg", "mass", "electron", ["value", "outside-domain"]),
  kineticEnergy: c("J", "energy", "electron", ["value", "outside-domain"]),
  kineticEnergyNewtonian: c("J", "energy", "electron", ["value", "outside-domain"]),
  acceleratingPotential: c("V", "electric-potential", "electron", ["value", "outside-domain"]),
  acceleratingPotentialNewtonian: c("V", "electric-potential", "electron", [
    "value",
    "outside-domain",
  ]),
  radiusCurvatureMagnetic: c("m", "length", "electron", ["value", "outside-domain"]),
  radiusCurvatureElectric: c("m", "length", "electron", ["value", "outside-domain"]),
  lorentzFactor: c("1", "dimensionless", "electron", ["value", "outside-domain"]),
  speedRatio: c("1", "ratio", "electron", ["value", "outside-domain"]),
  trajectoryPositions: c("m", "trajectory-xy", "electron", ["value", "outside-domain"]),
});
