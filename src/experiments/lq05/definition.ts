import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Lq05View = "enumeration" | "sampling" | "logarithmic";

export type Lq05Parameters = Readonly<{
  n: number;
  f: number;
  view: Lq05View;
  locked: boolean;
  seed: string;
  trials: number;
}>;

export const LQ05_DEFAULTS: Lq05Parameters = Object.freeze({
  n: 4,
  f: 0.5,
  view: "enumeration",
  locked: false,
  seed: "12345",
  trials: 10000,
});

export const LQ05_CLASSES: Readonly<Record<keyof Lq05Parameters, ParameterClass>> = Object.freeze({
  n: "input",
  f: "estimator",
  view: "presentation",
  locked: "input",
  seed: "input",
  trials: "input",
});

export const LQ05_MODEL = Object.freeze({
  id: "lq05-independent-configurations-v1",
  constantSetId: "modern-si-2019",
  label: "Independent configurations & Boltzmann entropy · host calculation",
  assumptions: Object.freeze([
    "No favored part of the space or direction in volume V_0.",
    "Negligible interactions among the n movable points.",
    "Other movable points may also be present without altering the independent distribution.",
    "No assumption is needed about the laws of motion of the points.",
  ]),
  notModeled: Object.freeze([
    "Interactions between points.",
    "Gas dynamics or time evolution.",
    "Radiation itself (this is the gas and dilute-solution analogy, not a model of light).",
    "Correlations other than the fully locked case.",
  ]),
});

export const LQ05_QUESTION =
  "How does counting independent possibilities produce an entropy that depends on volume like n ln V, and what changes if the things are not independent?";

export const LQ05_CAPTION = Object.freeze({
  r0: "With n independent points, the chance that all lie in fraction f of the volume is W = f^n, giving entropy difference ΔS = k_B ln W = n k_B ln f.",
  r1: "Einstein §5 shows that Boltzmann's principle S - S_0 = (R/N) lg W leads to the same volume dependence as Wien radiation when W is computed from independent points.",
  r2: "For n points distributed uniformly and independently in V_0, the statistical probability that all lie in subvolume V is (V/V_0)^n. If the points are rigidly locked together, the probability is V/V_0, demonstrating that statistical independence is what produces the power n.",
  r3: "Historical note: Einstein uses (R/N) lg W where lg denotes the natural logarithm. The paper notes that this derivation of the gas law requires no assumption regarding the laws of motion of the molecules.",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const LQ05_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  configurationProbability: c("1", "probability", "radiation.independentPointsProbability", [
    "value",
    "outside-domain",
  ]),
  lnW: c("1", "log-probability", "radiation.independentPointsProbability", [
    "value",
    "outside-domain",
  ]),
  log10W: c("1", "log10-probability", "radiation.independentPointsProbability", [
    "value",
    "outside-domain",
  ]),
  deltaSOverKb: c("1", "entropy-dimensionless", "radiation.independentPointsProbability", [
    "value",
    "outside-domain",
  ]),
  sampleFraction: c("1", "empirical-probability", "radiation.sampleIndependentPoints", [
    "value",
    "outside-domain",
  ]),
  successCount: c("1", "success-count", "radiation.sampleIndependentPoints", [
    "value",
    "outside-domain",
  ]),
  drawCountAfter: c("1", "draw-count", "radiation.sampleIndependentPoints", [
    "value",
    "outside-domain",
  ]),
  expectedTrialsToOne: c("1", "expected-trials", "radiation.independentPointsProbability", [
    "value",
    "outside-domain",
  ]),
  lockedProbability: c("1", "locked-probability", "radiation.lockedPositionsProbability", [
    "value",
    "outside-domain",
  ]),
});

export const LQ05_PRESETS: Readonly<
  Record<string, Readonly<{ label: string; description: string; parameters: Lq05Parameters }>>
> = Object.freeze({
  "lq-05-first-encounter": Object.freeze({
    label: "First encounter (n = 2, f = 1/2)",
    description: "Two independent points in half a volume: 4 microstates, 1 favorable, W = 1/4.",
    parameters: Object.freeze({
      n: 2,
      f: 0.5,
      view: "enumeration",
      locked: false,
      seed: "12345",
      trials: 10000,
    }),
  }),
  "lq-05-journey-stage-e": Object.freeze({
    label: "Journey I Stage E (n = 3, log, locked)",
    description:
      "Stage E walkthrough: microstate counting with n = 3, large n scaling, and the locked counterexample.",
    parameters: Object.freeze({
      n: 3,
      f: 0.5,
      view: "enumeration",
      locked: false,
      seed: "19050511",
      trials: 10000,
    }),
  }),
  "lq-05-locked-positions": Object.freeze({
    label: "The locked positions (n = 10, locked counterexample)",
    description:
      "Ten rigidly locked points: W = 1/2 rather than 1/1024, demonstrating that independence produces the power n.",
    parameters: Object.freeze({
      n: 10,
      f: 0.5,
      view: "enumeration",
      locked: true,
      seed: "12345",
      trials: 10000,
    }),
  }),
  "lq-05-n60-log": Object.freeze({
    label: "Large ensemble logarithmic view (n = 60)",
    description:
      "Macroscopic scaling: 60 independent points in half a volume give W ≈ 8.67 × 10^-19 (log10 W ≈ -18.06).",
    parameters: Object.freeze({
      n: 60,
      f: 0.5,
      view: "logarithmic",
      locked: false,
      seed: "12345",
      trials: 10000,
    }),
  }),
});
