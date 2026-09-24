/**
 * SR-12's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/sr-12.yaml's tapeModel
 * (charge-current-host, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR12_DEFAULTS } from "./definition.ts";
import { validateSr12Parameters } from "./parameters.ts";
import { createSr12Session } from "./session.ts";

export const SR12_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-12",
    mode: "sr-12:default",
    modelId: "charge-current-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR12_DEFAULTS,
  validate: validateSr12Parameters,
  createSession: (instanceId: string) => createSr12Session(instanceId),
});
