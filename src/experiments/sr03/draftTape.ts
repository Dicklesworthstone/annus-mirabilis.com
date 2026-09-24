/**
 * SR-03's ?tape= binding for a worker laboratory (am-inst-permalink-tape-s677; 38999 "yes, replace"):
 * content/experiments/sr-03.yaml's tapeModel (sr-03, version 1). A shared link puts its settings in
 * the form and starts nothing; the reader applies them. The transformation draws no random numbers,
 * so the tape carries no stream.
 */
import type { DraftTapeBinding } from "../permalink/draftTape.ts";
import { SR03_DEFAULTS } from "./definition.ts";
import { validateSr03Parameters } from "./parameters.ts";

export const SR03_DRAFT_TAPE: DraftTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-03",
    mode: "sr-03:default",
    modelId: "sr-03",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  // A copy, since Sr03Parameters is an interface and so has no index signature. A custom event
  // pair's coordinates are optional and absent here; a tape carries them when they are set, and
  // settingsFromTape keeps every key a tape carries.
  defaults: { ...SR03_DEFAULTS },
  validate: validateSr03Parameters,
});
