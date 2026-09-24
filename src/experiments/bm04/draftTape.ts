/**
 * BM-04's ?tape= binding for a worker laboratory (am-inst-permalink-tape-s677; 38999 "yes, replace"):
 * content/experiments/bm-04.yaml's tapeModel (brownian-motion-drift-diffusion, version 1). A shared link puts its settings in
 * the form and starts nothing; the reader applies them. The drift-diffusion stepper draws no random numbers, so the tape carries no stream.
 */
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { BM04_DEFAULTS } from "./definition.ts";
import { validateBm04Parameters } from "./parameters.ts";

export const BM04_DRAFT_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "bm-04",
    mode: "bm-04:default",
    modelId: "brownian-motion-drift-diffusion",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: BM04_DEFAULTS,
  validate: validateBm04Parameters,
});
