/**
 * SR-06's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/sr-06.yaml's tapeModel
 * (sr-06, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR06_DEFAULTS } from "./definition.ts";
import { validateSr06Parameters } from "./parameters.ts";
import { createSr06Session } from "./session.ts";

export const SR06_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-06",
    mode: "sr-06:default",
    modelId: "sr-06",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR06_DEFAULTS,
  validate: validateSr06Parameters,
  createSession: (instanceId: string) => createSr06Session(instanceId),
});
