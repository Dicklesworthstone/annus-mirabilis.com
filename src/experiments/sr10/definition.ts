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

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-sr-10-light-complex-kek0.yaml, which the readings audit reads. */
export const SR10_CAPTION = Object.freeze({
  r0: "A packet of light seen from a moving frame changes both its energy and the volume it fills, and its energy changes exactly as its frequency does. Neither change is the shortening of a moving rod.",
  r1: "§8 follows a bounded packet of plane light waves, a light complex. In K, a sphere whose surface moves with the light at speed V along the wave normal lets no energy through, so it always encloses the same light. Seen from k, that sphere is an ellipsoid, and §8 computes its volume as S′/S = √(1 − (v/V)²)/(1 − (v/V) cos φ), where φ is the angle between the wave normal and the motion. Since A²/8π is the energy per unit volume and the amplitude transforms as in §7, the enclosed energy is E′/E = (1 − (v/V) cos φ)/√(1 − (v/V)²), which for φ = 0 becomes √((1 − v/V)/(1 + v/V)). §8 remarks that the energy and the frequency of a light complex change with the observer's motion by the same law. At the lab's default, 0.6c with the light moving along the motion, the energy factor is 0.5: 1 J becomes 0.5 J and 1 m³ becomes 2 m³, and the energy per unit volume falls to a quarter. At φ = 180° the energy doubles and the volume halves. The lab also runs a wrong model, labelled as one and kept out of the numbers above: it keeps light's energy per unit volume but gives the packet a rigid body's volume, 1/γ = 0.8, so its energy scales by q²/γ. Along the motion it predicts 0.2 J against the packet's 0.5 J, and against the motion 3.2 J against 2 J. The decisive ray is one at right angles to the motion in k, cos φ = 0.6 in K: the wrong model gives 0.512 J and 0.8 m³, the packet 0.8 J and 1.25 m³. At φ = 90° in K the two agree on both counts, 1.25 J and 0.8 m³, so that ray cannot tell them apart.",
  r2: "Take γ first: at 0.6c, γ = 1/√(1 − 0.36) = 1.25. Write q = γ(1 − β cos φ), with β = 0.6; §8's two factors are then E′/E = q and S′/S = 1/q. For light moving along the direction of motion, φ = 0 and q = 1.25 × (1 − 0.6) = 0.5, so the energy halves, 1 J to 0.5 J, and the volume doubles, 1 m³ to 2 m³. The energy per unit volume is energy divided by volume, 0.5/2 = 0.25 of what it was. That is q², the square of the amplitude factor, as it must be, since energy per unit volume goes as the amplitude squared. For light moving against the motion, φ = 180° and q = 1.25 × 1.6 = 2, so the energy doubles to 2 J and the volume halves to 0.5 m³. Why does the volume change at all, and why not by the rod's factor? A rod's ends are at rest in K, and measuring it in k at one instant shortens it by 1/γ. The surface of the light complex is not at rest in K; it moves at the speed of light along the wave normal. The instant τ = 0 in k corresponds to different times in K at different places, and in those intervals the surface moves, so its shape in k is an ellipsoid whose volume depends on the direction of the light, not on γ alone. Now the wrong model. It keeps the energy per unit volume, which does change by q², but takes the volume from a rigid body, 1/γ = 0.8, so its energy changes by q² × 0.8 = q²/γ. At φ = 0 that is 0.25 × 0.8 = 0.2 J against the packet's 0.5 J, and its volume is 0.8 m³ against 2 m³. At φ = 180°, 4 × 0.8 = 3.2 J against 2 J. For a ray at right angles to the motion in k, cos φ = β = 0.6 in K, so φ = 53.13° and q = 1.25 × (1 − 0.36) = 0.8: the wrong model gives 0.64 × 0.8 = 0.512 J and 0.8 m³, the packet 0.8 J and 1/0.8 = 1.25 m³, so both numbers expose it. At φ = 90°, cos φ = 0 and q = γ = 1.25, so q²/γ = 1.5625 × 0.8 = 1.25 J, exactly the packet's energy, and the packet's volume 1/q = 0.8 m³ is exactly the rigid body's. There the wrong model and the right one agree on everything the lab measures, which is why a test of this idea must use a ray that is not transverse in K.",
  r3: "§8 writes the energy per unit volume as A²/8π, the speed of light as V, the two volumes as S and S′, and φ for the angle of the wave normal, and then goes on to the pressure of light on a perfect mirror. The remark that energy and frequency transform alike is Einstein's. The paper does not connect it with the light quanta of his March paper, and the reading of a light complex's energy as hν in every frame came later. The rigid-body model is authored for this site as a test of the idea that light contracts like matter; it is not a model from the period.",
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
  // The rigid-body countermodel is not an output: sr10Comparison returns it, labelled, beside the
  // accepted snapshot (am-sr-10-light-complex-kek0: the countermodel never enters accepted outputs).
});
