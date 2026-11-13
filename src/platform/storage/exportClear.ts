/**
 * Export and clear, per namespace or globally. An export is a file the reader saves; it is never
 * uploaded (AGENTS.md privacy: nothing is sent over the network). Clearing is the reader's own
 * action on their own browser and never touches this repository.
 */

import type { StorageContext } from "./store.ts";

export interface ExportedNamespace {
  readonly key: string;
  readonly label: string;
  /** Parsed JSON for a document namespace; the raw string for a setting. */
  readonly value: unknown;
}

export interface UnreadableNamespace {
  readonly key: string;
  readonly label: string;
}

export interface ExportDocument {
  readonly exportedAt: string;
  readonly namespaces: readonly ExportedNamespace[];
  /** Omitted for a complete export, preserving the existing interchange format. */
  readonly unreadableNamespaces?: readonly UnreadableNamespace[];
  /** Distinct in-tab copies retained after failed saves; saved versions remain in namespaces. */
  readonly recoveryCopies?: readonly ExportedNamespace[];
}

function exportableEntries(ctx: StorageContext, keys?: readonly string[]) {
  const entries = ctx.registry.all().filter((entry) => entry.exportable);
  if (keys === undefined) return entries;
  const requested = new Set(keys);
  return entries.filter((entry) => requested.has(entry.key));
}

function exportedValue(raw: string, kind: "document" | "setting"): unknown {
  if (kind === "document") {
    try {
      return JSON.parse(raw);
    } catch {
      // Preserve corrupt documents verbatim so the reader can recover them.
    }
  }
  return raw;
}

/** Export available copies and identify saved namespaces that could not be read. */
export function exportNamespaces(ctx: StorageContext, keys?: readonly string[]): ExportDocument {
  const namespaces: ExportedNamespace[] = [];
  const unreadableNamespaces: UnreadableNamespace[] = [];
  const recoveryCopies: ExportedNamespace[] = [];
  for (const entry of exportableEntries(ctx, keys)) {
    const key = entry.key;
    let savedRaw: string | undefined;
    let unreadable = false;
    try {
      const storage = ctx.backend();
      if (storage) savedRaw = storage.getItem(key) ?? undefined;
      else unreadable = true;
    } catch {
      unreadable = true;
    }
    if (unreadable) unreadableNamespaces.push({ key, label: entry.label });

    const recoveryRaw = ctx.fallback.get(key);
    const raw = savedRaw ?? recoveryRaw;
    if (raw !== undefined) {
      namespaces.push({ key, label: entry.label, value: exportedValue(raw, entry.kind) });
    }
    if (savedRaw !== undefined && recoveryRaw !== undefined && savedRaw !== recoveryRaw) {
      recoveryCopies.push({
        key,
        label: entry.label,
        value: exportedValue(recoveryRaw, entry.kind),
      });
    }
  }
  return {
    exportedAt: new Date().toISOString(),
    namespaces,
    ...(unreadableNamespaces.length > 0 ? { unreadableNamespaces } : {}),
    ...(recoveryCopies.length > 0 ? { recoveryCopies } : {}),
  };
}

function clearableKeys(ctx: StorageContext, keys?: readonly string[]): readonly string[] {
  const registered = ctx.registry
    .all()
    .filter((entry) => entry.clearable)
    .map((entry) => entry.key);
  if (keys === undefined) return registered;
  const registeredSet = new Set(registered);
  return [...new Set(keys.filter((key) => registeredSet.has(key)))];
}

export interface NamespaceClearFailure {
  readonly key: string;
  readonly reason: "unavailable" | "still-present";
}

export interface NamespaceClearReport {
  readonly cleared: readonly string[];
  readonly failed: readonly NamespaceClearFailure[];
}

/** Confirm removal from storage before discarding an in-tab recovery copy. */
export function clearNamespacesWithReport(
  ctx: StorageContext,
  keys?: readonly string[],
): NamespaceClearReport {
  const cleared: string[] = [];
  const failed: NamespaceClearFailure[] = [];
  for (const key of clearableKeys(ctx, keys)) {
    try {
      const storage = ctx.backend();
      if (!storage) {
        failed.push({ key, reason: "unavailable" });
        continue;
      }
      storage.removeItem(key);
      if (storage.getItem(key) !== null) {
        failed.push({ key, reason: "still-present" });
        continue;
      }
      ctx.fallback.delete(key);
      cleared.push(key);
    } catch {
      failed.push({ key, reason: "unavailable" });
    }
  }
  return { cleared, failed };
}

/** Removes only clearable namespaces and reports only those whose removal was confirmed. */
export function clearNamespaces(ctx: StorageContext, keys?: readonly string[]): readonly string[] {
  return clearNamespacesWithReport(ctx, keys).cleared;
}
