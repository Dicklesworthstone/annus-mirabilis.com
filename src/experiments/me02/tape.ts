/**
 * ME-02's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/me-02.yaml's tapeModel
 * (mass-energy-coefficient-host, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { ME02_DEFAULTS } from "./definition.ts";
import { validateMe02Parameters } from "./parameters.ts";
import { createMe02Session } from "./session.ts";

export const ME02_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "me-02",
    mode: "me-02:default",
    modelId: "mass-energy-coefficient-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: ME02_DEFAULTS,
  validate: validateMe02Parameters,
  createSession: (instanceId: string) => createMe02Session(instanceId),
});
