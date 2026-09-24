import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Sr06Mode = "collinear" | "angled" | "two-boosts";

export type Sr06Parameters = Readonly<{
  frameBeta: number;
  movingSpeed: number;
  alphaDeg: number;
  mode: Sr06Mode;
  secondBeta: number;
  secondAngleDeg: number;
  showRapidity: boolean;
  mediumIndex: number;
  flowSpeed: number;
}>;

export const SR06_DEFAULTS: Sr06Parameters = Object.freeze({
  frameBeta: 0.6,
  movingSpeed: 0.6,
  alphaDeg: 0,
  mode: "collinear",
  secondBeta: 0.6,
  secondAngleDeg: 90,
  showRapidity: false,
  mediumIndex: 1.333,
  flowSpeed: 7.06,
});

export const SR06_CLASSES: Readonly<Record<keyof Sr06Parameters, ParameterClass>> = Object.freeze({
  frameBeta: "input",
  movingSpeed: "input",
  alphaDeg: "input",
  mode: "presentation",
  secondBeta: "input",
  secondAngleDeg: "input",
  showRapidity: "presentation",
  mediumIndex: "input",
  flowSpeed: "input",
});

export const SR06_QUESTION =
  "Why doesn't adding speeds preserve light speed, and what happens when the motions are not along one line?";

export const SR06_MODEL = Object.freeze({
  id: "sr06-host-v1",
  constantSetId: "modern-si-2019",
  ownerKind: "host-reference" as const,
  label: "Ideal model, host calculation",
});

export const SR06_NOT_MODELED = Object.freeze([
  "accelerated motion",
  "spin dynamics and Thomas precession of real bodies (only the kinematic rotation is shown)",
  "dispersion and the medium's own physics in Fizeau-type setups",
  "gravity",
]);

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-sr-06-velocity-composition-7ni4.yaml, which the readings audit reads. */
export const SR06_CAPTION = Object.freeze({
  r0: "Speeds do not simply add. Two speeds below light's combine to a speed below light's, and light keeps its speed whatever other speed is added to it.",
  r1: "§5 of the relativity paper asks how a point moving with velocity w in the moving system k moves as seen from K. Putting its motion through the transformation of §3 gives, for w along the motion, U = (v + w)/(1 + vw/V²), and for w at an angle α to it, U = √((v² + w² + 2vw cos α) − (vw sin α/V)²)/(1 + vw cos α/V²). The parallelogram law of velocities therefore holds only to a first approximation. With both speeds at 0.6c along one line the lab gives 0.882c, where the Galilean sum would be 1.2c; at right angles it gives 0.768c instead of 0.849c. §5 draws two consequences: two speeds below V always compose to a speed below V, and composing V with any smaller speed gives V again, which the lab shows when the second speed is set to c. It adds that the collinear formula also follows from applying two transformations one after the other, and that such parallel transformations form a group. Two boosts that are not parallel do something §5 does not discuss: the result is a boost combined with a rotation of the axes, 12.68° for 0.6c along x followed by 0.6c at right angles. The lab also shows, as a later check, Fizeau's flowing water: light in water of index 1.333 moving at 7.06 m/s gains 3.09 m/s, the drag u(1 − 1/n²) that the same formula gives to first order.",
  r2: "Take v = 0.6c and w = 0.6c along the same line. The numerator is v + w = 1.2c. The denominator is 1 + vw/c² = 1 + 0.36 = 1.36. So U = 1.2c/1.36 = 0.882c. The denominator is always more than 1 when both speeds point the same way, so the result is always less than the plain sum. To see that it stays below c, write v = c − κ and w = c − λ with κ and λ positive, as §5 does; then U = c(2c − κ − λ)/(2c − κ − λ + κλ/c), and the extra κλ/c in the denominator makes the fraction less than 1. Now let w = c: U = (v + c)/(1 + v/c) = c(v + c)/(c + v) = c, whatever v is. At right angles, α = 90°, so cos α = 0 and sin α = 1, and U = √(0.36 + 0.36 − 0.36²) c = √(0.72 − 0.1296) c = √0.5904 c = 0.768c. In components the lab gives 0.6c along x and 0.48c across; the sideways part is w√(1 − v²/c²) = 0.6 × 0.8 = 0.48, because the moving clock that times the point's sideways motion runs slow. The inverse check takes the result back: removing the frame's 0.6c returns the original 0.6c. The rapidity view turns the collinear rule into addition. Each speed has a rapidity atanh(v/c), here atanh(0.6) = ln 2 = 0.693, and the composed speed's rapidity is their sum, 1.386, with tanh(1.386) = 0.882. For the two boosts at right angles, multiplying their 4 × 4 transformation matrices gives a matrix that is not a pure boost; written as a boost followed by a rotation, the rotation is 12.68° and the combined γ is 1.25 × 1.25 = 1.5625. Last, Fizeau: to first order in the water's speed u, light in the water moves at c/n + u(1 − 1/n²). For n = 1.333, 1 − 1/n² = 0.437, so water flowing at 7.06 m/s adds 7.06 × 0.437 = 3.09 m/s.",
  r3: "§5 writes V for the speed of light and w_{ξ}, w_{η} for the point's velocity components in k, and remarks that v and w enter the result symmetrically. The group property of the transformations also appears in Poincaré's note of June 1905. Laue showed in 1907 that the collinear formula reproduces Fresnel's drag coefficient 1 − 1/n², which Fizeau had measured in flowing water in 1851, so that what had been an ether hypothesis became a consequence of kinematics. The rotation that accompanies two non-parallel boosts was found by Thomas in 1926, in the precession of the electron's spin, and analysed by Wigner in 1939; the paper does not mention it. The name rapidity for atanh(v/c) is Robb's, from 1911.",
});

const contract = (
  unit: string,
  semanticKind: string,
  statuses: OutputContract["statuses"] = ["value", "outside-domain", "not-applicable"],
): OutputContract =>
  Object.freeze({
    unit,
    semanticKind,
    ownerId: "kinematics",
    statuses: Object.freeze([...statuses]),
  });

export const SR06_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  composedUxOverC: contract("1", "composed-x-velocity-over-c"),
  composedUyOverC: contract("1", "composed-y-velocity-over-c"),
  composedSpeedOverC: contract("1", "composed-speed-over-c"),
  printedSpeedOverC: contract("1", "printed-section-5-speed-over-c"),
  galileanSpeedOverC: contract("1", "galilean-sum-speed-over-c"),
  shortfall: contract("1", "cancellation-free-shortfall-from-c"),
  inverseUxOverC: contract("1", "inverse-composed-x-over-c"),
  inverseUyOverC: contract("1", "inverse-composed-y-over-c"),
  rotationDeg: contract("deg", "wigner-rotation-angle"),
  composedGamma: contract("1", "composed-lorentz-factor"),
  productMatrix: contract("1", "two-boost-product-matrix"),
  rapidityFrame: contract("1", "rapidity-later-aid"),
  rapidityMoving: contract("1", "rapidity-later-aid"),
  rapiditySum: contract("1", "collinear-rapidity-sum-later-aid"),
  fizeauIncrement: contract("m/s", "composition-increment-moving-medium"),
  fresnelIncrement: contract("m/s", "fresnel-first-order-drag"),
});

export const SR06_PRESETS = Object.freeze([
  {
    presetId: "sr-06-collinear-0.6-0.6",
    label: "0.6c along 0.6c",
    parameterValues: Object.freeze({
      frameBeta: 0.6,
      movingSpeed: 0.6,
      alphaDeg: 0,
      mode: "collinear" as const,
    }),
  },
  {
    presetId: "sr-06-angled-90deg-0.6",
    label: "Printed formula at 90 degrees",
    parameterValues: Object.freeze({
      frameBeta: 0.6,
      movingSpeed: 0.6,
      alphaDeg: 90,
      mode: "angled" as const,
    }),
  },
  {
    presetId: "sr-06-perpendicular-boosts-0.6",
    label: "Successive perpendicular boosts",
    parameterValues: Object.freeze({
      frameBeta: 0.6,
      secondBeta: 0.6,
      secondAngleDeg: 90,
      mode: "two-boosts" as const,
    }),
  },
  {
    presetId: "sr-06-near-light-0.99",
    label: "0.99c with 0.99c",
    parameterValues: Object.freeze({
      frameBeta: 0.99,
      movingSpeed: 0.99,
      alphaDeg: 0,
      mode: "collinear" as const,
    }),
  },
  {
    presetId: "sr-06-null-ray",
    label: "A transverse light ray",
    parameterValues: Object.freeze({
      frameBeta: 0.6,
      movingSpeed: 1,
      alphaDeg: 90,
      mode: "angled" as const,
    }),
  },
  {
    presetId: "sr-06-fizeau-water",
    label: "Fizeau water limit",
    parameterValues: Object.freeze({
      mediumIndex: 1.333,
      flowSpeed: 7.06,
      mode: "collinear" as const,
    }),
  },
]);
