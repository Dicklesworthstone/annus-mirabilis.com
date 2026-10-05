import { BM06_LIVE_WEAVE_PREDICATES } from "../../experiments/bm06/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";

/** Source sentence ids from s4-p10.yaml and s4-p6.yaml; the latter spans the definition of D
 * and the diffusion equation. The English face retains its canonical anchor across split units. */
export const BM06_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "bm06-s4-solution": Object.freeze({
    title: "The distribution from a single starting point",
    sentenceId: "s4-p10-s7",
    pointerText: BM06_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "bm06-s4-grid-agreement": Object.freeze({
    title: "The diffusion equation, solved two ways",
    sentenceId: "s4-p6-s7",
    pointerText: BM06_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

export const BM06_WEAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "t", label: "Elapsed time", unit: "s" }),
  Object.freeze({
    parameterId: "gridEnabled", label: "Numerical grid",
    values: Object.freeze({ true: "enabled", false: "off" }),
  }),
]);

export const BM06_READER_WEAVE = Object.freeze({
  instrumentId: "bm-06",
  constantSetId: "modern-si-2019",
  paper: "brownian-motion",
  predicates: BM06_LIVE_WEAVE_PREDICATES,
  passages: BM06_WEAVE_PASSAGES,
  contextFields: BM06_WEAVE_CONTEXT,
});
