/**
 * BM-08's ?tape= binding for a worker laboratory (am-inst-permalink-tape-s677; 38999 "yes, replace"):
 * content/experiments/bm-08.yaml's tapeModel (inference-bm08-host, version 1). A shared link puts its settings in
 * the form and starts nothing; the reader applies them. The header names the physical path's stream, bm-08.latent.v1
 * (experiments/streams/allocation.ts); its localization stream derives from the same seed, which
 * travels in the settings.
 */
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { streamAllocationRegistry } from "../streams/allocation.ts";
import { BM08_DEFAULTS } from "./definition.ts";
import { validateBm08Parameters } from "./parameters.ts";

/** The latent path's allocation, read by id: a renamed allocation fails here, at load. */
const LATENT = streamAllocationRegistry.getAllocation("bm-08.latent.v1");

export const BM08_DRAFT_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "bm-08",
    mode: "bm-08:default",
    modelId: "inference-bm08-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: LATENT.streamVersion,
    allocationId: LATENT.allocationId,
  }),
  defaults: BM08_DEFAULTS,
  validate: validateBm08Parameters,
});
