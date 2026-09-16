import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Sr10Parameters = Readonly<{
  beta: number;
  propagationAngleDeg: number;
  initialEnergyJ: number;
  initialVolumeM3: number;
  initialAmplitude: number;
  showCountermodel: boolean;
}>;

export const SR10_DEFAULTS: Sr10Parameters = Object.freeze({
  beta: 0.6,
  propagationAngleDeg: 0,
  initialEnergyJ: 1.0,
  initialVolumeM3: 1.0,
  initialAmplitude: 1.0,
  showCountermodel: true,
});

export const SR10_CLASSES: Readonly<Record<keyof Sr10Parameters, ParameterClass>> = Object.freeze({
  beta: "observer",
  propagationAngleDeg: "input",
  initialEnergyJ: "input",
  initialVolumeM3: "input",
  initialAmplitude: "input",
  showCountermodel: "presentation",
});

export const SR10_QUESTION =
  "How do the energy and volume of a bounded light complex transform between frames?";

export const SR10_NOT_MODELED = Object.freeze([
  "media and dispersion",
  "quantum photon structure",
  "finite pulse dispersion in dielectric",
  "gravitational redshift",
  "boundary diffraction at packet edges",
]);

export const SR10_MODEL = Object.freeze({
  id: "light-complex-host",
  constantSetId: "modern-si-2019",
  label: "Ideal model, host calculation",
});

export const SR10_CAPTION = Object.freeze({
  r0: "A light complex (a bounded packet of light) transforms in energy and volume by the same factor q = γ(1 - β cos φ). Energy density transforms as q², volume as 1/q, and total energy as E' = Eq.",
  r1: "The volume of a light complex does not transform like a material rod (1/γ). The simultaneous boundary in the moving frame cuts across the moving light front, giving V'/V = 1/q. For receding light along the axis (φ = 0°, β = 0.6), volume doubles to 2.0 while energy halves to 0.5.",
  r2: "At right angles in the stationary system (φ = 90°), q = γ = 1.25. The energy increases to 1.25E while volume contracts to 0.8V. When transverse in the moving system (cos φ = β), q = 1/γ = 0.8 and volume expands to 1.25V.",
  r3: "Section 8 establishes that the ratio E'/E equals the frequency ratio ν'/ν = q for any angle. The energy of a light complex and its frequency vary with observer motion according to the exact same law.",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const SR10_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  frameSpeed: c("c", "speed", "waves", ["value", "outside-domain"]),
  propagationAngleStationary: c("deg", "angle", "waves", ["value", "outside-domain"]),
  propagationAngleMoving: c("deg", "angle", "waves", ["value", "outside-domain"]),
  lightComplexEnergyStationary: c("J", "energy", "waves", ["value", "outside-domain"]),
  lightComplexEnergyMoving: c("J", "energy", "waves", ["value", "outside-domain"]),
  lightComplexVolumeStationary: c("m^3", "space-geometry", "waves", ["value", "outside-domain"]),
  lightComplexVolumeMoving: c("m^3", "space-geometry", "waves", ["value", "outside-domain"]),
  lightAmplitudeStationary: c("V/m", "field", "waves", ["value", "outside-domain"]),
  lightAmplitudeMoving: c("V/m", "field", "waves", ["value", "outside-domain"]),
  dopplerFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
  lorentzFactor: c("1", "lorentz-factor", "waves", ["value", "outside-domain"]),
  energyDensityFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
  volumeFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
  countermodelEnergyMoving: c("J", "energy", "waves", ["value", "outside-domain"]),
  countermodelVolumeMoving: c("m^3", "space-geometry", "waves", ["value", "outside-domain"]),
});
