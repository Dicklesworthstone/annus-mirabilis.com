import { SR03_MODEL } from "../../experiments/sr03/definition.ts";
import { SR03_LIVE_WEAVE_PREDICATES } from "../../experiments/sr03/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

/** The measurement procedure is stated in §2; §4 supplies its geometrical consequence. */
export const SR03_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr03-s2-simultaneity-relativity": Object.freeze({
    title: "Time order of the same two events",
    sentenceId: "s2-p8-s1",
    pointerText: SR03_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr03-s4-rod-measurement": Object.freeze({
    title: "Read both ends at one time of the measuring frame",
    sentenceId: "s2-p2-s5",
    pointerText: SR03_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
  "sr03-s4-sphere-ellipsoid": Object.freeze({
    title: "A sphere located at one coordinate time",
    sentenceId: "s4-p1-s4",
    pointerText: SR03_LIVE_WEAVE_PREDICATES[2]?.pointerText ?? "",
  }),
});

export const SR03_WEAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "v", label: "Frame speed", unit: "c" }),
  Object.freeze({ parameterId: "L0", label: "Rod rest length", unit: "light-seconds" }),
  Object.freeze({ parameterId: "rodRestFrame", label: "Rod rest frame" }),
  Object.freeze({ parameterId: "measuringFrame", label: "Measuring frame" }),
  Object.freeze({
    parameterId: "endpointPairId",
    label: "Event pair",
    values: Object.freeze({
      "platform-simultaneous": "marks simultaneous in K",
      "frame-simultaneous": "rod ends simultaneous in the measuring frame",
      "causal-timelike": "timelike pair",
      "causal-lightlike": "lightlike pair",
      "causal-threshold": "spacelike pair across the order-reversal threshold",
      custom: "entered event coordinates",
    }),
  }),
  Object.freeze({ parameterId: "R", label: "Sphere rest radius", unit: "light-seconds" }),
]);

export const SR03_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-03",
  constantSetId: SR03_MODEL.constantSetId,
  paper: "special-relativity",
  predicates: SR03_LIVE_WEAVE_PREDICATES,
  passages: SR03_WEAVE_PASSAGES,
  contextFields: SR03_WEAVE_CONTEXT,
});
