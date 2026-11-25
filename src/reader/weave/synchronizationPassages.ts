import { SR01_LIVE_WEAVE_PREDICATES } from "../../experiments/sr01/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const SR01_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr01-s1-midpoint-definition": Object.freeze({
    title: "Defining a common time by light signals",
    sentenceId: "s1-p7-s4",
    pointerText: SR01_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr01-s1-clock-criterion": Object.freeze({
    title: "Comparing the chosen clock setting with the synchronization criterion",
    sentenceId: "s1-p7-s6",
    pointerText: SR01_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
  "sr01-s1-round-trip-postulate": Object.freeze({
    title: "The assumed round-trip light speed",
    sentenceId: "s1-p10-s1",
    pointerText: SR01_LIVE_WEAVE_PREDICATES[2]?.pointerText ?? "",
  }),
  "sr01-s2-moving-pair": Object.freeze({
    title: "A moving pair's clocks, judged from the platform",
    sentenceId: "s2-p8-s1",
    pointerText: SR01_LIVE_WEAVE_PREDICATES[3]?.pointerText ?? "",
  }),
});

export const SR01_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-01",
  // The owner uses light-seconds and seconds with c = 1, not a numerical SI calibration.
  constantSetId: "normalized-c-1",
  paper: "special-relativity",
  predicates: SR01_LIVE_WEAVE_PREDICATES,
  passages: SR01_WEAVE_PASSAGES,
  contextFields: Object.freeze([
    Object.freeze({ parameterId: "stationSeparationLs", label: "Station separation", unit: "ls" }),
    Object.freeze({ parameterId: "emissionTimeA", label: "Emission time at A", unit: "s" }),
    Object.freeze({ parameterId: "clockOffsetB", label: "Clock B offset", unit: "s" }),
    Object.freeze({ parameterId: "pairBeta", label: "Moving pair speed", unit: "c" }),
    Object.freeze({
      parameterId: "pairSeparationLs",
      label: "Pair's proper separation",
      unit: "ls",
    }),
    Object.freeze({ parameterId: "frameBeta", label: "Displayed observer speed", unit: "c" }),
  ]),
});
