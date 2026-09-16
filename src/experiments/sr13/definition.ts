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
  "What force, work, energy, and deflection relations follow for a slowly accelerated electron, and why do two different \"transverse masses\" appear?";

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

export const SR13_CAPTION = Object.freeze({
  r0: "Section 10 derives the equations of motion for a slowly accelerated electron by transforming from its instantaneous rest frame back to the stationary system, yielding longitudinal and transverse mass coefficients and unbounded kinetic energy as speed approaches the speed of light.",
  r1: "Einstein's source convention compares comoving force to stationary acceleration, giving a transverse coefficient m·gamma^2; Planck's laboratory convention (F = dp/dt) gives m·gamma. Both conventions yield identical observable trajectories, potentials, and deflection radii.",
  r2: "The relativistic kinetic energy W = mc^2(gamma - 1) approaches infinity as v -> c, demonstrating that superluminal velocities have no possibility of existence for ponderable material points.",
  r3: "Einstein lists three relations accessible to experiment: the velocity-dependent accelerating potential, the magnetic deflection radius, and the ratio of magnetic to electric deflectability A_m / A_e = v/V. Historical measurements by Kaufmann and Bucherer overlay directly onto the predicted curves.",
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
  transverseMassComoving: c("kg", "mass", "electron", [
    "value",
    "outside-domain",
  ]),
  transverseMassLaboratory: c("kg", "mass", "electron", [
    "value",
    "outside-domain",
  ]),
  kineticEnergy: c("J", "energy", "electron", ["value", "outside-domain"]),
  kineticEnergyNewtonian: c("J", "energy", "electron", ["value", "outside-domain"]),
  acceleratingPotential: c("V", "electric-potential", "electron", [
    "value",
    "outside-domain",
  ]),
  acceleratingPotentialNewtonian: c(
    "V",
    "electric-potential",
    "electron",
    ["value", "outside-domain"],
  ),
  radiusCurvatureMagnetic: c("m", "length", "electron", [
    "value",
    "outside-domain",
  ]),
  radiusCurvatureElectric: c("m", "length", "electron", [
    "value",
    "outside-domain",
  ]),
  lorentzFactor: c("1", "dimensionless", "electron", ["value", "outside-domain"]),
  speedRatio: c("1", "ratio", "electron", ["value", "outside-domain"]),
});
