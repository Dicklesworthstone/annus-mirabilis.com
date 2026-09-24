import type { PredictPrompt } from "../../content/schemas/experiment.ts";
import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export interface Sr01Parameters {
  /** r_AB, light-seconds, > 0. Drives both the basic synchronization round and the section 2 rod chase. */
  readonly stationSeparationLs: number;
  /** Signal emission time at A, seconds. */
  readonly emissionTimeA: number;
  /** B's own independently-declared clock offset from the procedure's assignment, seconds. */
  readonly clockOffsetB: number;
  /** Section 2 station motion: the rod ends' velocity in the stationary frame, fraction of c. */
  readonly rodBeta: number;
  /** The moving clock pair's velocity in the platform frame, fraction of c. */
  readonly pairBeta: number;
  /** The moving pair's proper separation L, light-seconds, > 0. */
  readonly pairSeparationLs: number;
  /** Frame of description: an observer-change, never creates a new physical setup. */
  readonly frameBeta: number;
}

export const SR01_DEFAULTS: Sr01Parameters = Object.freeze({
  stationSeparationLs: 10,
  emissionTimeA: 0,
  clockOffsetB: 0,
  rodBeta: 0,
  pairBeta: 0.6,
  pairSeparationLs: 10,
  frameBeta: 0,
});

export const SR01_CLASSES: Readonly<Record<keyof Sr01Parameters, ParameterClass>> = Object.freeze({
  stationSeparationLs: "input",
  emissionTimeA: "input",
  clockOffsetB: "input",
  rodBeta: "input",
  pairBeta: "input",
  pairSeparationLs: "input",
  frameBeta: "observer",
});

export const SR01_QUESTION =
  "How can distant clocks acquire an operational common time, and do moving clocks share it?";

export const SR01_NOT_MODELED = Object.freeze([
  "signal delays in cables or electronics",
  "gravitational effects",
  "accelerated or rotating clocks",
  "clock mechanisms",
  "the optical appearance of distant clocks",
  "detector response times",
  "any measurement of one-way light speed",
]);

const contract = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value", "outside-domain"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const SR01_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  assignedRemoteTime: contract("s", "assigned-remote-time", "events.synchronizationRound"),
  roundTripSpeed: contract("ls/s", "round-trip-speed", "events.synchronizationRound"),
  criterionOffset: contract("s", "criterion-offset", "events.synchronizationRound"),
  chaseOutboundLeg: contract("s", "rod-chase-outbound-leg", "events.movingRodLegs"),
  chaseReturnLeg: contract("s", "rod-chase-return-leg", "events.movingRodLegs"),
  desynchronization: contract(
    "s",
    "desynchronization-magnitude",
    "events.desynchronizationObserved",
  ),
  oneWayLightSpeed: contract("ls/s", "one-way-light-speed", "events.byConvention", [
    "not-applicable",
  ]),
});

export const SR01_MODEL = Object.freeze({
  id: "sr-01-clock-sync-host",
  ownerKind: "host-reference",
  label: "Ideal model, host calculation",
  source: "src/physics/reference/events.ts",
  assumptions: Object.freeze([
    "The two one-way transit times of the synchronizing signal are set equal by definition, not measured: Einstein's stated procedure (paper 3, section 1).",
    "Light speed c is the same in every inertial frame (postulate).",
    "Inertial frames, aligned axes, point events, and ideal clocks.",
  ]),
  alternativeProcedures: Object.freeze([
    Object.freeze({
      id: "slow-clock-transport",
      label: "Slow clock transport",
      assumption:
        "Requires a dynamical assumption about how a clock's rate depends on its motion, not merely a convention about signals. In the limit of vanishingly slow transport, within one inertial frame, it agrees with the light convention; at any finite transport speed the two differ by an amount that goes to zero with the transport speed. This is a limiting statement, never an exact equivalence at finite speed.",
    }),
  ]),
});

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-sr-01-clock-sync-jbfn.yaml, which the readings audit reads. */
export const SR01_CAPTION = Object.freeze({
  r0: "To give a time to something that happens far away, send a light signal there, let it bounce back, and take the moment halfway between sending and return. Two clocks set this way while riding together do not agree when they are judged from a platform they pass.",
  r1: "Section 1 starts from the fact that every statement of time is a statement about simultaneous events: the train arrives, and the small hand of my watch points to 7. A clock at A times the events near A, and a like clock at B times the events near B, but nothing yet gives A and B a common time. Einstein supplies one by definition: the time light takes from A to B is set equal to the time it takes from B back to A. A ray leaves A at A-time t_{A}, is reflected at B at B-time t_{B}, and returns at A-time t′_{A}; the clocks run synchronously when t_{B} − t_{A} = t′_{A} − t_{B}. He then fixes, in agreement with experience, that 2AB/(t′_{A} − t_{A}) = V, the speed of light in empty space, is a universal constant. In the lab a flash sent at 0 s and returned at 10 s gives the reflection the time 5 s; the one-way speed is never measured, and the lab reports it as not applicable. Section 2 applies the same test to clocks at the ends of a rod of length r_{AB} that moves at v, with the clocks set in the resting system. Riders find t_{B} − t_{A} = r_{AB}/(V − v) and t′_{A} − t_{B} = r_{AB}/(V + v), 25 s and 6.25 s for 10 light-seconds at 0.6V, so they judge the clocks out of step. By the transformation of section 3, a pair set in step by its own riders a distance L apart reads out of step on the platform by vL/V²: 6 s for L = 10 light-seconds at 0.6V, with the trailing clock ahead.",
  r2: "Why a definition is needed: to measure how long light takes from A to B you must read the departure on A's clock and the arrival on B's, and that already assumes the two clocks agree, which is the thing to be settled. So section 1 does not measure the one-way time; it stipulates that the two legs take equally long. The rule gives B's clock the reading at reflection t_{B} = t_{A} + (t′_{A} − t_{A})/2, halfway between sending and return on A's clock. With stations 5 light-seconds apart, a flash sent at 0 s is back at 10 s, so the reflection is assigned 5 s; a second flash sent at 20 s is back at 30 s and is assigned 25 s, which is consistent with the first. The round trip needs only A's clock, so it is a real measurement: with stations 10 light-seconds apart the flash is back after 20 s, and 2 × 10/20 = 1 light-second per second, the speed V. Einstein also assumes, without proof, that the rule is symmetric (if B is in step with A, then A is in step with B) and transitive (two clocks in step with a third are in step with each other). Section 2 moves the rod. Its clocks are set in the resting system, and riders test them with the same rule. Going out, the light must catch the far end, which recedes at v: after a time T the light has gone VT and the end has reached r_{AB} + vT, so T = r_{AB}/(V − v) = 10/(1 − 0.6) = 25 s. Coming back, the near end runs to meet the light: T = r_{AB}/(V + v) = 10/1.6 = 6.25 s. The legs are unequal, so by the riders' own test the clocks are not in step. For a pair set in step by its riders, section 3's transformation τ = β(t − vx/V²), with β = 1/√(1 − v²/V²), gives the answer on the platform. At one platform time t, the two clocks stand L/β apart, so their readings differ by β × v × (L/β)/V² = vL/V². For L = 10 light-seconds and v = 0.6V that is 0.6 × 10 = 6 s. The clock at smaller x, the trailing one, reads more, and at v = 0 the offset vanishes.",
  r3: "Einstein writes V for the speed of light (today's c) and states the rule 'durch Definition': the equal legs are a stipulation, the constancy of the round-trip speed is fixed 'der Erfahrung gemäß', and symmetry and transitivity are assumed. In 1900 Poincaré had described observers who set their clocks by exchanging light signals while moving through the ether and so obtain Lorentz's local time, to first order in v/V. Whether the equal-legs rule is a free choice was argued later, as a modern lens: Reichenbach (1928) wrote the reflection time as t_{A} + ε(t′_{A} − t_{A}), with Einstein's choice ε = 1/2; Ellis and Bowman (1967) showed that slowly carried clocks agree with ε = 1/2 only in the limit of vanishing transport speed; Malament (1977) argued that the standard choice is the only one definable from the causal structure of one inertial frame, a claim still debated. The paper does not say that light is the only way to compare distant clocks.",
});

export type Sr01Preset = Readonly<{
  presetId: string;
  label: string;
  parameterValues: Sr01Parameters;
}>;

export const SR01_PRESETS: readonly Sr01Preset[] = Object.freeze([
  Object.freeze({
    presetId: "sr-01-sync-0-10",
    label: "Emission at 0, reception at 10 (reflection assigned 5)",
    parameterValues: { ...SR01_DEFAULTS, stationSeparationLs: 5, emissionTimeA: 0 },
  }),
  Object.freeze({
    presetId: "sr-01-second-flash-20-30",
    label: "Emission at 20, reception at 30 (reflection assigned 25)",
    parameterValues: { ...SR01_DEFAULTS, stationSeparationLs: 5, emissionTimeA: 20 },
  }),
  Object.freeze({
    presetId: "sr-01-round-trip-10ls",
    label: "Round trip over 10 light-seconds (speed = c)",
    parameterValues: { ...SR01_DEFAULTS, stationSeparationLs: 10, emissionTimeA: 0 },
  }),
  Object.freeze({
    presetId: "sr-01-rod-chase-0.6c",
    label: "Rod ends 10 ls apart, moving at 0.6c (legs 25 s / 6.25 s)",
    parameterValues: { ...SR01_DEFAULTS, stationSeparationLs: 10, rodBeta: 0.6 },
  }),
  Object.freeze({
    presetId: "sr-01-moving-pair-0.6c",
    label: "Moving pair: L = 10 ls at 0.6c (6 s desynchronization, trailing ahead)",
    parameterValues: { ...SR01_DEFAULTS, pairSeparationLs: 10, pairBeta: 0.6 },
  }),
  Object.freeze({
    presetId: "sr-01-three-stations",
    label: "Three mutually resting stations (A, B, C): transitivity",
    parameterValues: { ...SR01_DEFAULTS },
  }),
]);

/**
 * Conforms to the real `PredictPrompt`/`PredictCandidate` shape
 * (`src/content/schemas/experiment.ts`), the same contract `am-inst-predict-mode-ti7m` built
 * and BM-05 already fills in: bound to the `desynchronization` output, reached by `pairBeta`
 * and by the preset `sr-01-moving-pair-0.6c`. The reveal is read from
 * `desynchronizationObserved`'s own `verdict` field at evaluation time (`session.ts`'s
 * `predictAnswerFor`), never from a stored string, so the question and the reveal cannot drift.
 */
export const SR01_PREDICT_MOVING_PAIR: PredictPrompt = Object.freeze({
  promptId: "sr-01-predict-moving-pair",
  controlId: "pairBeta",
  question:
    "A pair of clocks rides past at a steady speed, and the riders set their clocks with the same light-signal rule. Judged by our clocks, what do theirs show?",
  candidates: Object.freeze([
    Object.freeze({
      id: "they-agree",
      label: "They agree with ours",
      description:
        "The moving pair's clocks read the same as ours at every moment we compare them.",
      separatingAssumption:
        "That would hold only if simultaneity itself did not depend on the frame doing the judging -- but the same light-signal procedure, applied by observers in relative motion, assigns different remote times to the same pair of events.",
    }),
    Object.freeze({
      id: "leading-clock-ahead",
      label: "The leading clock is ahead",
      description:
        "The clock at the front of the moving pair, in its direction of travel, reads later than the trailing one.",
      separatingAssumption:
        "This is the mirror image of what the platform frame actually finds for a pair moving in the positive direction: vL/c^2 puts the trailing clock ahead, not the leading one, for positive v.",
    }),
    Object.freeze({
      id: "trailing-clock-ahead",
      label: "The trailing clock is ahead",
      description:
        "The clock at the back of the moving pair, in its direction of travel, reads later than the leading one.",
      separatingAssumption:
        "This is what vL/c^2 gives directly: for a positive velocity, the trailing clock is observed ahead in the platform frame, by an amount that grows with both the speed and the proper separation.",
    }),
  ]),
});
