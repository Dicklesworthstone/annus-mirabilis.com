/**
 * LQ-07's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/lq-07.yaml's tapeModel
 * (fluorescence-budget-reference, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { LQ07_DEFAULTS } from "./definition.ts";
import { validateLq07Parameters } from "./parameters.ts";
import { createLq07Session } from "./session.ts";

export const LQ07_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "lq-07",
    mode: "lq-07:default",
    modelId: "fluorescence-budget-reference",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: LQ07_DEFAULTS,
  validate: validateLq07Parameters,
  createSession: (instanceId: string) => createLq07Session(instanceId),
});
