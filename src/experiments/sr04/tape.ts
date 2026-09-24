/**
 * SR-04's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/sr-04.yaml's tapeModel
 * (sr-04, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR04_DEFAULTS } from "./definition.ts";
import { validateSr04Parameters } from "./parameters.ts";
import { createSr04Session } from "./session.ts";

export const SR04_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-04",
    mode: "sr-04:default",
    modelId: "sr-04",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR04_DEFAULTS,
  validate: validateSr04Parameters,
  createSession: (instanceId: string) => createSr04Session(instanceId),
});
