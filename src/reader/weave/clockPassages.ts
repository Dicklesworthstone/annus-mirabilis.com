import { SR05_MODEL } from "../../experiments/sr05/definition.ts";
import { SR05_LIVE_WEAVE_PREDICATES } from "../../experiments/sr05/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

/** s4-p9-s2 states the loss per second; its English sentence has two aligned units. */
export const SR05_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr05-s4-moving-clock": Object.freeze({
    title: "The moving clock's loss per second",
    sentenceId: "s4-p9-s2",
    pointerText: SR05_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
});

export const SR05_WEAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "speed", label: "Clock speed", unit: "c" }),
  Object.freeze({
    parameterId: "worldlinePreset",
    label: "Worldline",
    values: Object.freeze({
      inertial: "straight line at constant speed",
      "out-and-back": "out and back",
      circle: "circle at constant speed",
    }),
  }),
  Object.freeze({ parameterId: "coordinateDuration", label: "Coordinate duration", unit: "s" }),
  Object.freeze({ parameterId: "frameOfDescription", label: "Observer speed", unit: "c" }),
]);

export const SR05_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-05",
  constantSetId: SR05_MODEL.constantSetId,
  paper: "special-relativity",
  predicates: SR05_LIVE_WEAVE_PREDICATES,
  passages: SR05_WEAVE_PASSAGES,
  contextFields: SR05_WEAVE_CONTEXT,
});
