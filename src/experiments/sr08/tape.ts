/**
 * SR-08's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/sr-08.yaml's tapeModel
 * (field-frame-change-host, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR08_DEFAULTS } from "./definition.ts";
import { validateSr08Parameters } from "./parameters.ts";
import { createSr08Session } from "./session.ts";

export const SR08_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-08",
    mode: "sr-08:default",
    modelId: "field-frame-change-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR08_DEFAULTS,
  validate: validateSr08Parameters,
  createSession: (instanceId: string) => createSr08Session(instanceId),
});
