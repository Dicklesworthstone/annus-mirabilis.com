import { BM05_MODEL, BM05_WEAVE_PREDICATES } from "../../experiments/bm05/definition.ts";
import { type WeavePassage, withWeavePassages } from "./brownianPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

/** Section 4 defines D from the second moment before deriving the spreading equation. */
const passages: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "bm05-s4-second-moment": Object.freeze({
    title: "From independent steps to the diffusion equation",
    sentenceId: "s4-p6-s7",
    pointerText:
      "At the sample size and seed shown above, the sampled displacement distribution is within the sampling bound at the stated significance plus the finite-step shape difference from the Gaussian with the same second moment. This checks the random-walk model, not a measurement of a liquid.",
  }),
});

export const BM05_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "bm-05",
  constantSetId: BM05_MODEL.constantSetId,
  paper: "brownian-motion",
  predicates: withWeavePassages(BM05_WEAVE_PREDICATES, passages),
  passages,
  contextFields: Object.freeze([
    Object.freeze({ parameterId: "seed", label: "Seed" }),
    Object.freeze({ parameterId: "walkers", label: "Sample size (walkers)" }),
    Object.freeze({ parameterId: "n", label: "Observed steps" }),
    Object.freeze({
      parameterId: "kernel",
      label: "Step distribution",
      values: Object.freeze({
        coin: "equal left/right jumps",
        uniform: "uniform",
        gaussian: "Gaussian",
      }),
    }),
  ]),
});
