/**
 * Corrupt or unmigratable document data is never silently discarded. It is preserved under
 * `am:quarantine:v1` with its original key, raw value, and reason, so the "Your data on this
 * device" panel can show it as recovered data the reader can export or clear. When quarantine
 * itself is full, the caller keeps working in memory rather than losing the new data or evicting
 * an older entry the reader has not seen yet.
 */

import { readRaw, type StorageContext, writeRaw } from "./store.ts";

export const QUARANTINE_KEY = "am:quarantine:v1";
export const QUARANTINE_MAX_ENTRIES = 50;

export interface QuarantineEntry {
  readonly originalKey: string;
  readonly rawValue: string;
  readonly reason: string;
  readonly quarantinedAt: string;
}

interface QuarantineDocument {
  readonly schemaVersion: 1;
  readonly entries: readonly QuarantineEntry[];
}

function isQuarantineDocument(value: unknown): value is QuarantineDocument {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1 &&
    Array.isArray((value as { entries?: unknown }).entries)
  );
}

function readQuarantineDocument(ctx: StorageContext): QuarantineDocument {
  const raw = readRaw(ctx, QUARANTINE_KEY);
  if (raw.status !== "ok" || raw.value === undefined) return { schemaVersion: 1, entries: [] };
  try {
    const parsed: unknown = JSON.parse(raw.value);
    if (isQuarantineDocument(parsed)) return parsed;
  } catch {
    // The quarantine document itself is corrupt; start fresh rather than quarantine-of-quarantine.
  }
  return { schemaVersion: 1, entries: [] };
}

export interface QuarantineOutcome {
  readonly quarantined: boolean;
  readonly full: boolean;
}

/** Adds one entry, or reports `full` without discarding anything if the cap is reached. */
export function quarantine(
  ctx: StorageContext,
  originalKey: string,
  rawValue: string,
  reason: string,
): QuarantineOutcome {
  const current = readQuarantineDocument(ctx);
  if (current.entries.length >= QUARANTINE_MAX_ENTRIES) return { quarantined: false, full: true };
  const next: QuarantineDocument = {
    schemaVersion: 1,
    entries: [
      ...current.entries,
      { originalKey, rawValue, reason, quarantinedAt: new Date().toISOString() },
    ],
  };
  writeRaw(ctx, QUARANTINE_KEY, JSON.stringify(next));
  return { quarantined: true, full: false };
}

export function listQuarantine(ctx: StorageContext): readonly QuarantineEntry[] {
  return readQuarantineDocument(ctx).entries;
}

export function isQuarantineFull(ctx: StorageContext): boolean {
  return readQuarantineDocument(ctx).entries.length >= QUARANTINE_MAX_ENTRIES;
}

export function clearQuarantine(ctx: StorageContext): void {
  writeRaw(
    ctx,
    QUARANTINE_KEY,
    JSON.stringify({ schemaVersion: 1, entries: [] } satisfies QuarantineDocument),
  );
}
