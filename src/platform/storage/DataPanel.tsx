"use client";

/**
 * The "Your data on this device" management panel (am-plat-local-storage-km8f).
 * Displays all local storage namespaces, labels, estimated byte counts,
 * quarantined/recovered data, and provides export and clear operations with
 * in-page confirmation (no window.confirm).
 */

import { useCallback, useMemo, useState } from "react";
import { clearNamespaces, type ExportDocument, exportNamespaces } from "./exportClear.ts";
import type { KeyRegistration } from "./keys.ts";
import { clearQuarantine, listQuarantine } from "./quarantine.ts";
import { estimateNamespaceSize } from "./size.ts";
import { createStorageContext, type StorageContext } from "./store.ts";

export interface DataPanelProps {
  readonly storageContext?: StorageContext;
  readonly onExport?: (document: ExportDocument) => void;
  readonly onClear?: (clearedKeys: readonly string[]) => void;
}

interface NamespaceItem {
  readonly entry: KeyRegistration;
  readonly bytes: number;
  readonly hasData: boolean;
}

interface ConfirmTarget {
  readonly key: string | "all" | "quarantine";
  readonly label: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function DataPanel({ storageContext, onExport, onClear }: DataPanelProps) {
  const ctx = useMemo(() => storageContext ?? createStorageContext(), [storageContext]);

  const [refreshToken, setRefreshToken] = useState(0);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRefreshToken((prev) => prev + 1);
  }, []);

  const [items, quarantineEntries, totalBytes] = useMemo(() => {
    // Read sizes and data using the current context and refreshToken
    void refreshToken;
    const all = ctx.registry.all();
    let total = 0;
    const calculated: NamespaceItem[] = [];

    for (const entry of all) {
      const size = estimateNamespaceSize(ctx, entry.key);
      total += size.bytes;
      calculated.push({
        entry,
        bytes: size.bytes,
        hasData: size.bytes > 0,
      });
    }

    const q = listQuarantine(ctx);
    return [calculated, q, total] as const;
  }, [ctx, refreshToken]);

  const storedCount = items.filter((i) => i.hasData).length;

  const handleExportAll = useCallback(() => {
    const doc = exportNamespaces(ctx);
    if (onExport) {
      onExport(doc);
    }
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      try {
        const json = JSON.stringify(doc, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `annus-mirabilis-data-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // In restricted environments, ignore DOM click failures
      }
    }
    setStatusMessage("Data exported successfully.");
  }, [ctx, onExport]);

  const handleConfirmClear = useCallback(() => {
    if (!confirmTarget) return;

    if (confirmTarget.key === "all") {
      const cleared = clearNamespaces(ctx);
      if (onClear) onClear(cleared);
      setStatusMessage(`Cleared all data (${cleared.length} namespaces).`);
    } else if (confirmTarget.key === "quarantine") {
      clearQuarantine(ctx);
      setStatusMessage("Cleared recovered (quarantined) data.");
    } else {
      const cleared = clearNamespaces(ctx, [confirmTarget.key]);
      if (onClear) onClear(cleared);
      setStatusMessage(`Cleared ${confirmTarget.label}.`);
    }

    setConfirmTarget(null);
    refresh();
  }, [confirmTarget, ctx, onClear, refresh]);

  return (
    <div data-testid="data-panel" className="space-y-6">
      {/* Top summary & actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Total stored on this device:{" "}
            <span data-testid="total-bytes" className="font-mono font-bold">
              {formatBytes(totalBytes)}
            </span>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {storedCount} {storedCount === 1 ? "namespace" : "namespaces"} with active data across{" "}
            {items.length} registered.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="export-all-btn"
            onClick={handleExportAll}
            className="px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Export All Data (JSON)
          </button>
          <button
            type="button"
            data-testid="clear-all-btn"
            disabled={totalBytes === 0 && quarantineEntries.length === 0}
            onClick={() =>
              setConfirmTarget({ key: "all", label: "all local reading data and settings" })
            }
            className="px-3 py-1.5 text-sm font-medium rounded border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All Data
          </button>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          data-testid="status-message"
          className="p-3 text-sm rounded bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-900"
        >
          {statusMessage}
        </div>
      )}

      {/* In-page confirmation modal/banner (no window.confirm) */}
      {confirmTarget && (
        <div
          role="alertdialog"
          aria-labelledby="clear-heading"
          aria-describedby="clear-desc"
          data-testid="clear-confirmation"
          className="p-4 rounded border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100"
        >
          <h3 id="clear-heading" className="font-semibold text-base">
            Confirm Clear
          </h3>
          <p id="clear-desc" className="text-sm mt-1">
            Are you sure you want to clear <strong>{confirmTarget.label}</strong>? This action
            cannot be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              data-testid="confirm-clear-btn"
              onClick={handleConfirmClear}
              className="px-3 py-1 text-sm font-medium rounded bg-red-700 text-white hover:bg-red-800"
            >
              Yes, Clear
            </button>
            <button
              type="button"
              data-testid="cancel-clear-btn"
              onClick={() => setConfirmTarget(null)}
              className="px-3 py-1 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Quarantined / Recovered Data Section */}
      {quarantineEntries.length > 0 && (
        <section
          data-testid="quarantine-section"
          className="p-4 border rounded border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                Recovered Data ({quarantineEntries.length})
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Data quarantined due to corrupt formatting or unknown version. You can inspect,
                export, or clear it.
              </p>
            </div>
            <button
              type="button"
              data-testid="clear-quarantine-btn"
              onClick={() =>
                setConfirmTarget({ key: "quarantine", label: "all recovered (quarantined) data" })
              }
              className="px-2.5 py-1 text-xs font-medium rounded border border-amber-400 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 hover:bg-amber-200"
            >
              Clear Recovered Data
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                  <th className="py-1 px-2 font-medium">Original Key</th>
                  <th className="py-1 px-2 font-medium">Reason</th>
                  <th className="py-1 px-2 font-medium">Quarantined At</th>
                  <th className="py-1 px-2 font-medium">Raw Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200 dark:divide-amber-800 font-mono">
                {quarantineEntries.map((q) => (
                  <tr key={`${q.originalKey}:${q.quarantinedAt}`} data-testid="quarantine-row">
                    <td className="py-1 px-2">{q.originalKey}</td>
                    <td className="py-1 px-2">{q.reason}</td>
                    <td className="py-1 px-2 text-slate-500">{q.quarantinedAt}</td>
                    <td className="py-1 px-2 truncate max-w-xs">{q.rawValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Storage Namespaces List */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Storage Namespaces
        </h3>
        <div className="overflow-x-auto">
          <table
            data-testid="namespaces-table"
            className="w-full text-left text-sm border-collapse"
          >
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs uppercase">
                <th className="py-2 px-3 font-semibold">Namespace</th>
                <th className="py-2 px-3 font-semibold">Kind</th>
                <th className="py-2 px-3 font-semibold">Size</th>
                <th className="py-2 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {items.map(({ entry, bytes, hasData }) => (
                <tr
                  key={entry.key}
                  data-testid="namespace-row"
                  data-namespace-key={entry.key}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                >
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {entry.label}
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm">
                      {entry.key}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-400 capitalize">
                    {entry.kind}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                    <span data-testid={`size-${entry.key}`}>{formatBytes(bytes)}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {entry.clearable && hasData ? (
                      <button
                        type="button"
                        data-testid={`clear-btn-${entry.key}`}
                        onClick={() => setConfirmTarget({ key: entry.key, label: entry.label })}
                        className="px-2 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
