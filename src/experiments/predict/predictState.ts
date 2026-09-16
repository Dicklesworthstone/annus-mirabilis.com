/**
 * The per-prompt predict-mode state machine (am-inst-predict-mode-ti7m).
 * Pure transitions only: a prompt starts `hidden` the moment its control is
 * first engaged, moves to exactly one of `predicted` / `predicted-unrecorded`
 * / `skipped`, then to `revealed` once the committed change's first accepted
 * snapshot is published, and finally `cleared` when the reader clears it.
 * Two prompts on one instance are always independent records; nothing here
 * ever touches a second prompt's record.
 */

import type { PredictionPayload } from "../tapes/schema.ts";

export type PredictPromptStateName =
  | "hidden"
  | "predicted"
  | "predicted-unrecorded"
  | "skipped"
  | "revealed"
  | "cleared";

/**
 * The four recorded-prediction forms are `PredictionPayload` from
 * `src/experiments/tapes/schema.ts` (am-rt-control-tapes-0gc's real
 * version-2 tape schema), imported rather than restated: an offered form
 * this module does not recognize fails to typecheck instead of silently
 * drifting from what the tape module can actually serialize.
 */
export type PredictionChoice = PredictionPayload;

export type AfterTheFactAmendment = Readonly<{
  choice: PredictionChoice;
  recordedAfterReveal: true;
}>;

export interface PredictPromptRecord {
  readonly promptId: string;
  readonly state: PredictPromptStateName;
  /** Set only when `state` is `predicted`, `predicted-unrecorded` (form-less), or after reveal/clear of one of those. */
  readonly choice: PredictionChoice | null;
  /** A later guess. Never replaces `choice` once the result has been shown. */
  readonly amendment: AfterTheFactAmendment | null;
}

export class PredictStateError extends Error {
  readonly promptId: string;
  readonly from: PredictPromptStateName;
  constructor(message: string, promptId: string, from: PredictPromptStateName) {
    super(message);
    this.name = "PredictStateError";
    this.promptId = promptId;
    this.from = from;
  }
}

/** A prompt has no record at all until its control is first engaged; this is that first record. */
export function beginPrompt(promptId: string): PredictPromptRecord {
  return { promptId, state: "hidden", choice: null, amendment: null };
}

function requireHidden(record: PredictPromptRecord, action: string): void {
  if (record.state !== "hidden") {
    throw new PredictStateError(
      `cannot ${action} prompt "${record.promptId}" from state "${record.state}"; it must be "hidden"`,
      record.promptId,
      record.state,
    );
  }
}

/** Records a full prediction (one of the four offered forms) and moves `hidden` -> `predicted`. */
export function submitPrediction(
  record: PredictPromptRecord,
  choice: PredictionChoice,
): PredictPromptRecord {
  requireHidden(record, "submit a prediction for");
  return { ...record, state: "predicted", choice, amendment: null };
}

/** "I have one in mind": commits to a prediction without stating it. Records no choice at all. */
export function keepToSelf(record: PredictPromptRecord): PredictPromptRecord {
  requireHidden(record, "keep a prediction to yourself for");
  return { ...record, state: "predicted-unrecorded", choice: null };
}

/** "Skip prediction": opts out entirely. */
export function skipPrediction(record: PredictPromptRecord): PredictPromptRecord {
  requireHidden(record, "skip");
  return { ...record, state: "skipped", choice: null };
}

/**
 * The first accepted snapshot after the committed change: overlays the real
 * result. Valid from any of the three post-engagement states; `predicted`
 * and `predicted-unrecorded` both reveal with the overlay, `skipped` reveals
 * the result alone. Revealing one prompt's record never touches another's.
 */
export function reveal(record: PredictPromptRecord): PredictPromptRecord {
  if (
    record.state !== "predicted" &&
    record.state !== "predicted-unrecorded" &&
    record.state !== "skipped"
  ) {
    throw new PredictStateError(
      `cannot reveal prompt "${record.promptId}" from state "${record.state}"; it must have been predicted, kept to self, or skipped first`,
      record.promptId,
      record.state,
    );
  }
  return { ...record, state: "revealed", amendment: record.amendment };
}

/**
 * Record a later guess after the result is already shown. The original
 * `choice` is left untouched. The amendment is marked `recordedAfterReveal`
 * so a reader can see it was not the commitment. Calling `submitPrediction`
 * after reveal still throws: that path is the silent revision this forbids.
 */
export function amendAfterReveal(
  record: PredictPromptRecord,
  choice: PredictionChoice,
): PredictPromptRecord {
  if (record.state !== "revealed") {
    throw new PredictStateError(
      `cannot amend prompt "${record.promptId}" from state "${record.state}"; it must be "revealed"`,
      record.promptId,
      record.state,
    );
  }
  if (record.choice === null) {
    throw new PredictStateError(
      `cannot amend prompt "${record.promptId}": nothing was recorded before the reveal`,
      record.promptId,
      record.state,
    );
  }
  return {
    ...record,
    amendment: Object.freeze({ choice, recordedAfterReveal: true as const }),
  };
}

/** The reader explicitly clears both the prediction and the result from view. */
export function clearPrompt(record: PredictPromptRecord): PredictPromptRecord {
  if (record.state !== "revealed") {
    throw new PredictStateError(
      `cannot clear prompt "${record.promptId}" from state "${record.state}"; it must be "revealed"`,
      record.promptId,
      record.state,
    );
  }
  return { ...record, state: "cleared", choice: null, amendment: null };
}

/** Re-predicting after a clear starts the prompt over, exactly like its first engagement. */
export function restartPrompt(record: PredictPromptRecord): PredictPromptRecord {
  if (record.state !== "cleared") {
    throw new PredictStateError(
      `cannot restart prompt "${record.promptId}" from state "${record.state}"; it must be "cleared"`,
      record.promptId,
      record.state,
    );
  }
  return beginPrompt(record.promptId);
}

/**
 * Whether this prompt's current or most recent prediction should be written
 * to a tape event and to storage: true only for a real, stated prediction.
 * `predicted-unrecorded` and `skipped` are never recordable, by design — the
 * "keep it to yourself" path is only honest if it is honest everywhere.
 */
export function isRecordable(record: PredictPromptRecord): boolean {
  return record.state === "predicted" || (record.state === "revealed" && record.choice !== null);
}

/**
 * A small per-instance registry of independent per-prompt records, keyed by
 * promptId. Every operation here touches exactly the named prompt.
 */
export type PredictPromptRegistry = ReadonlyMap<string, PredictPromptRecord>;

export function emptyRegistry(): PredictPromptRegistry {
  return new Map();
}

export function withPrompt(
  registry: PredictPromptRegistry,
  promptId: string,
  transform: (record: PredictPromptRecord) => PredictPromptRecord,
): PredictPromptRegistry {
  const current = registry.get(promptId) ?? beginPrompt(promptId);
  const next = new Map(registry);
  next.set(promptId, transform(current));
  return next;
}

export function promptState(
  registry: PredictPromptRegistry,
  promptId: string,
): PredictPromptRecord {
  return registry.get(promptId) ?? beginPrompt(promptId);
}
