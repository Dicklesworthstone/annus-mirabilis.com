/**
 * SR-09's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/sr-09.yaml's tapeModel
 * (doppler-aberration-host, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR09_DEFAULTS } from "./definition.ts";
import { validateSr09Parameters } from "./parameters.ts";
import { createSr09Session } from "./session.ts";

export const SR09_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-09",
    mode: "sr-09:default",
    modelId: "doppler-aberration-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR09_DEFAULTS,
  validate: validateSr09Parameters,
  createSession: (instanceId: string) => createSr09Session(instanceId),
});
