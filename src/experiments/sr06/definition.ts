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

export const SR06_CAPTION = Object.freeze({
  r0: "Ordinary speeds do not add. Two motions slower than light still compose to a motion slower than light, and a ray of light stays a ray of light.",
  r1: "Section 5 of the 1905 kinematics paper gives the composition from the Lorentz transformation's differentials. Along a line, U = (v + w)/(1 + vw/c²). At an angle the printed formula is used. Two successive boosts that are not parallel also rotate the spatial axes; that rotation is shown as a matrix fact, not as a force.",
  r2: "Type the two speeds as fractions of c. The Galilean sum is drawn for contrast and is labeled as such. No inertial observer is admitted at or beyond c; that is a refusal, not a silent clamp. Rapidity, if shown, is Minkowski's 1908 aid: collinear boosts add rapidities. It is not the paper's presentation.",
  r3: "The Wigner rotation of two non-collinear boosts is a later geometric name for a 1905 kinematic fact. Fizeau's first-order drag is compared here as a later interpretation (Laue 1907); the 1851 dataset is not this instrument.",
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
