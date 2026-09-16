import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type WorldlinePreset = "inertial" | "out-and-back" | "circle";

export const WORLDLINE_PRESETS: readonly WorldlinePreset[] = Object.freeze([
  "inertial",
  "out-and-back",
  "circle",
]);

export type Sr05Parameters = Readonly<{
  speed: number;
  worldlinePreset: WorldlinePreset;
  coordinateDuration: number;
  lightClockArm: number;
  frameOfDescription: number;
  showPrintedSecondOrder: boolean;
  equatorMode: boolean;
}>;

export const SR05_DEFAULTS: Sr05Parameters = Object.freeze({
  speed: 0.6,
  worldlinePreset: "out-and-back",
  coordinateDuration: 10,
  lightClockArm: 1,
  frameOfDescription: 0,
  showPrintedSecondOrder: true,
  equatorMode: false,
});

export const SR05_CLASSES: Readonly<Record<keyof Sr05Parameters, ParameterClass>> = Object.freeze({
  speed: "input",
  worldlinePreset: "input",
  coordinateDuration: "input",
  lightClockArm: "input",
  frameOfDescription: "observer",
  showPrintedSecondOrder: "presentation",
  equatorMode: "presentation",
});

export const SR05_MODEL = Object.freeze({
  id: "sr05-moving-clocks-reference-v1",
  constantSetId: "modern-si-2019",
  label: "Moving clocks · reference model, host calculation",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const SR05_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  speed: c("1", "signed-frame-speed", "sr05.acceptedInputs"),
  coordinateDuration: c("s", "coordinate-time", "sr05.acceptedInputs"),
  lightClockArm: c("ls", "length", "sr05.acceptedInputs"),
  frameOfDescription: c("1", "signed-frame-speed", "sr05.acceptedInputs"),

  properTime: c("s", "proper-time", "sr05.worldline.properTimeAlongLegs", [
    "value",
    "outside-domain",
  ]),
  coordinateTime: c("s", "coordinate-time", "sr05.worldline.properTimeAlongLegs", [
    "value",
    "outside-domain",
  ]),
  dilationLossExact: c("1", "dilation-loss-per-second", "kinematics.dilationLossPerSecond", [
    "value",
    "outside-domain",
  ]),
  dilationLossPrintedSecondOrder: c(
    "1",
    "dilation-loss-per-second-printed",
    "kinematics.dilationLossPerSecond",
    ["value", "outside-domain"],
  ),
  dilationLossDifference: c("1", "dilation-loss-difference", "sr05.session.evaluateSr05", [
    "value",
    "outside-domain",
  ]),

  reunionExactLag: c("s", "reunion-lag", "sr05.worldline.reunionComparison", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  reunionPrintedApproxLag: c("s", "reunion-lag-printed", "sr05.worldline.reunionComparison", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),

  reciprocalDilationFactor: c("1", "reciprocal-dilation-factor", "sr05.worldline.reciprocalRates", [
    "value",
    "outside-domain",
  ]),

  lightClockProperTick: c("s", "light-clock-proper-tick", "sr05.worldline.lightClockTicks", [
    "value",
    "outside-domain",
  ]),
  lightClockCoordinateTick: c(
    "s",
    "light-clock-coordinate-tick",
    "sr05.worldline.lightClockTicks",
    ["value", "outside-domain"],
  ),

  equatorFractionalRate: c("1", "equator-illustrative-rate", "sr05.worldline.equatorNote"),
  equatorApproxNanosecondsPerDay: c(
    "ns",
    "equator-illustrative-ns-per-day",
    "sr05.worldline.equatorNote",
  ),

  dailyLossSpeedBeta: c("1", "daily-loss-speed", "kinematics.speedForDailyLoss", [
    "value",
    "outside-domain",
  ]),
});

export const SR05_NOT_MODELED: readonly string[] = Object.freeze([
  "Gravitational time dilation",
  "Real clock mechanisms under acceleration",
  "Rotating-frame (Sagnac) synchronization effects",
  "The Earth's actual geoid shape and gravity field",
  "Atomic-clock physics (transition frequencies, systematic shifts)",
  "Clock noise and measurement uncertainty",
  "Desynchronized separated-reading comparisons across frames (needs a stated simultaneity convention; only reunion comparisons are computed here)",
]);

export type Sr05Preset = Readonly<{
  id: string;
  label: string;
  description: string;
  parameters: Sr05Parameters;
}>;

export const SR05_PRESETS: Readonly<Record<string, Sr05Preset>> = Object.freeze({
  "sr-05-inertial-0.6c": Object.freeze({
    id: "sr-05-inertial-0.6c",
    label: "Inertial clock at 0.6c",
    description: "A single inertial clock at 0.6c for 10 s of platform time: tau/t = 0.8.",
    parameters: Object.freeze({
      ...SR05_DEFAULTS,
      worldlinePreset: "inertial",
      speed: 0.6,
      coordinateDuration: 10,
    }),
  }),
  "sr-05-out-and-back-0.6c": Object.freeze({
    id: "sr-05-out-and-back-0.6c",
    label: "Out and back at 0.6c",
    description:
      "A clock goes out and back at 0.6c for 10 s of platform time: reunion reading 8 s.",
    parameters: Object.freeze({
      ...SR05_DEFAULTS,
      worldlinePreset: "out-and-back",
      speed: 0.6,
      coordinateDuration: 10,
    }),
  }),
  "sr-05-circle-0.6c": Object.freeze({
    id: "sr-05-circle-0.6c",
    label: "Constant-speed circle at 0.6c",
    description:
      "A clock circles at constant speed 0.6c for 10 s of platform time: reunion reading 8 s.",
    parameters: Object.freeze({
      ...SR05_DEFAULTS,
      worldlinePreset: "circle",
      speed: 0.6,
      coordinateDuration: 10,
    }),
  }),
  "sr-05-low-speed-1e-4": Object.freeze({
    id: "sr-05-low-speed-1e-4",
    label: "Low-speed loss at beta = 1e-4",
    description: "The stable per-second loss at beta = 1e-4 beside the printed second-order form.",
    parameters: Object.freeze({ ...SR05_DEFAULTS, worldlinePreset: "inertial", speed: 1e-4 }),
  }),
  "sr-05-daily-second": Object.freeze({
    id: "sr-05-daily-second",
    label: "A clock losing one second per day",
    description: "The speed at which an ideal clock loses exactly one second per day.",
    parameters: Object.freeze({ ...SR05_DEFAULTS, worldlinePreset: "inertial", speed: 4.81124e-3 }),
  }),
  "sr-05-light-clock-0.6c": Object.freeze({
    id: "sr-05-light-clock-0.6c",
    label: "Light clock at 0.6c",
    description:
      "A 1-light-second transverse light clock moving at 0.6c: 2.5 s coordinate versus 2 s proper.",
    parameters: Object.freeze({
      ...SR05_DEFAULTS,
      worldlinePreset: "inertial",
      speed: 0.6,
      lightClockArm: 1,
    }),
  }),
  "sr-05-equator-note": Object.freeze({
    id: "sr-05-equator-note",
    label: "The equator remark",
    description: "The equator mode with its limit-of-model note.",
    parameters: Object.freeze({ ...SR05_DEFAULTS, equatorMode: true }),
  }),
});
