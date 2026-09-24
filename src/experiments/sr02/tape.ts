/**
 * SR-02's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/sr-02.yaml's tapeModel
 * (magnet-conductor-host, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR02_DEFAULTS } from "./definition.ts";
import { validateSr02Parameters } from "./parameters.ts";
import { createSr02Session } from "./session.ts";

export const SR02_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-02",
    mode: "sr-02:default",
    modelId: "magnet-conductor-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR02_DEFAULTS,
  validate: validateSr02Parameters,
  createSession: (instanceId: string) => createSr02Session(instanceId),
});
