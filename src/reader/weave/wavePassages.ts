import { SR09_MODEL } from "../../experiments/sr09/definition.ts";
import { SR09_LIVE_WEAVE_PREDICATES } from "../../experiments/sr09/liveWeave.ts";
import { SR10_MODEL } from "../../experiments/sr10/definition.ts";
import { SR10_LIVE_WEAVE_PREDICATES } from "../../experiments/sr10/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const SR09_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr09-doppler-principle": Object.freeze({
    title: "The frequency measured by the moving observer",
    sentenceId: "s7-p3-s1",
    pointerText: SR09_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr09-aberration-formula": Object.freeze({
    title: "The same ray's direction in another frame",
    sentenceId: "s7-p5-s2",
    pointerText: SR09_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

export const SR10_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr10-energy-frequency-proportionality": Object.freeze({
    title: "Energy and frequency change by the same law",
    sentenceId: "s8-p5-s1",
    pointerText: SR10_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr10-volume-transformation": Object.freeze({
    title: "The volume enclosing the same light complex",
    sentenceId: "s8-p2-s2",
    pointerText: SR10_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

const WAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "beta", label: "Observer speed", unit: "c" }),
  Object.freeze({ parameterId: "propagationAngleDeg", label: "Ray angle in K", unit: "degrees" }),
]);

export const SR09_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-09",
  constantSetId: SR09_MODEL.constantSetId,
  paper: "special-relativity",
  predicates: SR09_LIVE_WEAVE_PREDICATES,
  passages: SR09_WEAVE_PASSAGES,
  contextFields: Object.freeze([
    ...WAVE_CONTEXT,
    Object.freeze({ parameterId: "frequencyTHz", label: "Frequency in K", unit: "THz" }),
  ]),
});

export const SR10_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-10",
  constantSetId: SR10_MODEL.constantSetId,
  paper: "special-relativity",
  predicates: SR10_LIVE_WEAVE_PREDICATES,
  passages: SR10_WEAVE_PASSAGES,
  contextFields: Object.freeze([
    ...WAVE_CONTEXT,
    Object.freeze({ parameterId: "initialEnergyJ", label: "Energy in K", unit: "J" }),
    Object.freeze({ parameterId: "initialVolumeM3", label: "Volume in K", unit: "m³" }),
  ]),
});
