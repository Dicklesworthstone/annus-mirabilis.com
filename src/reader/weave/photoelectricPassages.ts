import { LQ08_MODEL } from "../../experiments/lq08/definition.ts";
import { LQ08_LIVE_WEAVE_PREDICATES } from "../../experiments/lq08/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const LQ08_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "lq08-s8-linear-frequency": Object.freeze({
    title: "A point on the predicted stopping-potential line",
    sentenceId: "s8-p6-s1",
    pointerText: LQ08_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "lq08-s8-intensity-rate-independence": Object.freeze({
    title: "The assumption that quanta act independently",
    sentenceId: "s8-p7-s2",
    pointerText: LQ08_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
  "lq08-s8-printed-stopping-check": Object.freeze({
    title: "Neglecting escape work in Einstein's check",
    sentenceId: "s8-p5-s1",
    pointerText: LQ08_LIVE_WEAVE_PREDICATES[2]?.pointerText ?? "",
  }),
});

export const LQ08_WEAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "frequency", label: "Frequency", unit: "Hz" }),
  Object.freeze({ parameterId: "workFunction", label: "Work function", unit: "eV" }),
  Object.freeze({ parameterId: "incidentPower", label: "Incident power", unit: "W" }),
  Object.freeze({ parameterId: "quantumEfficiency", label: "Quantum efficiency" }),
  Object.freeze({ parameterId: "collectorPotential", label: "Collector potential", unit: "V" }),
]);

export const LQ08_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "lq-08",
  constantSetId: LQ08_MODEL.constantSetId,
  paper: "light-quanta",
  predicates: LQ08_LIVE_WEAVE_PREDICATES,
  passages: LQ08_WEAVE_PASSAGES,
  contextFields: LQ08_WEAVE_CONTEXT,
});
