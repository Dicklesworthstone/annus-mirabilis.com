/**
 * Export and clear, per namespace or globally. An export is a file the reader saves; it is never
 * uploaded (AGENTS.md privacy: nothing is sent over the network). Clearing is the reader's own
 * action on their own browser and never touches this repository.
 */

import { readRaw, removeRaw, type StorageContext } from "./store.ts";

export interface ExportedNamespace {
  readonly key: string;
  readonly label: string;
  /** Parsed JSON for a document namespace; the raw string for a setting. */
  readonly value: unknown;
}

export interface ExportDocument {
  readonly exportedAt: string;
  readonly namespaces: readonly ExportedNamespace[];
}

function exportableEntries(ctx: StorageContext, keys?: readonly string[]) {
  const entries = ctx.registry.all().filter((entry) => entry.exportable);
  if (keys === undefined) return entries;
  const requested = new Set(keys);
  return entries.filter((entry) => requested.has(entry.key));
}

/** Produces valid, parseable JSON for every requested (or every exportable) namespace that has data. */
export function exportNamespaces(ctx: StorageContext, keys?: readonly string[]): ExportDocument {
  const namespaces: ExportedNamespace[] = [];
  for (const entry of exportableEntries(ctx, keys)) {
    const key = entry.key;
    const raw = readRaw(ctx, key);
    if (raw.status !== "ok" || raw.value === undefined) continue;
    let value: unknown = raw.value;
    if (entry.kind === "document") {
      try {
        value = JSON.parse(raw.value);
      } catch {
        value = raw.value; // Corrupt documents are quarantined elsewhere; export whatever is present verbatim.
      }
    }
    namespaces.push({ key, label: entry.label, value });
  }
  return { exportedAt: new Date().toISOString(), namespaces };
}

function clearableKeys(ctx: StorageContext, keys?: readonly string[]): readonly string[] {
  const registered = ctx.registry
    .all()
    .filter((entry) => entry.clearable)
    .map((entry) => entry.key);
  if (keys === undefined) return registered;
  const registeredSet = new Set(registered);
  return keys.filter((key) => registeredSet.has(key));
}

/** Removes exactly the chosen namespaces (every clearable namespace when `keys` is omitted) and reports which were cleared. */
export function clearNamespaces(ctx: StorageContext, keys?: readonly string[]): readonly string[] {
  const targets = clearableKeys(ctx, keys);
  for (const key of targets) removeRaw(ctx, key);
  return targets;
}
