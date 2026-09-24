/**
 * SR-13's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/sr-13.yaml's tapeModel
 * (electron-dynamics-host, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR13_DEFAULTS } from "./definition.ts";
import { validateSr13Parameters } from "./parameters.ts";
import { createSr13Session } from "./session.ts";

export const SR13_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-13",
    mode: "sr-13:default",
    modelId: "electron-dynamics-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR13_DEFAULTS,
  validate: validateSr13Parameters,
  createSession: (instanceId: string) => createSr13Session(instanceId),
});
