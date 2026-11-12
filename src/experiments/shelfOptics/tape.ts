import labDigests from "../../generated/lab-source-digests.json";
import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { createReaderCheckpointBinding } from "../store/readerCheckpoint.ts";
import { parseShelfParameters, SHELF_DEFINITIONS, type ShelfId } from "./definition.ts";
import { evaluateShelfOptics } from "./evaluation.ts";
import { createShelfOpticsSession } from "./session.ts";

/** Each optical comparison records its existing instrument identity and complete source closure. */
function binding(id: ShelfId): LabTapeBinding {
  const defaults = SHELF_DEFINITIONS[id].defaults;
  return Object.freeze({
    environment: Object.freeze({
      experimentId: id,
      mode: `${id}:default`,
      modelId: id,
      modelVersion: 1,
      artifactDigest: labDigests[id].replace(/^source:/, "host:"),
      constantSetId: "modern-si-2019",
      streamVersion: "deterministic",
      allocationId: "deterministic",
    }),
    defaults,
    validate(input: unknown) {
      const parsed = parseShelfParameters(id, input);
      return parsed.kind === "parameters"
        ? { kind: "accepted", data: parsed.parameters }
        : { kind: "refused", refusal: { details: { requirements: parsed.message } } };
    },
    createSession: (instanceId: string) =>
      createShelfOpticsSession(instanceId, evaluateShelfOptics(defaults)),
  });
}

export const MICHELSON_MORLEY_TAPE = binding("shelf-michelson-morley");
export const FIZEAU_TAPE = binding("shelf-fizeau");
export const MAXWELL_GALILEAN_TAPE = binding("shelf-maxwell-galilean");

export const SHELF_TAPES = Object.freeze({
  "shelf-michelson-morley": MICHELSON_MORLEY_TAPE,
  "shelf-fizeau": FIZEAU_TAPE,
  "shelf-maxwell-galilean": MAXWELL_GALILEAN_TAPE,
});

export const SHELF_READER_CHECKPOINTS = Object.freeze({
  "shelf-michelson-morley": createReaderCheckpointBinding(MICHELSON_MORLEY_TAPE),
  "shelf-fizeau": createReaderCheckpointBinding(FIZEAU_TAPE),
  "shelf-maxwell-galilean": createReaderCheckpointBinding(MAXWELL_GALILEAN_TAPE),
});
