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

export const SR01_CAPTION = Object.freeze({
  r0: "To give a time to something happening far away, you send a signal out, wait for it to bounce back, and split the difference. Clocks that ride along together while moving turn out not to agree once someone else compares them.",
  r1: "Einstein's procedure: a signal leaves clock A at t_A, reflects at the distant clock B, and returns to A at t'_A. The remote event is assigned the time (t_A + t'_A)/2 by definition, and the round-trip speed 2AB/(t'_A - t_A) equals c in the frame where the procedure runs. A pair of clocks synchronized this way in their own rest frame, but moving at v as judged from a platform, is found out of step there by vL/c^2, with the trailing clock ahead.",
  r2: "Start from the assumption that light travels at the same speed c in every direction and every inertial frame. A flash leaves A at t_A; it must reach B after covering the distance AB, so it arrives at t_A + AB/c; the paper does not measure that one-way time, it chooses to call it t_B, which is exactly the halfway point between t_A and the return time t'_A, since the return leg covers the same distance at the same speed. Doing this once for a rod's two ends while the rod itself moves (section 2) gives two different leg times, r_AB/(c-u) going out and r_AB/(c+u) coming back, because the receiving end has moved during the light's travel.",
  r3: "Einstein's paper 3, section 1 states the procedure as a definition, not a discovered fact, and never claims light is the only way to compare distant clocks; slow clock transport is a coherent alternative with its own dynamical assumption, agreeing with the light convention only in the zero-speed limit.",
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
