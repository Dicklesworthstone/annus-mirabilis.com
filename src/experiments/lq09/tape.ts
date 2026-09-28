/**
 * LQ-09's ?tape= binding (dispatch 335): content/experiments/lq-09.yaml's tapeModel
 * (lq09-ionization-reference-v1, version 1), restored and shared through the general runner in
 * permalink/sessionTape.ts. The laboratory draws no random numbers, so it has no stream or allocation.
 *
 * WHY THIS ONE WAS MISSING, and why it is a ?tape= although the laboratory has a settings codec of its
 * own. src/experiments/lq09/permalink.ts holds an `encodeLq09Settings` / `decodeLq09Settings` pair, and
 * measured 2026-09-28 NOTHING read either one: no component, no route, not even a test. So unlike SR-01
 * and BM-06, whose components do call their own decoders on mount, LQ-09 had a format nobody honoured,
 * and wiring a second mechanism into the page would have left two codecs where one is needed. The
 * generic restore is the one the other 26 laboratories use, and it is what the ionization-bounds
 * teaching tape needed: that tape was the only one of the 22 with no settings link, reported as
 * `no-binding` in tape-links.json.
 *
 * The unread pair is left where it is rather than removed, and it is reported: deleting it is not mine
 * to decide, and `carriesTapeLink` inside its decoder shows it was written to stand aside for exactly
 * this mechanism.
 */
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { LQ09_DEFAULTS } from "./definition.ts";
import { validateLq09Parameters } from "./parameters.ts";
import { createLq09Session } from "./session.ts";

export const LQ09_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "lq-09",
    mode: "lq-09:default",
    modelId: "lq09-ionization-reference-v1",
    modelVersion: 1,
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: LQ09_DEFAULTS,
  validate: validateLq09Parameters,
  createSession: (instanceId: string) => createLq09Session(instanceId),
});
