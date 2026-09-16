/**
 * The three-way predict-mode entry preference (am-inst-predict-mode-ti7m):
 * `predict-first`, `worked-example-first`, or `explore-directly`, stored at
 * `am:settings:v1:predictEntry` (registered in
 * `src/platform/storage/keys.ts`, owner `am-inst-predict-mode-ti7m`,
 * `prePaint: false`, default `predict-first`).
 *
 * A retired global boolean ("predict mode off") is migrated forward on
 * read rather than through the document `MigrationChain` mechanism,
 * because a setting has no schema-versioned document body to migrate —
 * only a single stored string, which `readSetting` treats as `"corrupt"`
 * once it fails the three-way `allowedValues` check. This module intercepts
 * the two legacy spellings before that happens.
 */

import type { StorageContext } from "../../platform/storage/store.ts";
import { readRaw, writeSetting } from "../../platform/storage/store.ts";

export const PREDICT_ENTRY_KEY = "am:settings:v1:predictEntry";

export const PREDICT_ENTRY_CHOICES = [
  "predict-first",
  "worked-example-first",
  "explore-directly",
] as const;
export type PredictEntryChoice = (typeof PREDICT_ENTRY_CHOICES)[number];

export const PREDICT_ENTRY_DEFAULT: PredictEntryChoice = "predict-first";

function isPredictEntryChoice(value: string): value is PredictEntryChoice {
  return (PREDICT_ENTRY_CHOICES as readonly string[]).includes(value);
}

export type PredictEntrySource = "global" | "instrument" | "default" | "session-fallback";

export interface ResolvedPredictEntry {
  readonly choice: PredictEntryChoice;
  readonly source: PredictEntrySource;
}

/**
 * Resolves the global choice from raw storage, migrating the retired
 * boolean spelling forward (`"true"` -> `predict-first`, `"false"` ->
 * `explore-directly`) and falling back to the default on any other corrupt
 * or absent value. A storage failure (`"unavailable"`) also falls back to
 * the default and is reported as `session-fallback` rather than `default`,
 * so a caller can tell "nobody chose yet" from "storage would not answer".
 */
export function resolveGlobalPredictEntry(ctx: StorageContext): ResolvedPredictEntry {
  const raw = readRaw(ctx, PREDICT_ENTRY_KEY);
  if (raw.status === "unavailable") {
    return { choice: PREDICT_ENTRY_DEFAULT, source: "session-fallback" };
  }
  if (raw.status !== "ok" || raw.value === undefined) {
    return { choice: PREDICT_ENTRY_DEFAULT, source: "default" };
  }
  if (raw.value === "true") return { choice: "predict-first", source: "global" };
  if (raw.value === "false") return { choice: "explore-directly", source: "global" };
  if (isPredictEntryChoice(raw.value)) return { choice: raw.value, source: "global" };
  // A value outside the three, and not one of the two retired spellings, is corrupt.
  return { choice: PREDICT_ENTRY_DEFAULT, source: "default" };
}

export function writeGlobalPredictEntry(ctx: StorageContext, choice: PredictEntryChoice) {
  return writeSetting(ctx, PREDICT_ENTRY_KEY, choice);
}

/**
 * The effective choice for one instrument: its override (from the
 * `am:predictions:v1` document) beats the global choice, which beats the
 * default. Never asserts anything about whether the override is valid;
 * that is `predictStorage.ts`'s job when it deserializes the document.
 */
export function resolveEffectivePredictEntry(
  ctx: StorageContext,
  instrumentOverride: PredictEntryChoice | undefined,
): ResolvedPredictEntry {
  if (instrumentOverride !== undefined) {
    return { choice: instrumentOverride, source: "instrument" };
  }
  return resolveGlobalPredictEntry(ctx);
}
