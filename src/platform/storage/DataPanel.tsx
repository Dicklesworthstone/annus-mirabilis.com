"use client";

/**
 * The "Your data on this device" management panel (am-plat-local-storage-km8f).
 * Displays all local storage namespaces, labels, estimated byte counts,
 * quarantined/recovered data, and provides export and clear operations with
 * in-page confirmation (no window.confirm).
 */

import { useCallback, useMemo, useState } from "react";
import "./dataPanel.css";
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
    <div data-testid="data-panel" className="data-panel">
      {/* Top summary & actions */}
      <div className="data-panel-summary">
        <div>
          <p className="data-panel-summary-heading">
            Total stored on this device:{" "}
            <span data-testid="total-bytes" className="data-panel-bytes">
              {formatBytes(totalBytes)}
            </span>
          </p>
          <p className="data-panel-summary-sub">
            {storedCount} {storedCount === 1 ? "namespace" : "namespaces"} with active data across{" "}
            {items.length} registered.
          </p>
        </div>

        <div className="data-panel-actions">
          <button
            type="button"
            data-testid="export-all-btn"
            onClick={handleExportAll}
            className="data-panel-btn"
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
            className="data-panel-btn data-panel-btn-danger"
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
          className="data-panel-status"
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
          className="data-panel-confirmation"
        >
          <h3 id="clear-heading" className="data-panel-confirm-title">
            Confirm Clear
          </h3>
          <p id="clear-desc" className="data-panel-confirm-desc">
            Are you sure you want to clear <strong>{confirmTarget.label}</strong>? This action
            cannot be undone.
          </p>
          <div className="data-panel-confirm-actions">
            <button
              type="button"
              data-testid="confirm-clear-btn"
              onClick={handleConfirmClear}
              className="data-panel-btn data-panel-btn-confirm"
            >
              Yes, Clear
            </button>
            <button
              type="button"
              data-testid="cancel-clear-btn"
              onClick={() => setConfirmTarget(null)}
              className="data-panel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Quarantined / Recovered Data Section */}
      {quarantineEntries.length > 0 && (
        <section data-testid="quarantine-section" className="data-panel-quarantine">
          <div className="data-panel-quarantine-header">
            <div>
              <h3 className="data-panel-quarantine-title">
                Recovered Data ({quarantineEntries.length})
              </h3>
              <p className="data-panel-quarantine-desc">
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
              className="data-panel-btn data-panel-btn-danger"
            >
              Clear Recovered Data
            </button>
          </div>

          <div className="data-panel-table-wrap">
            <table className="data-panel-table">
              <thead>
                <tr>
                  <th>Original Key</th>
                  <th>Reason</th>
                  <th>Quarantined At</th>
                  <th>Raw Value</th>
                </tr>
              </thead>
              <tbody>
                {quarantineEntries.map((q) => (
                  <tr
                    key={`${q.originalKey}:${q.quarantinedAt}`}
                    data-testid="quarantine-row"
                    className="data-panel-table-row"
                  >
                    <td>{q.originalKey}</td>
                    <td>{q.reason}</td>
                    <td>{q.quarantinedAt}</td>
                    <td>{q.rawValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Storage Namespaces List */}
      <section className="data-panel-section">
        <h3 className="data-panel-section-title">Storage Namespaces</h3>
        <div className="data-panel-table-wrap">
          <table data-testid="namespaces-table" className="data-panel-table">
            <thead>
              <tr>
                <th>Namespace</th>
                <th>Kind</th>
                <th>Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ entry, bytes, hasData }) => (
                <tr
                  key={entry.key}
                  data-testid="namespace-row"
                  data-namespace-key={entry.key}
                  className="data-panel-table-row"
                >
                  <td className="data-panel-cell-namespace">
                    <div className="data-panel-namespace-label">{entry.label}</div>
                    <div className="data-panel-namespace-key">{entry.key}</div>
                  </td>
                  <td className="data-panel-cell-kind">{entry.kind}</td>
                  <td className="data-panel-cell-size">
                    <span data-testid={`size-${entry.key}`}>{formatBytes(bytes)}</span>
                  </td>
                  <td className="data-panel-cell-actions">
                    {entry.clearable && hasData ? (
                      <button
                        type="button"
                        data-testid={`clear-btn-${entry.key}`}
                        onClick={() => setConfirmTarget({ key: entry.key, label: entry.label })}
                        className="data-panel-btn data-panel-btn-danger"
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="data-panel-dash">—</span>
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
