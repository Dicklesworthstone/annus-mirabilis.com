/**
 * BM-01's ?tape= binding for a worker laboratory (am-inst-permalink-tape-s677; 38999 "yes, replace"):
 * content/experiments/bm-01.yaml's tapeModel (brownian-motion-reference, version 1). A shared link
 * puts its settings in the form, the seed among them, and starts nothing; the reader applies them.
 * The header names the stream the tracers draw from, bm-01.latent.v1 at stream version 1
 * (experiments/streams/allocation.ts), and the modern constant set; the laboratory itself reads the
 * printed 1905 set when the settings are Einstein's own inputs.
 */
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { BM01_ALLOCATION } from "../streams/allocation.ts";
import { BM01_DEFAULTS } from "./definition.ts";
import { validateBm01Parameters } from "./parameters.ts";

export const BM01_DRAFT_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "bm-01",
    mode: "bm-01:default",
    modelId: "brownian-motion-reference",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: BM01_ALLOCATION.streamVersion,
    allocationId: BM01_ALLOCATION.allocationId,
  }),
  defaults: BM01_DEFAULTS,
  validate: validateBm01Parameters,
});
