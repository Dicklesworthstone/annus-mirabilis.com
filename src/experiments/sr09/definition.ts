import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Sr09Parameters = Readonly<{
  beta: number;
  propagationAngleDeg: number;
  frequencyTHz: number;
  detectorMotion: "rest-in-k" | "rest-in-K" | "custom";
  detectorSpeed: number;
  countingWindowCycles: number;
  secondOrderSpeed: number;
  selectedEventId: string;
  showCovectorNote: boolean;
}>;

export const SR09_DEFAULTS: Sr09Parameters = Object.freeze({
  beta: 0.6,
  propagationAngleDeg: 0,
  frequencyTHz: 500,
  detectorMotion: "rest-in-k",
  detectorSpeed: 0,
  countingWindowCycles: 10,
  secondOrderSpeed: 0.005,
  selectedEventId: "sr-09-event-origin-tick",
  showCovectorNote: false,
});

export const SR09_CLASSES: Readonly<Record<keyof Sr09Parameters, ParameterClass>> = Object.freeze({
  beta: "observer",
  propagationAngleDeg: "input",
  frequencyTHz: "input",
  detectorMotion: "input",
  detectorSpeed: "input",
  countingWindowCycles: "measurement",
  secondOrderSpeed: "input",
  selectedEventId: "presentation",
  showCovectorNote: "presentation",
});

export const SR09_QUESTION =
  "How do the frequency and propagation direction of light transform between frames?";

export const SR09_NOT_MODELED = Object.freeze([
  "media and dispersion",
  "sound in a medium",
  "gravitational redshift",
  "finite packets (SR-10)",
  "telescope optics and atmospheric refraction",
  "photon picture",
  "canal-ray apparatus beyond published values",
]);

export const SR09_MODEL = Object.freeze({
  id: "doppler-aberration-host",
  constantSetId: "modern-si-2019",
  label: "Ideal model, host calculation",
});

export const SR09_CAPTION = Object.freeze({
  r0: "The frequency and direction of light transform together because a plane wave's phase is invariant between frames. Observers in relative motion see the same light wave shifted in frequency and arriving from a different apparent angle.",
  r1: "Under a boost along x, a light ray at angle θ in K has frequency ratio ν'/ν = γ(1 - β cos θ) and apparent angle cos θ' = (cos θ - β)/(1 - β cos θ). Along the line of motion, the Doppler factor is √(1-β)/√(1+β) for receding and √(1+β)/√(1-β) for approaching rays.",
  r2: "At right angles in the stationary system (θ = 90°), the frequency increases by γ (transverse Doppler effect) and the ray swings forward to cos θ' = -β (aberration). Ives and Stilwell confirmed the second-order shift in 1938.",
  r3: "Section 7 derives both principles strictly from phase invariance φ' = φ. Wavefront crossings counted by a moving detector match the transformed frequency ν' exactly. Frequency and wave vector transform as a 4-covector.",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const SR09_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  frameSpeed: c("c", "speed", "waves", ["value", "outside-domain"]),
  propagationAngleStationary: c("deg", "angle", "waves", ["value", "outside-domain"]),
  propagationAngleMoving: c("deg", "angle", "waves", ["value", "outside-domain"]),
  waveFrequencyStationary: c("Hz", "frequency", "waves", ["value", "outside-domain"]),
  waveFrequencyMoving: c("Hz", "frequency", "waves", ["value", "outside-domain"]),
  dopplerFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
  wavePhase: c("rad", "angle", "waves", ["value", "outside-domain"]),
  lorentzFactor: c("1", "lorentz-factor", "waves", ["value", "outside-domain"]),
  classicalObserverDopplerFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
  classicalSourceDopplerFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
  recedingDopplerFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
  approachingDopplerFactor: c("1", "ratio", "waves", ["value", "outside-domain"]),
});
