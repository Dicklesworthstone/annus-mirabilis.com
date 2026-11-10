/** Share the accepted spreading settings and optional predictions without starting a worker. */
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { BM06_DEFAULTS, BM06_MODEL } from "./definition.ts";
import { validateBm06Parameters } from "./parameters.ts";

export const BM06_DRAFT_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "bm-06",
    mode: "bm-06:default",
    modelId: BM06_MODEL.id,
    modelVersion: 1,
    constantSetId: BM06_MODEL.constantSetId,
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: BM06_DEFAULTS,
  validate: validateBm06Parameters,
});
