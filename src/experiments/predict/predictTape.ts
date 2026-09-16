/**
 * Serializes a recorded prediction into the version-2 tape's `prediction`
 * event (am-rt-control-tapes-0gc, `src/experiments/tapes/schema.ts`) and
 * restores one back into a revealed prompt record. A `predicted-unrecorded`
 * or `skipped` prompt produces no event at all — the tape schema needs no
 * fifth payload shape and a permalink carries nothing for that prompt,
 * exactly as the reader was told.
 */

import type { PredictionPromptSpec, TapePredictionEvent } from "../tapes/schema.ts";
import { validatePredictionPayload } from "../tapes/schema.ts";
import { isRecordable, type PredictPromptRecord } from "./predictState.ts";

/**
 * Builds the tape event for one prompt's current recorded choice, or
 * `null` when there is nothing to record. Validates and quantizes the
 * payload against `spec` (the prompt's authored candidate/verbal/value ids
 * and sketch axis ranges) using the tape module's own validator, so a
 * payload this function emits is always one `validateControlTape` would
 * also accept.
 */
export function buildPredictionTapeEvent(
  record: PredictPromptRecord,
  spec: PredictionPromptSpec,
  instrumentId: string,
  actionIndex: number,
): TapePredictionEvent | null {
  if (!isRecordable(record) || record.choice === null) return null;
  const payload = validatePredictionPayload(record.choice, spec, `prediction[${record.promptId}]`);
  return { kind: "prediction", actionIndex, instrumentId, promptId: record.promptId, payload };
}

/**
 * Restores a prompt record from a replayed tape event: since the event
 * only ever exists for a real, committed prediction, the restored record
 * is already `revealed` with that prediction attached.
 */
export function restorePromptFromTapeEvent(event: TapePredictionEvent): PredictPromptRecord {
  return { promptId: event.promptId, state: "revealed", choice: event.payload };
}
