/**
 * ME-01's ?tape= binding (am-2rl9): content/experiments/me-01.yaml's tapeModel
 * (mass-energy-two-ledgers-host, version 1), restored and shared through the general runner in
 * permalink/sessionTape.ts.
 *
 * ME-01 was the one instrument named in AGENTS.md's teaching-tape list with neither a tape nor a
 * binding: "the two pulses" is this laboratory, "opposite pulses and two ledgers". The
 * transformation draws no random numbers, so the seed is 0 and there is no stream or allocation.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { ME01_DEFAULTS } from "./definition.ts";
import { validateMe01Parameters } from "./parameters.ts";
import { createMe01Session } from "./session.ts";

export const ME01_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "me-01",
    mode: "me-01:default",
    modelId: "mass-energy-two-ledgers-host",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: ME01_DEFAULTS,
  validate: validateMe01Parameters,
  createSession: (instanceId: string) => createMe01Session(instanceId),
});
