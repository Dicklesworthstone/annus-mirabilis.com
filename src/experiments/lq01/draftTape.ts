/**
 * LQ-01's ?tape= binding for a worker laboratory (am-inst-permalink-tape-s677, 38999 "yes, replace"):
 * content/experiments/lq-01.yaml's tapeModel (lq-01, version 1). A shared link puts its settings in
 * the form and starts nothing; the reader applies them. The model is deterministic, so the tape
 * carries no seed, stream or allocation.
 */
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { LQ01_DEFAULTS } from "./definition.ts";
import { validateLq01Parameters } from "./parameters.ts";

export const LQ01_DRAFT_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "lq-01",
    mode: "lq-01:default",
    modelId: "lq-01",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: LQ01_DEFAULTS,
  validate: validateLq01Parameters,
});
