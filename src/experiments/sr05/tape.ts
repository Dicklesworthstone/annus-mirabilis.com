/**
 * SR-05's ?tape= binding (dispatch 335): content/experiments/sr-05.yaml's tapeModel
 * (sr05-moving-clocks-reference-v1, version 1), restored and shared through the general runner in
 * permalink/sessionTape.ts. The laboratory draws no random numbers, so it has no stream or allocation.
 *
 * WHY THIS ONE WAS MISSING, and why it is a ?tape= rather than a settings link of its own. SR-05 was
 * one of four laboratories with no shared-link binding, and `misc-sr-moving-clock-only` was keeping the
 * plain lab path because of it. SR-01 and BM-06, two of the other three, already read their own query
 * format on mount, so their links are minted in that format instead; SR-05 has no such module, and
 * MovingClocksLab holds no form state at all, rendering entirely from the accepted snapshot. That
 * makes the generic restore the honest fit: the settings arrive in the session and the whole lab
 * redraws from them, with nothing to keep in step.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR05_DEFAULTS } from "./definition.ts";
import { validateSr05Parameters } from "./parameters.ts";
import { createSr05Session } from "./session.ts";

export const SR05_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-05",
    mode: "sr-05:default",
    modelId: "sr05-moving-clocks-reference-v1",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: SR05_DEFAULTS,
  validate: validateSr05Parameters,
  createSession: (instanceId: string) => createSr05Session(instanceId),
});
