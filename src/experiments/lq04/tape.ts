/**
 * LQ-04's ?tape= binding (am-inst-permalink-tape-s677): content/experiments/lq-04.yaml's tapeModel
 * (lq-04, version 1), restored and shared through the general runner in permalink/sessionTape.ts.
 * The laboratory draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { LQ04_DEFAULTS } from "./definition.ts";
import { validateLq04Parameters } from "./parameters.ts";
import { createLq04Session } from "./session.ts";

export const LQ04_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "lq-04",
    mode: "lq-04:default",
    modelId: "lq-04",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: LQ04_DEFAULTS,
  validate: validateLq04Parameters,
  createSession: (instanceId: string) => createLq04Session(instanceId),
});
