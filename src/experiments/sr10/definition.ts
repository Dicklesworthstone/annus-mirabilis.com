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
  r0: "A bounded packet of light transforms in energy by q = γ(1 − β cos φ) and in volume by 1/q. Neither factor is the material contraction 1/γ.",
  r1: "Einstein's printed volume of the complex is V′/V = 1/q, not 1/γ. Energy and frequency follow q. For receding light along the axis at β = 0.6, q = 1/2: energy halves and volume doubles. A rigid rod of the same rest volume would contract to 0.8.",
  r2: "The discriminating case is a ray transverse in the unprimed frame (cos φ = 0): the light factor is γ and the material factor is 1/γ, so they differ by γ². A ray transverse in the moving frame (cos φ = β) gives q = 1/γ, which equals the material factor and cannot catch the planted negative.",
  r3: "Section 8 notes that the energy and the frequency of a light complex vary with the observer's motion according to the same law. The later photon identification is not a 1905 premise.",
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
  materialVolumeFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
  countermodelEnergyMoving: c("J", "energy", "waves", ["value", "outside-domain"]),
  countermodelVolumeMoving: c("m^3", "space-geometry", "waves", ["value", "outside-domain"]),
  countermodelEnergyFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
  countermodelVolumeFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
});
