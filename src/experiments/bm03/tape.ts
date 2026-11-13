/**
 * Configuration-integral recordings use the manifest's model identity and the same owner as the
 * live laboratory. The general tape runner checks their provenance and accepted settings before
 * any shared link or saved stop can change the reader's current calculation.
 */
import labDigests from "../../generated/lab-source-digests.json";
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { BM03_DEFAULTS, BM03_MODEL } from "./definition.ts";
import { validateBm03Parameters } from "./parameters.ts";
import { createBm03Session } from "./session.ts";

export const BM03_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "bm-03",
    mode: "bm-03:default",
    modelId: BM03_MODEL.id,
    modelVersion: 1,
    artifactDigest: labDigests["bm-03"].replace(/^source:/, "host:"),
    constantSetId: BM03_MODEL.constantSetId,
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: BM03_DEFAULTS,
  validate: validateBm03Parameters,
  createSession: (instanceId: string) => createBm03Session(instanceId),
});
