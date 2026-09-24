/**
 * BM-07's ?tape= binding for a worker laboratory (am-inst-permalink-tape-s677; 38999 "yes, replace"):
 * content/experiments/bm-07.yaml's tapeModel (inference-bm07-host, version 1). A shared link puts its settings in
 * the form and starts nothing; the reader applies them. The header names the synthetic latent path's stream, bm-07.synthetic-latent.v1
 * (experiments/streams/allocation.ts); its noise stream derives from the same seed, which travels in the
 * settings.
 */
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { streamAllocationRegistry } from "../streams/allocation.ts";
import { BM07_DEFAULTS } from "./definition.ts";
import { validateBm07Parameters } from "./parameters.ts";

/** The latent path's allocation, read by id: a renamed allocation fails here, at load. */
const LATENT = streamAllocationRegistry.getAllocation("bm-07.synthetic-latent.v1");

export const BM07_DRAFT_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "bm-07",
    mode: "bm-07:default",
    modelId: "inference-bm07-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: LATENT.streamVersion,
    allocationId: LATENT.allocationId,
  }),
  defaults: BM07_DEFAULTS,
  validate: validateBm07Parameters,
});
