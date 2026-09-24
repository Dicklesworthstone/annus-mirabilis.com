/**
 * LQ-06's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/lq-06.yaml's tapeModel
 * (lq-06-coefficient-match, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { LQ06_DEFAULTS } from "./definition.ts";
import { validateLq06Parameters } from "./parameters.ts";
import { createLq06Session } from "./session.ts";

export const LQ06_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "lq-06",
    mode: "lq-06:default",
    modelId: "lq-06-coefficient-match",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: LQ06_DEFAULTS,
  validate: validateLq06Parameters,
  createSession: (instanceId: string) => createLq06Session(instanceId),
});
