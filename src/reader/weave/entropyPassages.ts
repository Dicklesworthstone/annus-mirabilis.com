import { LQ04_MODEL } from "../../experiments/lq04/definition.ts";
import { LQ04_LIVE_WEAVE_PREDICATES } from "../../experiments/lq04/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

/** Point to the volume conclusion and its qualification, never the historical observation. */
export const LQ04_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "lq04-s4-volume-law": Object.freeze({
    title: "The entropy change at fixed energy and band",
    sentenceId: "s4-p5-s1",
    pointerText: LQ04_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "lq04-s4-wien-validity-limit": Object.freeze({
    title: "Limits of the Wien entropy calculation",
    sentenceId: "s4-p1-s3",
    pointerText: LQ04_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

export const LQ04_WEAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "frequency", label: "Frequency", unit: "Hz" }),
  Object.freeze({ parameterId: "bandwidth", label: "Band width", unit: "Hz" }),
  Object.freeze({ parameterId: "referenceVolume", label: "Reference volume", unit: "m³" }),
  Object.freeze({ parameterId: "referenceTemperature", label: "Reference temperature", unit: "K" }),
  Object.freeze({ parameterId: "volumeRatio", label: "Volume ratio V/V₀", unit: "" }),
  Object.freeze({ parameterId: "diluteThresholdX", label: "Dilute threshold βν/T", unit: "" }),
]);

export const LQ04_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "lq-04",
  constantSetId: LQ04_MODEL.constantSetId,
  paper: "light-quanta",
  predicates: LQ04_LIVE_WEAVE_PREDICATES,
  passages: LQ04_WEAVE_PASSAGES,
  contextFields: LQ04_WEAVE_CONTEXT,
});
