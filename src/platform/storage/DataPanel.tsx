"use client";

/**
 * The "Your data on this device" management panel (am-plat-local-storage-km8f).
 * Displays all local storage namespaces, labels, estimated byte counts,
 * quarantined/recovered data, and provides export and clear operations with
 * in-page confirmation (no window.confirm).
 */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import "./dataPanel.css";
import {
  clearNamespacesWithReport,
  type ExportDocument,
  exportNamespaces,
  type UnreadableNamespace,
} from "./exportClear.ts";
import type { KeyRegistration } from "./keys.ts";
import { listQuarantine, QUARANTINE_KEY } from "./quarantine.ts";
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

interface ExportCopy {
  readonly json: string;
  readonly unreadable: readonly UnreadableNamespace[];
  readonly recovery: readonly UnreadableNamespace[];
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function DataPanel({ storageContext, onExport, onClear }: DataPanelProps) {
  const ctx = useMemo(() => storageContext ?? createStorageContext(), [storageContext]);
  const instance = useId();

  const [refreshToken, setRefreshToken] = useState(0);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [exportCopy, setExportCopy] = useState<ExportCopy | null>(null);

  const refresh = useCallback(() => {
    setRefreshToken((prev) => prev + 1);
  }, []);

  // The server has no storage, so it renders every size as 0 B. Reading storage during the first
  // client render made that render disagree with the server's for any reader who had stored
  // something, and React threw away the page's markup (minified error #418 on /your-data/, BUILD
  // 12, with one setting stored). The first render now matches the server; storage is read once
  // the panel has mounted.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [items, quarantineEntries, totalBytes] = useMemo(() => {
    // Read sizes and data using the current context and refreshToken
    void refreshToken;
    const all = ctx.registry.all();
    if (!hydrated) {
      const empty: NamespaceItem[] = all.map((entry) => ({ entry, bytes: 0, hasData: false }));
      return [empty, [], 0] as const;
    }
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
  }, [ctx, refreshToken, hydrated]);

  const storedCount = items.filter((i) => i.hasData).length;

  const handleExportAll = useCallback(() => {
    const doc = exportNamespaces(ctx);
    const json = JSON.stringify(doc, null, 2);
    const unreadable = doc.unreadableNamespaces ?? [];
    const recovery = doc.recoveryCopies ?? [];
    setExportCopy({ json, unreadable, recovery });

    let downloadRequested = false;
    let url: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      const blob = new Blob([json], { type: "application/json" });
      url = URL.createObjectURL(blob);
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `annus-mirabilis-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      downloadRequested = true;
    } catch {
      // The copyable export remains available when browser downloads are restricted.
    } finally {
      try {
        anchor?.remove();
      } catch {
        // Anchor cleanup must not prevent releasing the download URL.
      }
      try {
        if (url) URL.revokeObjectURL(url);
      } catch {
        // Cleanup must not hide the copy or the outcome of the download request.
      }
    }

    const result = downloadRequested
      ? "Asked your browser to download the JSON copy. The same copy is available below."
      : "This browser could not start the download. Copy the JSON below to keep it.";
    const incomplete =
      unreadable.length > 0
        ? " Some saved data could not be read, so this export may be incomplete. The affected data is listed below."
        : "";
    const recovered =
      recovery.length > 0 ? " The export also keeps distinct in-tab recovery copies." : "";
    setStatusMessage(result + incomplete + recovered);
    onExport?.(doc);
  }, [ctx, onExport]);

  const handleConfirmClear = useCallback(() => {
    if (!confirmTarget) return;
    const keys =
      confirmTarget.key === "all"
        ? undefined
        : [confirmTarget.key === "quarantine" ? QUARANTINE_KEY : confirmTarget.key];
    const report = clearNamespacesWithReport(ctx, keys);

    if (report.failed.length > 0) {
      const labels = report.failed.map(({ key }) => ctx.registry.get(key)?.label ?? key);
      const partial = report.cleared.length > 0 ? "Clearing was only partly confirmed. " : "";
      setStatusMessage(
        `${partial}Could not confirm clearing ${labels.join(", ")}. You can retry or export the data still available below.`,
      );
    } else {
      setStatusMessage(
        report.cleared.length === 0
          ? "No clearable data was selected."
          : confirmTarget.key === "all"
            ? "Cleared the selected site data from this browser."
            : `Cleared ${confirmTarget.label}.`,
      );
      setConfirmTarget(null);
    }

    refresh();
    onClear?.(report.cleared);
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

      {exportCopy && (
        <section aria-labelledby={`${instance}-export-heading`} data-testid="data-export-copy">
          <h3 id={`${instance}-export-heading`}>Your data export</h3>
          <p>
            You can save the JSON below in a text file. It contains the data available when you
            requested this copy.
          </p>
          {exportCopy.unreadable.length > 0 && (
            <div data-testid="export-unreadable">
              <p>
                Saved data could not be read for these items. An available in-tab copy is included
                where possible. Try exporting again when browser storage is available.
              </p>
              <ul>
                {exportCopy.unreadable.map(({ key, label }) => (
                  <li key={key}>{label}</li>
                ))}
              </ul>
            </div>
          )}
          {exportCopy.recovery.length > 0 && (
            <div data-testid="export-recovery">
              <p>
                The JSON also includes in-tab recovery copies for these items alongside their saved
                versions. Keep both copies until you choose which data to restore.
              </p>
              <ul>
                {exportCopy.recovery.map(({ key, label }) => (
                  <li key={key}>{label}</li>
                ))}
              </ul>
            </div>
          )}
          <label htmlFor={`${instance}-export-json`}>Copyable JSON</label>
          <textarea
            id={`${instance}-export-json`}
            data-testid="export-json"
            rows={12}
            readOnly
            value={exportCopy.json}
            onFocus={(event) => event.currentTarget.select()}
          />
        </section>
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
