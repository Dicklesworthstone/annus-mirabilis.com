/**
 * SR-11's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/sr-11.yaml's tapeModel
 * (moving-mirror-host, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR11_DEFAULTS } from "./definition.ts";
import { validateSr11Parameters } from "./parameters.ts";
import { createSr11Session } from "./session.ts";

export const SR11_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-11",
    mode: "sr-11:default",
    modelId: "moving-mirror-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR11_DEFAULTS,
  validate: validateSr11Parameters,
  createSession: (instanceId: string) => createSr11Session(instanceId),
});
