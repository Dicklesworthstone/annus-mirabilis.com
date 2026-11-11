import { BM04_MODEL } from "../../experiments/bm04/definition.ts";
import { BM04_LIVE_WEAVE_PREDICATES } from "../../experiments/bm04/liveWeave.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const BM04_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "bm-04",
  constantSetId: BM04_MODEL.constantSetId,
  paper: "brownian-motion",
  predicates: BM04_LIVE_WEAVE_PREDICATES,
  passages: Object.freeze({
    "bm04-s3-diffusion-coefficient": Object.freeze({
      title: "What determines the diffusion coefficient",
      sentenceId: "s3-p8-s5",
      pointerText: BM04_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
    }),
    "bm04-s3-force-balance": Object.freeze({
      title: "Opposing fluxes at equilibrium",
      sentenceId: "s3-p7-s2",
      pointerText: BM04_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
    }),
  }),
  contextFields: Object.freeze([
    Object.freeze({ parameterId: "m", label: "Kick multiplier" }),
    Object.freeze({ parameterId: "steps", label: "Integration steps" }),
    Object.freeze({
      parameterId: "profile",
      label: "Starting profile",
      values: Object.freeze({
        uniform: "uniform",
        step: "step",
        equilibrium: "equilibrium",
        spike: "localized spike",
      }),
    }),
  ]),
});
