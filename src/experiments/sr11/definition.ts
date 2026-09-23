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

export const SR11_CAPTION = Object.freeze({
  r0: "Light reflected from a moving mirror undergoes a double Doppler shift and changes its reflection angle according to relativistic wave kinematics, while exerting a radiation pressure that balances energy conservation between the electromagnetic field and the mirror's mechanical work.",
  r1: "A receding mirror red-shifts the reflected wave and reduces its energy density; an approaching mirror blue-shifts the wave and increases its energy. The energy difference between incident and reflected light precisely equals the mechanical work rate P·v·Am done on or by the mirror.",
  r2: "For oblique incidence the law of reflection changes: cos φ′′′ = −[(1 + β²) cos φ − 2β] / (1 − 2β cos φ + β²). When cos φ ≤ β, the light can never catch the receding mirror, which gives an interception horizon.",
  r3: "In the mirror's rest frame, reflection does no mechanical work and incident power equals reflected power. Transforming the forces and energies back to the laboratory frame reproduces Maxwell-Bartoli radiation pressure and establishes energy conservation across reference frames.",
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
