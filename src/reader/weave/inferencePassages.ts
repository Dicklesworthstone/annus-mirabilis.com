import { BM07_MODEL } from "../../experiments/bm07/definition.ts";
import { BM07_LIVE_WEAVE_PREDICATES } from "../../experiments/bm07/liveWeave.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const BM07_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "bm-07",
  constantSetId: BM07_MODEL.constantSetId,
  paper: "brownian-motion",
  predicates: BM07_LIVE_WEAVE_PREDICATES,
  passages: Object.freeze({
    "bm07-s5-inversion": Object.freeze({
      title: "Use the spreading to estimate the molecular number",
      sentenceId: "s5-p3-s1",
      pointerText: BM07_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
    }),
  }),
  contextFields: Object.freeze([
    Object.freeze({ parameterId: "seed", label: "Seed" }),
    Object.freeze({ parameterId: "M", label: "Displacements per coordinate" }),
    Object.freeze({
      parameterId: "radiusKnown",
      label: "Independent radius supplied",
      values: Object.freeze({ true: "yes", false: "no" }),
    }),
  ]),
});
