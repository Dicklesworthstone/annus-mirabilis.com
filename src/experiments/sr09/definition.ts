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
  "finite packets (the finite light-complex laboratory)",
  "telescope optics and atmospheric refraction",
  "photon picture",
  "canal-ray apparatus beyond published values",
]);

export const SR09_MODEL = Object.freeze({
  id: "doppler-aberration-host",
  constantSetId: "modern-si-2019",
  label: "Ideal model, host calculation",
});

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-sr-09-doppler-aberration-rabd.yaml, which the readings audit reads. */
export const SR09_CAPTION = Object.freeze({
  r0: "Light looks redder to an observer moving away from its source and bluer to one moving toward it, and it arrives from a slightly different direction. Einstein derived both effects, for any speed below that of light, from one transformation.",
  r1: "§7 places a source of plane waves very far away in K and asks what an observer at rest in the moving system k finds. Transforming the fields by §6 and the coordinates and time by §3 gives a wave of the same form in k, with a new frequency and a new direction. If φ is the angle between the line from source to observer and the observer's velocity, measured in K, the observed frequency is ν′ = ν(1 − cos φ · v/V)/√(1 − (v/V)²), which §7 calls Doppler's principle for arbitrary speeds, and the direction obeys cos φ′ = (cos φ − v/V)/(1 − (v/V) cos φ), the law of aberration in its most general form. The lab's default is 500 THz light and an observer receding at 0.6c along the line to the source, φ = 0: the factor is √((1 − 0.6)/(1 + 0.6)) = 0.5, so the observer measures 250 THz. Reverse the motion, φ = 180°, and the factor is 2, giving 1000 THz. At φ = 90° the frequency rises by γ = 1.25, to 625 THz, although the observer moves across the line of sight, and the ray arrives at 126.87°, where cos φ′ = −0.6, as §7 prints for this case. For comparison the lab shows the two older formulas, one for a moving observer (0.4 at φ = 0) and one for a moving source (0.625). They differ because each assumes light moves at a fixed speed through a medium, which makes it matter who moves; the relativistic 0.5 depends only on the relative speed. §7 also transforms the amplitude, A′² = A²(1 − (v/V) cos φ)²/(1 − (v/V)²), and concludes that a source approached at the speed of light would appear infinitely intense.",
  r2: "Start with the factor γ. For v = 0.6c, γ = 1/√(1 − 0.36) = 1/0.8 = 1.25. The frequency formula is ν′ = νγ(1 − β cos φ), with β = v/V = 0.6. Receding along the line of sight, φ = 0 and cos φ = 1, so ν′/ν = 1.25 × (1 − 0.6) = 1.25 × 0.4 = 0.5, the same as √(0.4/1.6) = √0.25. So 500 THz becomes 250 THz. Approaching, φ = 180° and cos φ = −1, so ν′/ν = 1.25 × 1.6 = 2, and the observer measures 1000 THz. Across the line of sight, φ = 90° and cos φ = 0, so ν′/ν = 1.25 × 1 = 1.25, and the observer measures 625 THz. That last result has no counterpart in the older formulas, which give no change at 90°. It is the slowing of moving clocks from §4 showing up in the observer's clock: in K it runs slow by the factor 1/γ, so the observer counts more wave crests per second of their own time. Now the direction: cos φ′ = (cos φ − β)/(1 − β cos φ). At φ = 90° this is (0 − 0.6)/(1 − 0) = −0.6, so φ′ = arccos(−0.6) = 126.87°. The ray that met the observer's path at right angles in K meets it at 126.87° in k, and that change of direction is aberration. Compare the older formulas. If the observer moves through a medium in which light travels at c, the crests pass at the relative speed c − v, and the factor is 1 − β = 0.4. If the source moves instead, it emits the crests closer together or farther apart, giving 1/(1 + β) = 0.625. The two disagree because a medium makes it matter which one moves. The relativistic factor, 0.5, is exactly the geometric mean of the two, √(0.4 × 0.625) = √0.25, and depends only on the relative velocity. The amplitude transforms by the same factor: §7's A′² = A²(1 − β cos φ)²/(1 − β²) means A′/A = γ(1 − β cos φ), so receding at 0.6c the amplitude halves and the intensity, which goes as its square, falls to a quarter; approaching ever closer to the speed of light, both grow without limit, which is §7's closing remark. Last, why the frequencies can be compared at all: the phase of the wave, which counts the crests that have passed, is the same number for the same event in both frames, so a detector counting crests in k finds the transformed frequency.",
  r3: "Einstein's φ is the angle between the line from source to observer and the observer's velocity, measured in the source's frame; his β is the modern γ and V the speed of light. The formulas are written for a source at rest in K and an observer at rest in k, and because only the relative velocity enters, the result is the same when the source moves. §7 remarks that, contrary to the usual view, the frequency grows without bound as the speed of approach nears V. The shift by γ at 90° follows from the formula, but the paper does not single it out; Ives and Stilwell measured the second-order shift in canal rays in 1938, although they read it within Lorentz's theory. Treating frequency and wave vector as one four-vector is Minkowski's later language, not the paper's.",
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
