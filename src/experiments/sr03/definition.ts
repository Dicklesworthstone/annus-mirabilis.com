import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type FrameId = "K" | "k";

export type EndpointPairChoice =
  | "platform-simultaneous"
  | "frame-simultaneous"
  | "causal-timelike"
  | "causal-lightlike"
  | "causal-threshold"
  | "custom";

export interface Sr03Parameters {
  readonly rodRestFrame: FrameId;
  readonly v: number; // velocity fraction of c in [-0.95, 0.95]
  readonly L0: number; // proper length in ls in [1e-6, 1e6]
  readonly measuringFrame: FrameId;
  readonly endpointPairId: EndpointPairChoice;
  readonly R: number; // sphere radius in ls in [1e-6, 1e6]
  readonly customT1?: number;
  readonly customX1?: number;
  readonly customT2?: number;
  readonly customX2?: number;
}

export const SR03_DEFAULTS: Sr03Parameters = Object.freeze({
  rodRestFrame: "k",
  v: 0.6,
  L0: 10,
  measuringFrame: "K",
  endpointPairId: "platform-simultaneous",
  R: 1.0,
});

export const SR03_PARAMETER_CLASSES: Readonly<Record<string, ParameterClass>> = Object.freeze({
  rodRestFrame: "input",
  v: "input",
  L0: "input",
  measuringFrame: "observer",
  endpointPairId: "measurement",
  R: "input",
});
export const SR03_CLASSES = SR03_PARAMETER_CLASSES;

export const SR03_BUDGET = Object.freeze({ workUnits: 1000, allocationBytes: 64000 });

export const SR03_MODEL = Object.freeze({
  id: "sr03-rod-simultaneity-v1",
  constantSetId: "modern-si-2019",
  ownerKind: "host-reference" as const,
  label: "Rod measurement and simultaneity, host calculation",
  source: "src/workers/operations/sr03.ts",
  assumptions: Object.freeze([
    "Ideal inertial reference frames K and k in standard configuration (aligned axes, motion along x).",
    "Point endpoint events on rod worldlines.",
    "Light speed c = 1 light-second per second.",
    "No non-inertial forces, stresses, or acceleration transients.",
  ]),
});

function contract(
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract {
  return Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });
}

export const SR03_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  spatialSeparationK: contract("ls", "coordinate-differential", SR03_MODEL.id, [
    "value",
    "outside-domain",
  ]),
  temporalSeparationK: contract("s", "coordinate-differential", SR03_MODEL.id, [
    "value",
    "outside-domain",
  ]),
  spatialSeparationKPrime: contract("ls", "coordinate-differential", SR03_MODEL.id, [
    "value",
    "outside-domain",
  ]),
  temporalSeparationKPrime: contract("s", "coordinate-differential", SR03_MODEL.id, [
    "value",
    "outside-domain",
  ]),
  simultaneityK: contract("1", "classification", SR03_MODEL.id, ["value", "outside-domain"]),
  simultaneityKPrime: contract("1", "classification", SR03_MODEL.id, ["value", "outside-domain"]),
  measuredLength: contract("ls", "measured-quantity", SR03_MODEL.id, [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  spacetimeIntervalSquared: contract("ls^2", "invariant-scalar", SR03_MODEL.id, [
    "value",
    "outside-domain",
  ]),
  causalOrder: contract("1", "invariant-classification", SR03_MODEL.id, [
    "value",
    "outside-domain",
  ]),
  gammaFactor: contract("1", "lorentz-factor", SR03_MODEL.id, ["value", "outside-domain"]),
  ellipsoidAxisLongitudinal: contract("ls", "geometry-axis", SR03_MODEL.id, [
    "value",
    "outside-domain",
  ]),
  ellipsoidAxisTransverseY: contract("ls", "geometry-axis", SR03_MODEL.id, [
    "value",
    "outside-domain",
  ]),
  ellipsoidAxisTransverseZ: contract("ls", "geometry-axis", SR03_MODEL.id, [
    "value",
    "outside-domain",
  ]),
});

export interface PresetItem {
  readonly label: string;
  readonly description: string;
  readonly parameters: Sr03Parameters;
}

export const SR03_PRESETS: Readonly<Record<string, PresetItem>> = Object.freeze({
  "sr-03-boost-0.6c": {
    label: "Boost to 0.6c (Signature)",
    description:
      "Signature pair: 10 ls platform-simultaneous pair transforms to dt' = -7.5 s, dx' = 12.5 ls.",
    parameters: {
      rodRestFrame: "k",
      v: 0.6,
      L0: 10,
      measuringFrame: "K",
      endpointPairId: "platform-simultaneous",
      R: 1.0,
    },
  },
  "sr-03-valid-pair-0.6c": {
    label: "Valid Frame-Simultaneous Pair",
    description: "Endpoints simultaneous in measuring frame K give measured length L = 8 ls.",
    parameters: {
      rodRestFrame: "k",
      v: 0.6,
      L0: 10,
      measuringFrame: "K",
      endpointPairId: "frame-simultaneous",
      R: 1.0,
    },
  },
  "sr-03-reciprocal-0.6c": {
    label: "Reciprocal Measurement",
    description: "Rod at rest in K measured from k gives contracted length 8 ls.",
    parameters: {
      rodRestFrame: "K",
      v: 0.6,
      L0: 10,
      measuringFrame: "k",
      endpointPairId: "frame-simultaneous",
      R: 1.0,
    },
  },
  "sr-03-sphere-0.6c": {
    label: "Moving Sphere Ellipsoid",
    description: "Sphere of radius 1 ls measured as ellipsoid with axes 0.8 ls, 1.0 ls, 1.0 ls.",
    parameters: {
      rodRestFrame: "k",
      v: 0.6,
      L0: 10,
      measuringFrame: "K",
      endpointPairId: "frame-simultaneous",
      R: 1.0,
    },
  },
  "sr-03-causal-timelike": {
    label: "Causal Timelike Pair",
    description: "dt = 10 s, dx = 5 ls, s^2 = -75 ls^2. Timelike separation with invariant order.",
    parameters: {
      rodRestFrame: "k",
      v: 0.6,
      L0: 10,
      measuringFrame: "K",
      endpointPairId: "causal-timelike",
      R: 1.0,
    },
  },
  "sr-03-causal-lightlike": {
    label: "Causal Lightlike Pair",
    description: "dt = 10 s, dx = 10 ls, s^2 = 0 ls^2. Null connection with invariant order.",
    parameters: {
      rodRestFrame: "k",
      v: 0.6,
      L0: 10,
      measuringFrame: "K",
      endpointPairId: "causal-lightlike",
      R: 1.0,
    },
  },
  "sr-03-causal-threshold": {
    label: "Causal Threshold (Reversal)",
    description: "dt = 2 s, dx = 10 ls, s^2 = +96 ls^2. Spacelike order reverses across v = 0.2c.",
    parameters: {
      rodRestFrame: "k",
      v: 0.2,
      L0: 10,
      measuringFrame: "K",
      endpointPairId: "causal-threshold",
      R: 1.0,
    },
  },
});

export interface PredictCandidate {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly separatingAssumption: string;
}

export interface PredictPrompt {
  readonly id: string;
  readonly question: string;
  readonly candidates: readonly PredictCandidate[];
  readonly modelReveal: string;
}

export type Sr03PromptKey = "endpoint-pair" | "causal-order";

export const SR03_PROMPTS: Readonly<Record<Sr03PromptKey, PredictPrompt>> = Object.freeze({
  "endpoint-pair": {
    id: "sr-03-predict-endpoint-pair",
    question:
      "At v = 0.6c, two events that mark the ends of a moving 10-ls rod are measured simultaneously in platform frame K (dt = 0, dx = 8 ls). What is their time separation dt' in the rod's rest frame k?",
    candidates: [
      {
        id: "earlier-trailing",
        label: "Front end earlier (dt' < 0)",
        description:
          "The front end measurement occurs earlier than the rear end measurement in the rod frame.",
        separatingAssumption: "Relativity of simultaneity: dt' = -gamma * v * dx / c^2 = -6.0 s.",
      },
      {
        id: "still-simultaneous",
        label: "Simultaneous in both frames (dt' = 0)",
        description: "Events simultaneous in one frame must be simultaneous in all frames.",
        separatingAssumption: "Classical absolute time assumption.",
      },
      {
        id: "later-trailing",
        label: "Front end later (dt' > 0)",
        description: "The front end measurement occurs later than the rear end measurement in k.",
        separatingAssumption: "Wrong sign for Lorentz coordinate boost.",
      },
    ],
    modelReveal:
      "Because clocks in k are synchronized with light signals in their own frame, the measurement events simultaneous in K occur at different times in k: dt' = -gamma * v * dx / c^2 = -6.0 s.",
  },
  "causal-order": {
    id: "sr-03-predict-causal-order",
    question:
      "If two events have a timelike separation (s^2 < 0, so a subluminal signal could connect them), what happens to their time order when viewed from a frame moving at 0.95c?",
    candidates: [
      {
        id: "order-preserved",
        label: "Order is invariant",
        description: "Every inertial frame agrees which event occurred first.",
        separatingAssumption: "Lorentz invariance of timelike causal order.",
      },
      {
        id: "order-reverses",
        label: "Time order reverses",
        description: "At sufficiently high relative speed, the time order reverses.",
        separatingAssumption:
          "Confusing spacelike order dependence with timelike order invariance.",
      },
      {
        id: "becomes-simultaneous",
        label: "Becomes simultaneous",
        description: "There exists an inertial frame where the two events occur at the same time.",
        separatingAssumption: "Assuming simultaneity is reachable for timelike intervals.",
      },
    ],
    modelReveal:
      "For timelike and lightlike intervals, no subluminal boost can reverse the sign of dt. Every inertial observer agrees on the causal sequence.",
  },
});
