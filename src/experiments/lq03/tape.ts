/**
 * LQ-03's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/lq-03.yaml's tapeModel
 * (lq-03, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { LQ03_DEFAULTS } from "./definition.ts";
import { validateLq03Parameters } from "./parameters.ts";
import { createLq03Session } from "./session.ts";

export const LQ03_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "lq-03",
    mode: "lq-03:default",
    modelId: "lq-03",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: LQ03_DEFAULTS,
  validate: validateLq03Parameters,
  createSession: (instanceId: string) => createLq03Session(instanceId),
});
