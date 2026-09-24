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
  // The rod's own length in each frame, its two ends read at one time of that frame, and whether
  // the two readings lie on those ends (am-sr03-default-readings-not-rod-ends-bf7w): the distance
  // the lab calls the rod's comes from here, never from a component's L0/γ.
  rodLengthK: contract("ls", "measured-quantity", SR03_MODEL.id, ["value", "outside-domain"]),
  rodLengthKPrime: contract("ls", "measured-quantity", SR03_MODEL.id, ["value", "outside-domain"]),
  readingsOnRodEnds: contract("1", "classification", SR03_MODEL.id, ["value", "outside-domain"]),
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
    label: "A frame-simultaneous pair",
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
    label: "Reciprocal measurement",
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
    label: "The moving sphere as an ellipsoid",
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
    label: "A timelike pair",
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
    label: "A lightlike pair",
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
    label: "Causal threshold (reversal)",
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
        separatingAssumption: "Relativity of simultaneity: dt′ = −γv dx/c², here −6.0 s.",
      },
      {
        id: "still-simultaneous",
        label: "Simultaneous in both frames (dt' = 0)",
        description: "Events simultaneous in one frame must be simultaneous in all frames.",
        separatingAssumption: "Absolute time: one clock reading holds in every frame.",
      },
      {
        id: "later-trailing",
        label: "Front end later (dt' > 0)",
        description: "The front end measurement occurs later than the rear end measurement in k.",
        separatingAssumption: "The coordinate boost applied with the opposite sign of v.",
      },
    ],
    modelReveal:
      "Because clocks in k are synchronized with light signals in their own frame, the measurement events simultaneous in K occur at different times in k: dt' = -gamma * v * dx / c^2 = -6.0 s.",
  },
  "causal-order": {
    id: "sr-03-predict-causal-order",
    question:
      "If two events have a timelike separation (s² < 0, so a signal slower than light could connect them), what happens to their time order when viewed from a frame moving at 0.95c?",
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
          "That the order of these two events can depend on the frame, as it can for events too far apart for any signal to connect.",
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

/**
 * The instrument's four readings (R0 to R3), checked against §1, §2 and §4 of the relativity
 * paper and against the owner's snapshots: the default pair, and the preset "A frame-simultaneous
 * pair" for the 8 light-second rod. The lab renders them on the reader's detail setting; the
 * readings-owners record am-sr-03-rod-simultaneity-0l5i.yaml carries the same text for the audit.
 */
export const SR03_CAPTION = Object.freeze({
  r0: "Two flashes that happen at the same moment for one observer happen at different moments for an observer moving past. So a moving rod, whose two ends have to be marked at the same moment to measure it, comes out shorter than the same rod measured at rest.",
  r1: "Section 1 defines when two distant clocks agree: light sent from A to B and reflected back must take as long going as returning. Section 2 applies that test to clocks on the ends of a rod moving at speed v, set to agree with the clocks of the resting system K. Seen from K, the light gains on the receding end B at c − v and meets the approaching end A at c + v, so t_{B} − t_{A} = r_{AB}/(c − v) and t′_{A} − t_{B} = r_{AB}/(c + v). The two times differ, so observers riding with the rod find the clocks out of step, while observers in K call them synchronous. Section 4 turns this into geometry: a sphere of radius R at rest in the moving system k, located at one time of K, is an ellipsoid with axes R√(1 − v^{2}/c^{2}), R and R. The instrument measures in light-seconds with c = 1. At v = 0.6c the factor √(1 − v^{2}/c^{2}) is 0.8, a rod 10 light-seconds long at rest in k measures 8 light-seconds in K, and two events 10 light-seconds apart at one time of K are 7.5 s apart in k.",
  r2: "Two frames: K, the resting system, and k, moving along K's x-axis at speed v. The instrument measures distance in light-seconds and time in seconds, so light covers one light-second each second and c = 1. Section 1's rule for two clocks at A and B: send light from A at time t_{A}, reflect it at B at t_{B}, and receive it back at A at t′_{A}. The clocks agree if the trip out takes as long as the trip back, t_{B} − t_{A} = t′_{A} − t_{B}. Section 2 puts clocks on the two ends of a moving rod, sets them to agree with K's clocks, and asks what riders on the rod conclude when they apply the rule. Work it out in K, where the rod has length r_{AB}. Going out, the light chases B, which runs ahead at v, so the gap closes at c − v and the trip takes r_{AB}/(c − v). Coming back, A runs toward the light, the gap closes at c + v, and the trip takes r_{AB}/(c + v). Put in this instrument's rod: v = 0.6 and r_{AB} = 8 light-seconds. Out, 8/0.4 = 20 s. Back, 8/1.6 = 5 s. Twenty seconds is not five, so by Section 1's rule the riders say their clocks disagree, while K, which set them, says they agree. Each is applying the same rule correctly in its own frame, so “at the same time” depends on the frame. The transformation of Section 3 makes this exact. Write γ = 1/√(1 − v^{2}/c^{2}); here that is 1/√(1 − 0.36) = 1/√0.64 = 1/0.8 = 1.25. Two events separated by Δx and Δt in K are separated in k by Δx′ = γ(Δx − vΔt) and Δt′ = γ(Δt − vΔx/c^{2}). The default pair has Δx = 10 light-seconds and Δt = 0. Then Δx′ = 1.25 × 10 = 12.5 light-seconds, and Δt′ = 1.25 × (0 − 0.6 × 10) = −7.5 s: in k, the event farther along x happens 7.5 s earlier. Now the rod. At rest in k it is 10 light-seconds long, with its ends at x′ = 0 and x′ = 10. K measures it by finding where both ends are at one time t of K. At a fixed t, x′ = γ(x − vt) changes by γ for every light-second of x, so the ends are Δx = 10/1.25 = 8 light-seconds apart. Those two marking events are 6 s apart in k, which is why the riders do not accept 8 as their rod's length. The sphere of Section 4 works the same way in three directions: along the motion a radius of 1 light-second becomes 1 × 0.8 = 0.8, and across the motion it stays 1 and 1. A check that uses a later idea, Minkowski's of 1908: Δx^{2} − c^{2}Δt^{2} is the same in both frames, 10^{2} − 0 = 100 in K and 12.5^{2} − 7.5^{2} = 156.25 − 56.25 = 100 in k.",
  r3: "Einstein wrote V for the speed of light, β for the factor now called γ, and ξ and τ for the coordinates of k that this instrument writes x′ and t′; he named the resting system K and the moving one k. The paper cites no one for the shortening. FitzGerald in 1889 and Lorentz in 1892 had proposed that bodies moving through the ether contract along their motion, a physical effect that would account for Michelson and Morley's null result. In Section 4 the same factor follows from the definition of simultaneity and the two principles, and it works both ways, as Einstein says: bodies at rest in K, viewed from k, are shortened in the same ratio. The spacetime diagram in this instrument and the invariant Δx^{2} − c^{2}Δt^{2} are Minkowski's, from his lecture of 1908, and appear nowhere in the paper. The ellipsoid is what rulers and synchronized clocks record at one time of K; a camera receives light that left different parts of the body at different times, and Terrell and Penrose showed in 1959 that a fast sphere photographs with a circular outline.",
});
