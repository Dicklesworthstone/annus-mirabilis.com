import labDigests from "../../generated/lab-source-digests.json";
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { SR01_DEFAULTS } from "./definition.ts";
import { validateSr01Parameters } from "./parameters.ts";
import { createSr01Session } from "./session.ts";

/** Source and output verification for a clock-synchronization checkpoint retained by the reader. */
export const SR01_TAPE: LabTapeBinding = Object.freeze({
  environment: Object.freeze({
    experimentId: "sr-01",
    mode: "sr-01:default",
    modelId: "sr-01-clock-sync-host",
    modelVersion: 1,
    artifactDigest: labDigests["sr-01"].replace(/^source:/, "host:"),
    constantSetId: "modern-si-2019",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  }),
  defaults: { ...SR01_DEFAULTS },
  validate: validateSr01Parameters,
  createSession: (instanceId: string) => createSr01Session(instanceId),
});
