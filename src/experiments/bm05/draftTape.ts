/**
 * BM-05's ?tape= binding for a worker laboratory (am-inst-permalink-tape-s677; 38999 "yes, replace"):
 * content/experiments/bm-05.yaml's tapeModel (bm05-host-preview-v1, version 1). A shared link puts its settings in
 * the form and starts nothing; the reader applies them. The header names the walkers' stream, bm-05.walk.v1 at stream version 1
 * (experiments/streams/allocation.ts); the trial's own seed travels in the settings.
 */
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { BM05_ALLOCATION } from "../streams/allocation.ts";
import { BM05_DEFAULTS } from "./definition.ts";
import { validateBm05Parameters } from "./parameters.ts";

export const BM05_DRAFT_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "bm-05",
    mode: "bm-05:default",
    modelId: "bm05-host-preview-v1",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: BM05_ALLOCATION.streamVersion,
    allocationId: BM05_ALLOCATION.allocationId,
  }),
  defaults: BM05_DEFAULTS,
  validate: validateBm05Parameters,
});
