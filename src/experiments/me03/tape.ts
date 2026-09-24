/**
 * ME-03's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/me-03.yaml's tapeModel
 * (me-03-box-1906-v1, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { ME03_DEFAULTS } from "./definition.ts";
import { validateMe03Parameters } from "./parameters.ts";
import { createMe03Session } from "./session.ts";

export const ME03_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "me-03",
    mode: "me-03:default",
    modelId: "me-03-box-1906-v1",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: ME03_DEFAULTS,
  validate: validateMe03Parameters,
  createSession: (instanceId: string) => createMe03Session(instanceId),
});
