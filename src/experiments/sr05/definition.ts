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
    label: "Low speed, β = 10⁻⁴",
    description: "The stable per-second loss at β = 10⁻⁴ beside the printed second-order form.",
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

/**
 * The instrument's four readings (R0 to R3), checked against §4 of the relativity paper
 * (transcript ap-17-891, Annalen pp. 904–905) and against the prepared default snapshot
 * (sr05-example.json): 0.6c out and back for 10 s, proper time 8 s, loss 0.2 s per second exact and
 * 0.18 printed, reunion lag 2 s and 1.8 s, light-clock ticks 2 s and 2.5 s, the equator's
 * 1.203 × 10^{−12} and 104 ns a day, and β = 0.00481 for a second a day. The readings-owners record
 * am-sr-05-moving-clocks-2zka.yaml carries the same text.
 */
export const SR05_CAPTION = Object.freeze({
  r0: "A clock that travels away and comes back reads less time than an identical clock that stayed put. At 60 percent of the speed of light, a trip that takes 10 seconds on the clock at home takes only 8 seconds on the traveller.",
  r1: "Section 4 takes a clock at rest at the origin of the moving system k and asks how fast it runs, judged from the resting system K. Its position is x = vt, and the transformation gives its reading as τ = t√(1 − v^{2}/c^{2}), so each second it falls behind by 1 − √(1 − v^{2}/c^{2}) seconds, or ½(v/c)^{2} to within terms of fourth order. Einstein draws the consequence: a clock carried from A to B and set beside one that stayed there lags by ½t(v/c)^{2}, and so does a clock taken round a closed path back to its start. The instrument computes that reunion for an out-and-back trip or a circle at constant speed. At 0.6c over 10 s of the resting clock, the traveller reads 8 s: the exact loss is 0.2 s per second, 2 s in all, where the printed approximation gives 0.18 s per second, 1.8 s. A light clock with an arm of 1 light-second ticks every 2 s in its own frame and every 2.5 s as judged from K, the same factor 1.25. The comparison is of clock readings at a shared event; it is not what a camera would see.",
  r2: "Take the resting system K and a clock moving along x at speed v = 0.6c, in seconds and light-seconds, so c = 1. The clock's position is x = vt. Section 3's transformation gives the moving system's time as τ = (t − vx/c^{2})/√(1 − v^{2}/c^{2}). Put x = vt into the top: t − v × vt/c^{2} = t(1 − v^{2}/c^{2}), and dividing by √(1 − v^{2}/c^{2}) leaves τ = t√(1 − v^{2}/c^{2}). At 0.6c, v^{2}/c^{2} = 0.36, 1 − 0.36 = 0.64 and √0.64 = 0.8: the moving clock reads 0.8 s for every second of K, and loses 1 − 0.8 = 0.2 s each second. Einstein's approximation uses √(1 − ε) ≈ 1 − ε/2 for small ε, so the loss is about ½ × 0.36 = 0.18 s each second: very good at everyday speeds, 10 percent low at this one. For the trip, out for 5 s and back for 5 s of K's time at 0.6c both ways, the traveller reads 0.8 × 10 = 8 s against the home clock's 10 s, a lag of 2 s; the approximation says 1.8 s. The turn does not change this, because the rate depends only on the speed, so any path at 0.6c for 10 s gives 8 s. A light clock shows the same factor from geometry. In its own frame light crosses an arm of 1 light-second and returns, a tick of 2 s. Seen from K the arm moves at 0.6c while the light crosses, so each leg is the long side of a right triangle: if a leg takes a time T, then (cT)^{2} = 1^{2} + (0.6cT)^{2}, so 0.64T^{2} = 1 and T = 1.25 s, a tick of 2.5 s, and 2.5/2 = 1.25 = 1/0.8. At the equator the ground moves at 465 m/s, so (v/c)^{2}/2 = 1.20 × 10^{−12}, about 104 ns a day in special relativity alone. To lose a whole second a day a clock would need ½β^{2} = 1/86 400, so β = 0.0048, about 1440 km/s.",
  r3: "Einstein called the result a peculiar consequence. He proved it for a path made of straight pieces and assumed it for a curve, with a clock whose rate depends only on its speed, an assumption later named the clock hypothesis. His closing example, a balance-wheel clock at the equator running slower than one at a pole, holds in special relativity alone; on the real Earth the difference in gravitational potential cancels it, and clocks at sea level keep the same rate everywhere, which general relativity explains. The light clock is not in the paper: Lewis and Tolman used it in 1909. Hafele and Keating flew atomic clocks round the world in 1971 and found the lags predicted when both effects are included.",
});
