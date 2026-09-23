"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createKitchenBrowserChannel } from "../../../experiments/bm07/kitchen/browser.ts";
import { exportKitchenCsv } from "../../../experiments/bm07/kitchen/csv.ts";
import {
  KITCHEN_OPTIONS,
  type KitchenOptions,
} from "../../../experiments/bm07/kitchen/definition.ts";
import { kitchenAnalysisJson } from "../../../experiments/bm07/kitchen/export.ts";
import { KITCHEN_LIMITS, type KitchenDocument } from "../../../experiments/bm07/kitchen/schema.ts";
import { createKitchenSession } from "../../../experiments/bm07/kitchen/session.ts";
import { identity } from "../presentation.ts";
import {
  KitchenAnalysisControls,
  KitchenInputs,
  KitchenObservationTable,
} from "./KitchenControls.tsx";
import { KitchenResults } from "./KitchenResults.tsx";
import { VideoTracker } from "./VideoTracker.tsx";

export type KitchenPractice = Readonly<{ csv: string; sourceDigest: string }>;
export function KitchenLab({
  practice,
  title = "Your observations, kept on this device",
}: {
  practice: KitchenPractice;
  title?: string;
}) {
  const id = useId(),
    [session] = useState(() =>
      createKitchenSession(`kitchen-${id}`, createKitchenBrowserChannel, practice.sourceDigest),
    );
  const state = useSyncExternalStore(
      session.subscribe,
      session.getSnapshot,
      session.getServerSnapshot,
    ),
    accepted = state.accepted;
  const [ready, setReady] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [paste, setPaste] = useState(""),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false),
    [confirmClear, setConfirmClear] = useState(false),
    [captureEpoch, setCaptureEpoch] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null),
    fileGeneration = useRef(0),
    downloads = useRef(new Set<string>());
  useEffect(() => {
    setReady(true);
    return () => {
      fileGeneration.current++;
      session.disconnect();
      downloads.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      downloads.current.clear();
    };
  }, [session]);
  const busy = reading || state.preparing || state.view.pending;
  function catchError(error: unknown) {
    setError(
      error instanceof Error ? error.message : "The local observations could not be processed.",
    );
  }
  async function load(csv: string) {
    setError("");
    await session.submit(csv, KITCHEN_OPTIONS);
  }
  async function importFile() {
    const selected = file;
    if (!selected) {
      setError("Choose an observation CSV first, or use the paste field.");
      return;
    }
    const ticket = ++fileGeneration.current;
    if (selected.size > KITCHEN_LIMITS.bytes) {
      setError(
        "The CSV exceeds 2 MiB. Split it into smaller observation files; accepted data are unchanged.",
      );
      return;
    }
    setReading(true);
    setError("");
    try {
      const text = await selected.text();
      if (ticket === fileGeneration.current) await load(text);
    } catch (error) {
      if (ticket === fileGeneration.current) catchError(error);
    } finally {
      if (ticket === fileGeneration.current) setReading(false);
    }
  }
  function reanalyze(options: KitchenOptions) {
    setError("");
    void session.reanalyze(options).catch(catchError);
  }
  function revise(document: KitchenDocument) {
    setError("");
    try {
      void session.revise(document).catch(catchError);
    } catch (error) {
      catchError(error);
    }
  }
  function download(kind: "csv" | "json") {
    if (!accepted) return;
    try {
      const text =
        kind === "csv"
          ? exportKitchenCsv(accepted.document)
          : kitchenAnalysisJson(accepted, practice.sourceDigest);
      const url = URL.createObjectURL(
        new Blob([text], {
          type: kind === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
        }),
      );
      downloads.current.add(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = kind === "csv" ? "local-observations.csv" : "local-observation-analysis.json";
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        downloads.current.delete(url);
      }, 1000);
    } catch (error) {
      catchError(error);
    }
  }
  function stop() {
    fileGeneration.current++;
    setReading(false);
    session.stop();
  }
  function clear() {
    stop();
    session.clear();
    setCaptureEpoch((n) => n + 1);
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setPaste("");
    setError("");
    setConfirmClear(false);
  }
  const status = busy
    ? "Reading or analyzing locally. Any displayed results still describe the last accepted observations."
    : state.message ||
      (!accepted
        ? "No observation file is loaded. No worker has started."
        : "Analysis accepted. Plots, tables and exports describe the same observations and inputs.");
  return (
    <section
      className="laboratory kitchen-lab"
      data-instrument-id="bm-07-kitchen"
      {...(accepted ? identity(accepted.snapshot) : { "data-instance-id": `kitchen-${id}` })}
      data-pending={String(busy)}
      data-document-digest={accepted?.documentDigest ?? ""}
      aria-labelledby={`${id}-title`}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Local observations</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{accepted ? "Local host calculation" : "No data loaded"}</span>
      </header>
      <p>
        Import a classroom CSV, or try the synthetic practice track. Everything stays in this page:
        nothing is sent to a server or put in a share link.
      </p>
      <noscript>
        <p className="notice">
          Local analysis requires JavaScript. The guide, schema, practice CSV and worksheet below
          remain available without it.
        </p>
      </noscript>
      <div className="kitchen-import">
        <div className="input-field">
          <label htmlFor={`${id}-file`}>Observation CSV</label>
          <input
            ref={fileInput}
            id={`${id}-file`}
            type="file"
            accept=".csv,text/csv"
            disabled={!ready || busy}
            onChange={(e) => {
              fileGeneration.current++;
              setFile(e.target.files?.[0] ?? null);
              setError("");
            }}
          />
        </div>
        <div className="actions">
          <button
            type="button"
            disabled={!ready || busy || !file}
            onClick={() => void importFile()}
          >
            Import selected CSV
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!ready || busy}
            onClick={() => {
              fileGeneration.current++;
              void load(practice.csv).catch(catchError);
            }}
          >
            Analyze synthetic practice data
          </button>
          <button type="button" className="secondary" disabled={!busy} onClick={stop}>
            Stop local analysis
          </button>
        </div>
        <details>
          <summary>Paste an observation CSV instead</summary>
          <div className="input-field">
            <label htmlFor={`${id}-paste`}>CSV text</label>
            <textarea
              id={`${id}-paste`}
              spellCheck={false}
              rows={8}
              value={paste}
              maxLength={KITCHEN_LIMITS.bytes}
              onChange={(e) => setPaste(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={!ready || busy || !paste.trim()}
            onClick={() => {
              fileGeneration.current++;
              void load(paste).catch(catchError);
            }}
          >
            Import pasted CSV
          </button>
        </details>
      </div>
      <p className="fine">
        CSV limit: 2 MiB and 20,000 rows. To capture coordinates from your own video, use the
        tracker at the end of this laboratory. Nothing is saved automatically: export observations
        before closing or reloading the page.
      </p>
      <p className="status-line" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {accepted && (
        <>
          <div className="actions kitchen-export">
            <button type="button" className="secondary" onClick={() => download("csv")}>
              Export accepted observations
            </button>
            <button type="button" className="secondary" onClick={() => download("json")}>
              Export accepted analysis
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => reanalyze(accepted.report.options)}
            >
              Reanalyze accepted observations
            </button>
            <button type="button" className="secondary" onClick={() => setConfirmClear(true)}>
              Clear local observations
            </button>
          </div>
          {confirmClear && (
            <div className="notice">
              <p>
                Clear observations and drafts, including unsaved video annotations, from this
                laboratory? This stops its worker and releases its video. Downloaded files and the
                other laboratory are not deleted.
              </p>
              <button type="button" onClick={clear}>
                Confirm clear this laboratory
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmClear(false)}>
                Keep observations
              </button>
            </div>
          )}
          <div className="lab-columns">
            <div key={`${accepted.documentDigest}:${accepted.snapshot.snapshotVersion}`}>
              <KitchenAnalysisControls
                accepted={accepted}
                busy={busy}
                reanalyze={reanalyze}
                onError={setError}
              />
              <KitchenInputs accepted={accepted} busy={busy} revise={revise} onError={setError} />
            </div>
            <KitchenResults accepted={accepted} />
          </div>
          <KitchenObservationTable
            key={accepted.documentDigest}
            accepted={accepted}
            busy={busy}
            revise={revise}
            onError={setError}
          />
          <details className="kitchen-provenance">
            <summary>Accepted identity and complete declarations</summary>
            <p>
              Original file identity: <code>{accepted.sourceId}</code>. Accepted document identity:{" "}
              <code>{accepted.documentDigest}</code>. Source: <code>{practice.sourceDigest}</code>.
            </p>
            <p>
              Run {accepted.snapshot.runId}; snapshot {accepted.snapshot.snapshotVersion}. An
              identity hash records content, not whether an observation is true. Exported JSON
              records this analysis but is not a resumable session file.
            </p>
            <dl>
              {Object.entries(accepted.document.metadata).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value || "Not declared"}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
      {/* Last, not first: the tracker is about 3,900px tall on a phone, and above the import it put
          the one-click practice analysis five screens down. Its result appears in the status line
          and the analysis above. */}
      <VideoTracker key={captureEpoch} disabled={!ready || busy} onAnalyze={load} />
    </section>
  );
}
export function KitchenComparison({ practice }: { practice: KitchenPractice }) {
  const [second, setSecond] = useState(false);
  return (
    <>
      <div id="local-video">
        <KitchenLab practice={practice} />
      </div>
      <div className="comparison-toggle">
        <button type="button" className="secondary" onClick={() => setSecond(!second)}>
          {second
            ? "Close second observation laboratory"
            : "Open a separate observation laboratory"}
        </button>
        <p>
          Two placements do not share files, drafts, workers or accepted results. Closing a
          placement discards its in-memory session.
        </p>
      </div>
      {second && <KitchenLab practice={practice} title="A separate observation record" />}
    </>
  );
}
