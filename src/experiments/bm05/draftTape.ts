/**
 * BM-05's ?tape= binding for a worker laboratory (am-inst-permalink-tape-s677; 38999 "yes, replace"):
 * content/experiments/bm-05.yaml's tapeModel (bm05-host-preview-v1, version 1). A shared link puts its settings in
 * the form and starts nothing; the reader applies them. The header names the walkers' stream, bm-05.walk.v1 at stream version 1
 * (experiments/streams/allocation.ts); the trial's own seed travels in the settings.
 */
import { BM05_SOURCE_DIGEST } from "../../generated/bm05-provenance.ts";
import { parseU64 } from "../identity/u64.ts";
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
    artifactDigest: BM05_SOURCE_DIGEST.replace(/^source:/, "host:"),
    constantSetId: "not-applicable",
    streamVersion: BM05_ALLOCATION.streamVersion,
    allocationId: BM05_ALLOCATION.allocationId,
  }),
  defaults: BM05_DEFAULTS,
  validate: validateBm05Parameters,
  seedForSettings: (settings) => parseU64(settings.seed),
  replayGridForSettings: (settings) => ({
    baseSpacing: Number(settings.tau),
    horizon: Number(settings.runSteps) * Number(settings.tau),
  }),
});
