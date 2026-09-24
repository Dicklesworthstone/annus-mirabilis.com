/**
 * LQ-05's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/lq-05.yaml's tapeModel
 * (lq05-independent-configurations-v1, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { LQ05_DEFAULTS } from "./definition.ts";
import { validateLq05Parameters } from "./parameters.ts";
import { createLq05Session } from "./session.ts";

export const LQ05_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "lq-05",
    mode: "lq-05:default",
    modelId: "lq05-independent-configurations-v1",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: LQ05_DEFAULTS,
  validate: validateLq05Parameters,
  createSession: (instanceId: string) => createLq05Session(instanceId),
});
