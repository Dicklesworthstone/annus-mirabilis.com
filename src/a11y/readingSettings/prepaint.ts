/**
 * Applies reading-only and layout preferences to <html> before first paint
 * (am-a11y-reading-only-6wwd). Keys come from the storage registry's
 * prePaint set for this bead — no second list of key names.
 */

import { storageKeyRegistry } from "../../platform/storage/keys.ts";
import { READING_SETTINGS_OWNER } from "./schema.ts";

export type PrePaintSettingRow = Readonly<{
  key: string;
  allowed: readonly string[];
  defaultValue: string;
  dataset: string;
}>;

function suffixToDataset(suffix: string): string {
  return suffix;
}

export function readingOnlyPrePaintRows(
  registry = storageKeyRegistry,
): readonly PrePaintSettingRow[] {
  return registry
    .prePaintSettings()
    .filter((entry) => entry.ownerBeadId === READING_SETTINGS_OWNER)
    .map((entry) => ({
      key: entry.key,
      allowed: entry.allowedValues,
      defaultValue: entry.defaultValue,
      dataset: suffixToDataset(entry.key.slice("am:settings:v1:".length)),
    }));
}

export const TABLE: readonly PrePaintSettingRow[] = readingOnlyPrePaintRows();

/**
 * Sets data-reading-only, data-measure, data-type-scale, data-contrast, and
 * data-paragraph-spacing from storage (or defaults). Storage throws are ignored.
 */
export function applyReadingSettingsPrepaint(table: readonly PrePaintSettingRow[]): void {
  try {
    const root = document.documentElement;
    for (let i = 0; i < table.length; i++) {
      const row = table[i];
      if (!row) continue;
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(row.key);
      } catch {
        stored = null;
      }
      const value =
        stored !== null && row.allowed.indexOf(stored) !== -1 ? stored : row.defaultValue;
      root.dataset[row.dataset] = value;
    }
  } catch {
    /* CSS falls back to defaults when attributes are unset. */
  }
}

export const READING_SETTINGS_PREPAINT = `(${applyReadingSettingsPrepaint.toString()})(${JSON.stringify(
  TABLE,
)});`;
