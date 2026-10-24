/**
 * NO CALLER, BECAUSE EVERY AUTHORED PROMPT IS A CANDIDATE CHOICE (am-50bk triage, 2026-10-24).
 * Predictions DO reach a shared link; they just do not come through here.
 *
 * `usePredictGate` in `src/components/lab/PredictGate.tsx` builds the share tape's prediction
 * events inline, and it pushes one only for `r.choice?.form === "candidate"`. That filter looks
 * like a silent drop of the other three forms, and it is not: `GeneratedPredictPrompt` in
 * `src/generated/predict-prompts.ts` has no `form` field at all, and all 44 authored prompts are
 * candidate choices. `withPredictions` then adds them to `LabTapeLinkState.shareTape`, and
 * `permalink/fromControlTape.ts` reads candidate and sketch events back out, refusing a named form
 * with a typed refusal and a repair.
 *
 * What this module adds over that inline loop is the part no content needs yet: it validates any
 * recordable form against the prompt's authored `PredictionPromptSpec` via
 * `validatePredictionPayload`, so a sketch or values prediction would serialize correctly and
 * quantized. The day a prompt is authored with a sketch or a values answer, this is the function to
 * call rather than widening that loop.
 *
 * Note that the two layers use two different `TapePredictionEvent` types -- this one from
 * `../tapes/schema.ts` (with `kind` and `actionIndex`), PredictGate's from
 * `../../experiments/permalink/types.ts` (without) -- which is part of why they never joined.
 * `ControlTapeRecorder` is likewise constructed only by `scripts/e2e-runtime-contracts.ts` and
 * tests; the reader's tapes are the per-lab `permalink/draftTape.ts` and `permalink/sessionTape.ts`
 * bindings. Owners: am-inst-predict-mode-ti7m, am-rt-control-tapes-0gc. Kept under RULE 1.
 *
 * ---- as authored ----
 *
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
  return { promptId: event.promptId, state: "revealed", choice: event.payload, amendment: null };
}
