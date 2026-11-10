/**
 * BM-07's ?tape= binding for a worker laboratory (am-inst-permalink-tape-s677; 38999 "yes, replace"):
 * content/experiments/bm-07.yaml's tapeModel (inference-bm07-host, version 1). A shared link puts its settings in
 * the form and starts nothing; the reader applies them. The header names the synthetic latent path's stream, bm-07.synthetic-latent.v1
 * (experiments/streams/allocation.ts); the hidden generator parameter uses the same full seed.
 */
import {
  INFERENCE_GRID_DT,
  INFERENCE_GRID_STEPS,
} from "../../physics/reference/inference/synthetic.ts";
import { parseU64 } from "../identity/u64.ts";
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
    constantSetId: BM07_DEFAULTS.constantSetId,
    streamVersion: LATENT.streamVersion,
    allocationId: LATENT.allocationId,
  }),
  defaults: BM07_DEFAULTS,
  validate: validateBm07Parameters,
  constantSetIdForSettings: (settings) => String(settings.constantSetId),
  seedForSettings: (settings) => parseU64(String(settings.seed)),
  replayGridForSettings: () => ({
    baseSpacing: INFERENCE_GRID_DT,
    horizon: INFERENCE_GRID_STEPS * INFERENCE_GRID_DT,
  }),
});
