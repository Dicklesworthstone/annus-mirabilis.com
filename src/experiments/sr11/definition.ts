import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Sr11Frame = "lab" | "mirror";
export type Sr11UnitLayer = "si" | "gaussian";

export type Sr11Parameters = Readonly<{
  beta: number;
  incidentAngleDeg: number;
  incidentEnergyDensity: number;
  mirrorArea: number;
  frame: Sr11Frame;
  unitLayer: Sr11UnitLayer;
}>;

export const SR11_DEFAULTS: Sr11Parameters = Object.freeze({
  beta: 0.6,
  incidentAngleDeg: 0,
  incidentEnergyDensity: 1.0,
  mirrorArea: 1.0,
  frame: "lab",
  unitLayer: "si",
});

export const SR11_CLASSES: Readonly<Record<keyof Sr11Parameters, ParameterClass>> = Object.freeze({
  beta: "input",
  incidentAngleDeg: "input",
  incidentEnergyDensity: "input",
  mirrorArea: "input",
  frame: "observer",
  unitLayer: "presentation",
});

export const SR11_QUESTION =
  "How do the frequency, angle, amplitude, and radiation pressure of light transform when reflected by a moving mirror, and how does energy balance between the light and the mirror's mechanical work?";

export const SR11_NOT_MODELED = Object.freeze([
  "mirror mass and acceleration (infinite mass limit)",
  "finite mirror thickness and internal absorption",
  "diffraction at mirror edges",
  "quantum radiation pressure fluctuations",
  "non-monochromatic wave packets",
]);

export const SR11_MODEL = Object.freeze({
  id: "moving-mirror-host",
  constantSetId: "modern-si-2019",
  label: "Ideal moving mirror, host calculation",
});

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-sr-11-moving-mirror-wnz1.yaml, which the readings audit reads. */
export const SR11_CAPTION = Object.freeze({
  r0: "Light bouncing off a mirror that moves away comes back redder and weaker, and pushes the mirror less hard than it pushes a mirror at rest. The energy the light loses is exactly the work it does in pushing the mirror along.",
  r1: "The second half of §8 lets the plane waves of §7 fall on a perfectly reflecting mirror that moves with the system k. Einstein transforms the incident light into k, where the mirror is at rest and reflection is ordinary, and transforms the reflected light back to K. For normal incidence on a mirror receding at 0.6c, the reflected light has a quarter of the incident frequency and a quarter of the amplitude, so a sixteenth of the energy per unit volume. The energy principle then gives the pressure: the energy arriving at the mirror each second, less the energy leaving it, is the work the light does in pushing the mirror, P·v, and §8 finds P = 2(A²/8π)(cos φ − v/V)²/(1 − (v/V)²). With 1 J/m³ of light that is 0.5 Pa, against 2 Pa on a mirror at rest; to first order in v/V it is 2(A²/8π) cos² φ, which Einstein notes agrees with experience and with other theories. On a 1 m² mirror, 1.199 × 10^{8} W arrives, 2.998 × 10^{7} W leaves, and the other 8.994 × 10^{7} W is the work done on the mirror, so the ledger balances. Drive the mirror toward the light at 0.6c and everything reverses: four times the frequency, 8 Pa, and the mirror does work on the light. At 30° the reflected ray still leans slightly forward, cos φ′′′ = +0.069, yet it moves along the mirror's direction at only 0.069c while the mirror moves at 0.6c, so the two separate. At oblique incidence the light's speed toward the mirror is c cos φ; at 60° and 0.6c that is 0.5c, less than the mirror's speed, so the light never catches it, and the lab says so instead of computing. In the mirror's own frame no work is done, and the reflected power equals the incident power.",
  r2: "Take normal incidence on a mirror receding at β = 0.6. First the frequency. In the mirror's frame the incident light is shifted by §7's factor √((1 − β)/(1 + β)) = √(0.4/1.6) = 0.5. The mirror, at rest there, sends it back at that frequency. Seen from K, the reflected light comes from a mirror moving away, so it is lowered by the same factor again, and 0.5 × 0.5 = 0.25. §8's general formula, A′′′/A = (1 − 2β cos φ + β²)/(1 − β²), gives the same at φ = 0: (1 − 1.2 + 0.36)/0.64 = 0.16/0.64 = 0.25, and the amplitude falls by that factor as well. Energy per unit volume goes as the amplitude squared, so it falls to 0.25² = 0.0625 J/m³. Now the energy per second on 1 m². The incident light fills 1 J/m³ and moves toward the mirror at c, but the mirror moves away at v, so the light reaches it at the relative rate c − v = 0.4c, and 1 × 0.4 × 2.998 × 10^{8} = 1.199 × 10^{8} J arrive each second. The reflected light, at 0.0625 J/m³, leaves at c while the mirror follows at v, so the region it fills grows by c + v = 1.6c each second: 0.0625 × 1.6c = 0.1c = 2.998 × 10^{7} W. The difference, 0.3c = 8.994 × 10^{7} W, has gone into the mirror as work. Work per second is force times velocity, so the force on each square metre is P = 0.3c/0.6c = 0.5 Pa. §8's formula agrees: 2 × 1 × (1 − 0.6)²/(1 − 0.36) = 2 × 0.16/0.64 = 0.5 Pa. A mirror at rest would feel 2 × 1 = 2 Pa, twice the energy per unit volume, because the light's momentum is reversed. Approaching at 0.6c, the same steps give a frequency ratio of 1.6/0.4 = 4, a pressure of 2 × 1.6²/0.64 = 8 Pa, 1.6c = 4.797 × 10^{8} W arriving, 6.4c = 1.919 × 10^{9} W leaving, and a work rate of −1.439 × 10^{9} W: the mirror now does work on the light. At φ = 30°, cos φ = 0.866, and §8's reflection law gives cos φ′′′ = −((1 + 0.36) × 0.866 − 1.2)/(1 − 1.2 × 0.866 + 0.36) = 0.0222/0.3208 = +0.069, so φ′′′ = 86.0°: the reflected ray still has a small component along the mirror's motion. It separates anyway, because that component carries it along at 0.069c, about 2.1 × 10^{7} m/s, while the mirror moves at 0.6c, 1.8 × 10^{8} m/s. There the pressure is 0.221 Pa, and 7.975 × 10^{7} W in, 3.997 × 10^{7} W out and 3.978 × 10^{7} W of work still balance. In the mirror's own frame the mirror does not move, so no work is done, and incident and reflected powers are equal; the difference in K is entirely the work of a moving force.",
  r3: "§8 writes the energy per unit volume as A²/8π and the speed of light as V, and marks the reflected quantities with triple primes, A′′′, φ′′′ and ν′′′. Its first-order result, 2(A²/8π) cos² φ, is the pressure Maxwell's theory gave for a mirror at rest, which Bartoli had also argued for from thermodynamics; Lebedev, and independently Nichols and Hull, measured light pressure in 1901. The exact formula for a moving mirror, and the energy bookkeeping that yields it, are what §8 adds. Its closing claim, that the optics of moving bodies reduces to the optics of bodies at rest by a change of frame, states the program of the whole paper.",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const SR11_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  frequencyRatio: c("1", "ratio", "waves", ["value", "not-applicable", "outside-domain"]),
  cosPhiReflected: c("1", "cosine", "waves", ["value", "not-applicable", "outside-domain"]),
  phiReflectedDeg: c("deg", "angle", "waves", ["value", "not-applicable", "outside-domain"]),
  amplitudeRatio: c("1", "ratio", "waves", ["value", "not-applicable", "outside-domain"]),
  radiationPressure: c("Pa", "pressure", "waves", ["value", "not-applicable", "outside-domain"]),
  radiationForce: c("N", "force", "waves", ["value", "not-applicable", "outside-domain"]),
  incidentPower: c("W", "power", "waves", ["value", "not-applicable", "outside-domain"]),
  reflectedPower: c("W", "power", "waves", ["value", "not-applicable", "outside-domain"]),
  workRate: c("W", "power", "waves", ["value", "not-applicable", "outside-domain"]),
  energyBalanceResidual: c("W", "power", "waves", ["value", "not-applicable", "outside-domain"]),
});
