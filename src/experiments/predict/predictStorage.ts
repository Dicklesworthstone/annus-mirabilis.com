/**
 * The `am:predictions:v1` document (am-inst-predict-mode-ti7m), registered
 * in `src/platform/storage/keys.ts` (owner `am-inst-predict-mode-ti7m`,
 * `schemaVersion: 1`). Holds, per instrument and prompt: whether the reader
 * has visited before (for the first-visit default), the recorded
 * prediction itself (only for a real, stated prediction), and a lightweight
 * status marker for `predicted-unrecorded`/`skipped` prompts so the export
 * preview can say truthfully "kept to yourself, not recorded" — without
 * that marker ever holding the guessed content. Per-instrument entry
 * overrides live in the same document, next to the predictions they scope.
 */

import { createMigrationChain } from "../../platform/storage/migrations.ts";
import type { StorageContext } from "../../platform/storage/store.ts";
import { readDocument, writeDocument } from "../../platform/storage/store.ts";
import type { PredictEntryChoice } from "./predictEntry.ts";
import type { PredictionChoice } from "./predictState.ts";

// `PredictionChoice` (predictState.ts) is `PredictionPayload` from
// src/experiments/tapes/schema.ts, imported there rather than restated;
// this module inherits it transitively so the stored shape and the tape
// event shape can never drift apart.

export const PREDICTIONS_NAMESPACE = "am:predictions:v1";

export type PredictPromptStatus = "predicted" | "predicted-unrecorded" | "skipped";

export interface StoredPromptEntry {
  readonly status: PredictPromptStatus;
  /** Present only when `status === "predicted"`. */
  readonly prediction?: PredictionChoice;
}

export interface PredictionsDocumentV1 {
  readonly schemaVersion: 1;
  readonly visited: Readonly<Record<string, Readonly<Record<string, boolean>>>>;
  readonly prompts: Readonly<Record<string, Readonly<Record<string, StoredPromptEntry>>>>;
  readonly entryOverrides: Readonly<Record<string, PredictEntryChoice>>;
}

export function emptyPredictionsDocument(): PredictionsDocumentV1 {
  return { schemaVersion: 1, visited: {}, prompts: {}, entryOverrides: {} };
}

const MIGRATION_CHAIN = createMigrationChain(1, {});

/** A missing or unavailable document reads as empty; a corrupt one is quarantined and also reads as empty. */
export function readPredictionsDocument(ctx: StorageContext): PredictionsDocumentV1 {
  const result = readDocument<PredictionsDocumentV1>(ctx, PREDICTIONS_NAMESPACE, MIGRATION_CHAIN);
  return result.status === "ok" && result.value !== undefined
    ? result.value
    : emptyPredictionsDocument();
}

export function writePredictionsDocument(ctx: StorageContext, doc: PredictionsDocumentV1) {
  return writeDocument(ctx, PREDICTIONS_NAMESPACE, doc);
}

function withNestedEntry<V>(
  table: Readonly<Record<string, Readonly<Record<string, V>>>>,
  outerKey: string,
  innerKey: string,
  value: V,
): Readonly<Record<string, Readonly<Record<string, V>>>> {
  const inner = { ...(table[outerKey] ?? {}), [innerKey]: value };
  return { ...table, [outerKey]: inner };
}

export function hasVisited(
  doc: PredictionsDocumentV1,
  instrumentId: string,
  promptId: string,
): boolean {
  return doc.visited[instrumentId]?.[promptId] === true;
}

export function markVisited(
  doc: PredictionsDocumentV1,
  instrumentId: string,
  promptId: string,
): PredictionsDocumentV1 {
  return { ...doc, visited: withNestedEntry(doc.visited, instrumentId, promptId, true) };
}

/** Records a real, stated prediction. Never call this for `predicted-unrecorded` or `skipped`. */
export function recordPrediction(
  doc: PredictionsDocumentV1,
  instrumentId: string,
  promptId: string,
  prediction: PredictionChoice,
): PredictionsDocumentV1 {
  return {
    ...doc,
    prompts: withNestedEntry(doc.prompts, instrumentId, promptId, {
      status: "predicted",
      prediction,
    }),
  };
}

/** Records that a prompt was kept to self or skipped, with no prediction content at all. */
export function recordUnrecordedStatus(
  doc: PredictionsDocumentV1,
  instrumentId: string,
  promptId: string,
  status: "predicted-unrecorded" | "skipped",
): PredictionsDocumentV1 {
  return { ...doc, prompts: withNestedEntry(doc.prompts, instrumentId, promptId, { status }) };
}

export function clearPrediction(
  doc: PredictionsDocumentV1,
  instrumentId: string,
  promptId: string,
): PredictionsDocumentV1 {
  const forInstrument = doc.prompts[instrumentId];
  if (!forInstrument || !(promptId in forInstrument)) return doc;
  const { [promptId]: _removed, ...rest } = forInstrument;
  return { ...doc, prompts: { ...doc.prompts, [instrumentId]: rest } };
}

export function getStoredPrompt(
  doc: PredictionsDocumentV1,
  instrumentId: string,
  promptId: string,
): StoredPromptEntry | undefined {
  return doc.prompts[instrumentId]?.[promptId];
}

export function setEntryOverride(
  doc: PredictionsDocumentV1,
  instrumentId: string,
  choice: PredictEntryChoice,
): PredictionsDocumentV1 {
  return { ...doc, entryOverrides: { ...doc.entryOverrides, [instrumentId]: choice } };
}

/** Clearing the override restores the global choice (predictEntry.ts resolves that fallback). */
export function clearEntryOverride(
  doc: PredictionsDocumentV1,
  instrumentId: string,
): PredictionsDocumentV1 {
  const { [instrumentId]: _removed, ...rest } = doc.entryOverrides;
  return { ...doc, entryOverrides: rest };
}

export function getEntryOverride(
  doc: PredictionsDocumentV1,
  instrumentId: string,
): PredictEntryChoice | undefined {
  return doc.entryOverrides[instrumentId];
}

// ---------------------------------------------------------------------------
// Export preview: one line per stored prompt, rendered from the document
// alone plus the manifest text needed to label it (question, candidate
// label) — never from a second copy of the predictions.
// ---------------------------------------------------------------------------

export interface ExportPreviewCandidateLookup {
  readonly question: string;
  readonly candidateLabelById: Readonly<Record<string, string>>;
}

export interface ExportPreviewLine {
  readonly instrumentId: string;
  readonly promptId: string;
  readonly question: string;
  /** A human-readable summary of the choice, or the honest "not recorded" line. */
  readonly summary: string;
}

function summarizeChoice(
  choice: PredictionChoice,
  candidateLabelById: Readonly<Record<string, string>>,
): string {
  if (choice.form === "candidate")
    return candidateLabelById[choice.candidateId] ?? choice.candidateId;
  if (choice.form === "verbal") return `${choice.directionId}, ${choice.shapeId}`;
  if (choice.form === "values")
    return choice.targets.map((t) => `${t.targetId}=${t.value}`).join(", ");
  return `sketch (${choice.points.length} point${choice.points.length === 1 ? "" : "s"})`;
}

/**
 * `lookups` supplies, per instrument+prompt, the question text and
 * candidate labels needed to render a readable line; a prompt with no
 * lookup entry is skipped rather than guessed at.
 */
export function exportPreviewLines(
  doc: PredictionsDocumentV1,
  lookups: Readonly<Record<string, Readonly<Record<string, ExportPreviewCandidateLookup>>>>,
): readonly ExportPreviewLine[] {
  const lines: ExportPreviewLine[] = [];
  for (const [instrumentId, prompts] of Object.entries(doc.prompts)) {
    for (const [promptId, entry] of Object.entries(prompts)) {
      const lookup = lookups[instrumentId]?.[promptId];
      if (!lookup) continue;
      const summary =
        entry.status === "predicted" && entry.prediction
          ? summarizeChoice(entry.prediction, lookup.candidateLabelById)
          : "kept to yourself, not recorded";
      lines.push({ instrumentId, promptId, question: lookup.question, summary });
    }
  }
  return lines;
}

/** Removes every prompt entry belonging to predictions, for "leave predictions out" of an export. */
export function withoutPredictions(doc: PredictionsDocumentV1): PredictionsDocumentV1 {
  return { ...doc, prompts: {} };
}
