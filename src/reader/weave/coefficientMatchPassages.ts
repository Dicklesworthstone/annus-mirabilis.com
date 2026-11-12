import { LQ06_MODEL } from "../../experiments/lq06/definition.ts";
import { LQ06_LIVE_WEAVE_PREDICATES } from "../../experiments/lq06/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const LQ06_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "lq06-s6-entropy-match": Object.freeze({
    title: "Rewriting the entropy as a probability",
    sentenceId: "s6-p1-s2",
    pointerText: LQ06_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "lq06-s6-effective-count": Object.freeze({
    title: "The qualified inference to independent energy quanta",
    sentenceId: "s6-p6-s1",
    pointerText: LQ06_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
  "lq06-s6-mean-quantum-energy": Object.freeze({
    title: "Mean quantum energy and molecular kinetic energy",
    sentenceId: "s6-p3-s2",
    pointerText: LQ06_LIVE_WEAVE_PREDICATES[2]?.pointerText ?? "",
  }),
});

export const LQ06_WEAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "radiationEnergy", label: "Radiation energy", unit: "J" }),
  Object.freeze({ parameterId: "frequency", label: "Frequency", unit: "Hz" }),
  Object.freeze({ parameterId: "volumeRatio", label: "Volume ratio" }),
  Object.freeze({ parameterId: "temperature", label: "Temperature", unit: "K" }),
  Object.freeze({
    parameterId: "constantSetId",
    label: "Constants",
    values: Object.freeze({
      "modern-si-2019": "2019 SI",
      "einstein-1905-light-quanta-printed": "the paper's printed constants",
    }),
  }),
]);

export const LQ06_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "lq-06",
  constantSetId: (accepted) =>
    typeof accepted.parameters.constantSetId === "string"
      ? accepted.parameters.constantSetId
      : LQ06_MODEL.constantSetId,
  paper: "light-quanta",
  predicates: LQ06_LIVE_WEAVE_PREDICATES,
  passages: LQ06_WEAVE_PASSAGES,
  contextFields: LQ06_WEAVE_CONTEXT,
});
