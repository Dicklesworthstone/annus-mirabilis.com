import { LQ03_MODEL } from "../../experiments/lq03/definition.ts";
import { LQ03_LIVE_WEAVE_PREDICATES } from "../../experiments/lq03/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

/** The Wien pointer names Einstein's qualification, not his report of experimental evidence. */
export const LQ03_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "lq03-s4-wien-confirmed-within-limits": Object.freeze({
    title: "Wien's law within stated limits",
    sentenceId: "s4-p1-s3",
    pointerText: LQ03_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "lq03-s2-classical-regime": Object.freeze({
    title: "The classical limit of Planck's law",
    sentenceId: "s2-p2-s2",
    pointerText: LQ03_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
  "lq03-s4-outside-wien-regime": Object.freeze({
    title: "Outside the selected Wien approximation",
    sentenceId: "s4-p1-s3",
    pointerText: LQ03_LIVE_WEAVE_PREDICATES[2]?.pointerText ?? "",
  }),
});

export const LQ03_WEAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "T", label: "Temperature", unit: "K" }),
  Object.freeze({ parameterId: "probeNu", label: "Probe frequency", unit: "Hz" }),
  Object.freeze({ parameterId: "epsilon", label: "Relative tolerance", unit: "(fraction)" }),
]);

export const LQ03_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "lq-03",
  constantSetId: LQ03_MODEL.constantSetId,
  paper: "light-quanta",
  predicates: LQ03_LIVE_WEAVE_PREDICATES,
  passages: LQ03_WEAVE_PASSAGES,
  contextFields: LQ03_WEAVE_CONTEXT,
});
