/**
 * SR-10's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/sr-10.yaml's tapeModel
 * (light-complex-host, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR10_DEFAULTS } from "./definition.ts";
import { validateSr10Parameters } from "./parameters.ts";
import { createSr10Session } from "./session.ts";

export const SR10_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-10",
    mode: "sr-10:default",
    modelId: "light-complex-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR10_DEFAULTS,
  validate: validateSr10Parameters,
  createSession: (instanceId: string) => createSr10Session(instanceId),
});
