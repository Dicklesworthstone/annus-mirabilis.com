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
    setStatusMessage("Downloaded a copy of everything this site keeps in your browser.");
  }, [ctx, onExport]);

  const handleConfirmClear = useCallback(() => {
    if (!confirmTarget) return;

    if (confirmTarget.key === "all") {
      const cleared = clearNamespaces(ctx);
      if (onClear) onClear(cleared);
      setStatusMessage("Cleared everything this site kept in your browser.");
    } else if (confirmTarget.key === "quarantine") {
      clearQuarantine(ctx);
      setStatusMessage("Cleared the data this site could not read.");
    } else {
      const cleared = clearNamespaces(ctx, [confirmTarget.key]);
      if (onClear) onClear(cleared);
      setStatusMessage(`Cleared ${confirmTarget.label}.`);
    }

    setConfirmTarget(null);
    refresh();
  }, [confirmTarget, ctx, onClear, refresh]);

  const kindLabel = (kind: string) => (kind === "setting" ? "A setting" : "Saved work");

  return (
    <div data-testid="data-panel" className="data-panel">
      {/* What is stored, in one sentence, and the two actions that apply to all of it. */}
      <div className="data-panel-summary">
        <div>
          <p className="data-panel-summary-heading">
            Stored in this browser for this site:{" "}
            <span data-testid="total-bytes" className="data-panel-bytes">
              {formatBytes(totalBytes)}
            </span>
          </p>
          <p className="data-panel-summary-sub">
            {storedCount === 0
              ? "Nothing yet. Settings you change and notes you save will appear below."
              : `${storedCount} of the ${items.length} kinds of data listed below.`}
          </p>
        </div>

        <div className="data-panel-actions">
          <button
            type="button"
            data-testid="export-all-btn"
            onClick={handleExportAll}
            className="data-panel-btn"
          >
            Download all of it (JSON)
          </button>
          <button
            type="button"
            data-testid="clear-all-btn"
            disabled={totalBytes === 0 && quarantineEntries.length === 0}
            onClick={() =>
              setConfirmTarget({ key: "all", label: "everything this site keeps in your browser" })
            }
            className="data-panel-btn data-panel-btn-danger"
          >
            Clear all of it
          </button>
        </div>
      </div>

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

      {/* An in-page confirmation, never window.confirm: it sits where the reader is looking. */}
      {confirmTarget && (
        <div
          role="alertdialog"
          aria-labelledby="clear-heading"
          aria-describedby="clear-desc"
          data-testid="clear-confirmation"
          className="data-panel-confirmation"
        >
          <h3 id="clear-heading" className="data-panel-confirm-title">
            Clear {confirmTarget.label}?
          </h3>
          <p id="clear-desc" className="data-panel-confirm-desc">
            This removes it from this browser and cannot be undone. Download a copy first if you
            want to keep it.
          </p>
          <div className="data-panel-confirm-actions">
            <button
              type="button"
              data-testid="confirm-clear-btn"
              onClick={handleConfirmClear}
              className="data-panel-btn data-panel-btn-confirm"
            >
              Clear it
            </button>
            <button
              type="button"
              data-testid="cancel-clear-btn"
              onClick={() => setConfirmTarget(null)}
              className="data-panel-btn"
            >
              Keep it
            </button>
          </div>
        </div>
      )}

      {quarantineEntries.length > 0 && (
        <section data-testid="quarantine-section" className="data-panel-quarantine">
          <div className="data-panel-quarantine-header">
            <div>
              <h3 className="data-panel-quarantine-title">
                Data this site could not read ({quarantineEntries.length})
              </h3>
              <p className="data-panel-quarantine-desc">
                These were damaged, or written by a different version of the site, so they were set
                aside instead of used. You can inspect, export or clear them.
              </p>
            </div>
            <button
              type="button"
              data-testid="clear-quarantine-btn"
              onClick={() =>
                setConfirmTarget({ key: "quarantine", label: "the data this site could not read" })
              }
              className="data-panel-btn data-panel-btn-danger"
            >
              Clear these
            </button>
          </div>

          <div className="data-panel-table-wrap">
            <table className="data-panel-table">
              <thead>
                <tr>
                  <th>Stored under</th>
                  <th>Why it was set aside</th>
                  <th>When</th>
                  <th>What was stored</th>
                </tr>
              </thead>
              <tbody>
                {quarantineEntries.map((q) => (
                  <tr key={`${q.originalKey}:${q.quarantinedAt}`} data-testid="quarantine-row">
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

      {/*
        One row per kind of data, as a list rather than a four-column table: the table carried
        each entry's storage key ("am:settings:v1:theme") under its name and ran past the right
        edge of a 390px screen. The key stays on the row as a data attribute for tests and tools.
      */}
      <section aria-labelledby="data-panel-kinds">
        <h3 className="data-panel-section-title" id="data-panel-kinds">
          What this site can keep in your browser
        </h3>
        <ul data-testid="namespaces-table" className="data-panel-list">
          {items.map(({ entry, bytes, hasData }) => (
            <li
              key={entry.key}
              data-testid="namespace-row"
              data-namespace-key={entry.key}
              className={hasData ? "data-panel-item has-data" : "data-panel-item"}
            >
              <span className="data-panel-item-name">{entry.label}</span>
              <span className="data-panel-item-facts">
                {kindLabel(entry.kind)} ·{" "}
                <span data-testid={`size-${entry.key}`}>{formatBytes(bytes)}</span>
              </span>
              {entry.clearable && hasData && (
                <button
                  type="button"
                  data-testid={`clear-btn-${entry.key}`}
                  onClick={() => setConfirmTarget({ key: entry.key, label: entry.label })}
                  className="data-panel-btn data-panel-btn-danger"
                  aria-label={`Clear ${entry.label}`}
                >
                  Clear
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
