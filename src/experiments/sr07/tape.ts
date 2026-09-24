/**
 * SR-07's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/sr-07.yaml's tapeModel
 * (sr-07, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR07_DEFAULTS } from "./definition.ts";
import { validateSr07Parameters } from "./parameters.ts";
import { createSr07Session } from "./session.ts";

export const SR07_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-07",
    mode: "sr-07:default",
    modelId: "sr-07",
    modelVersion: 1,
    constantSetId: "none",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR07_DEFAULTS,
  validate: validateSr07Parameters,
  createSession: (instanceId: string) => createSr07Session(instanceId),
});
