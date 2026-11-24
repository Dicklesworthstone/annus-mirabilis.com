"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createKitchenBrowserChannel } from "../../../experiments/bm07/kitchen/browser.ts";
import { exportKitchenCsv } from "../../../experiments/bm07/kitchen/csv.ts";
import {
  KITCHEN_OPTIONS,
  type KitchenOptions,
} from "../../../experiments/bm07/kitchen/definition.ts";
import { kitchenAnalysisJson } from "../../../experiments/bm07/kitchen/export.ts";
import {
  keepKitchen,
  readKeptKitchen,
  removeKeptKitchen,
} from "../../../experiments/bm07/kitchen/kitchenStorage.ts";
import { KITCHEN_LIMITS, type KitchenDocument } from "../../../experiments/bm07/kitchen/schema.ts";
import { createKitchenSession } from "../../../experiments/bm07/kitchen/session.ts";
import {
  captureKitchenSession,
  KITCHEN_SESSION_FILE_BYTES,
  type KitchenSavedSession,
  type KitchenSessionPreview,
  kitchenSessionJson,
  prepareKitchenSession,
  readKitchenSessionFile,
} from "../../../experiments/bm07/kitchen/sessionFile.ts";
import { useLaboratoryVisibility } from "../../../experiments/lifecycle/useLaboratoryVisibility.ts";
import { createStorageContext } from "../../../platform/storage/store.ts";
import { display, identity } from "../presentation.ts";
import {
  KitchenAnalysisControls,
  KitchenInputs,
  KitchenObservationTable,
} from "./KitchenControls.tsx";
import { KitchenResults } from "./KitchenResults.tsx";
import { VideoTracker } from "./VideoTracker.tsx";

export type KitchenPractice = Readonly<{ csv: string; sourceDigest: string }>;
function savedTrackLabel(track: string): string {
  if (!track) return "First particle track in the file";
  try {
    const value: unknown = JSON.parse(track);
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === "string" &&
      Number.isSafeInteger(value[1]) &&
      value[1] >= 0
    ) return value[1] === 0 ? value[0] : value[0] + " · new object " + (value[1] + 1);
  } catch {
    // The owner will refuse an unsupported track identity when analysis is requested.
  }
  return track;
}
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
  const region = useLaboratoryVisibility(session);
  const state = useSyncExternalStore(
      session.subscribe,
      session.getSnapshot,
      session.getServerSnapshot,
    ),
    accepted = state.accepted;
  const [ready, setReady] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [sessionFile, setSessionFile] = useState<File | null>(null),
    [incoming, setIncoming] = useState<KitchenSessionPreview | null>(null),
    [saving, setSaving] = useState(false),
    [paste, setPaste] = useState(""),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false),
    [confirmClear, setConfirmClear] = useState(false),
    [captureEpoch, setCaptureEpoch] = useState(0);
  // Observations are kept on this device only when the reader asks (am-bm-07-kitchen-mode-mays).
  const [storage] = useState(() => createStorageContext()),
    [kept, setKept] = useState<KitchenSavedSession | undefined>(undefined),
    [keptNote, setKeptNote] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    sessionFileInput = useRef<HTMLInputElement>(null),
    fileGeneration = useRef(0),
    saveGeneration = useRef(0),
    lifetime = useRef(0),
    mounted = useRef(false),
    downloads = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    setReady(true);
    setKept(readKeptKitchen(storage));
    return () => {
      mounted.current = false;
      fileGeneration.current++;
      saveGeneration.current++;
      lifetime.current++;
      session.disconnect();
      downloads.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      downloads.current.clear();
    };
  }, [session, storage]);
  const busy = reading || state.preparing || state.view.pending;
  function catchError(error: unknown) {
    setError(
      error instanceof Error ? error.message : "The local observations could not be processed.",
    );
  }
  function dismissPreview() {
    fileGeneration.current++;
    setReading(false);
    setIncoming(null);
  }
  async function load(csv: string, options: KitchenOptions = KITCHEN_OPTIONS) {
    dismissPreview();
    setError("");
    await session.submit(csv, options);
  }
  async function preparePreview(prepare: () => Promise<KitchenSessionPreview>) {
    const ticket = ++fileGeneration.current;
    setReading(true);
    setIncoming(null);
    setError("");
    try {
      const preview = await prepare();
      if (ticket === fileGeneration.current) setIncoming(preview);
    } catch (error) {
      if (ticket === fileGeneration.current) catchError(error);
    } finally {
      if (ticket === fileGeneration.current) setReading(false);
    }
  }
  async function importSessionFile() {
    const selected = sessionFile;
    if (!selected) return;
    if (selected.size > KITCHEN_SESSION_FILE_BYTES) {
      setError("Choose a saved session no larger than 2.2 MB. The accepted observations are unchanged.");
      return;
    }
    await preparePreview(async () =>
      readKitchenSessionFile(await selected.text(), practice.sourceDigest),
    );
  }
  function confirmSession() {
    if (!incoming) return;
    const selected = incoming.session;
    setKeptNote(incoming.notice);
    void load(selected.csv, selected.options).catch(catchError);
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
    dismissPreview();
    setError("");
    void session.reanalyze(options).catch(catchError);
  }
  function revise(document: KitchenDocument) {
    dismissPreview();
    setError("");
    try {
      void session.revise(document).catch(catchError);
    } catch (error) {
      catchError(error);
    }
  }
  async function download(kind: "csv" | "json" | "session") {
    if (!accepted) return;
    const generation = lifetime.current;
    try {
      const text =
        kind === "csv"
          ? exportKitchenCsv(accepted.document)
          : kind === "json"
            ? kitchenAnalysisJson(accepted, practice.sourceDigest)
            : kitchenSessionJson(await captureKitchenSession(accepted, practice.sourceDigest));
      if (!mounted.current || generation !== lifetime.current) return;
      const url = URL.createObjectURL(
        new Blob([text], {
          type: kind === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
        }),
      );
      downloads.current.add(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = kind === "csv"
        ? "local-observations.csv"
        : kind === "json"
          ? "local-observation-analysis.json"
          : "local-observation-session.json";
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        downloads.current.delete(url);
      }, 1000);
    } catch (error) {
      if (mounted.current && generation === lifetime.current) catchError(error);
    }
  }
  async function keep() {
    if (!accepted) return;
    const ticket = ++saveGeneration.current;
    setSaving(true);
    setError("");
    try {
      const saved = await captureKitchenSession(accepted, practice.sourceDigest);
      if (!mounted.current || ticket !== saveGeneration.current) return;
      const written = keepKitchen(storage, saved);
      setKept(saved);
      if (written.status === "ok") {
        setKeptNote(
          `Kept ${saved.rows} observation rows and their accepted analysis choices on this device. Preview them here later or export a resumable session file.`,
        );
      } else {
        setKeptNote(
          written.status === "quota"
            ? "This browser's storage is full. The saved session remains in this open page. Export a resumable session file before leaving."
            : "This browser is not keeping site data. The saved session remains in this open page. Export a resumable session file before leaving.",
        );
      }
    } catch (error) {
      if (mounted.current && ticket === saveGeneration.current) catchError(error);
    } finally {
      if (mounted.current && ticket === saveGeneration.current) setSaving(false);
    }
  }
  function restoreKept() {
    const saved = kept;
    if (!saved) return;
    setKeptNote("");
    void preparePreview(() => prepareKitchenSession(saved, practice.sourceDigest));
  }
  function removeKept() {
    saveGeneration.current++;
    setSaving(false);
    dismissPreview();
    removeKeptKitchen(storage);
    setKept(undefined);
    setKeptNote("Removed the kitchen session kept on this device.");
  }
  function stop() {
    dismissPreview();
    session.stop();
  }
  function clear() {
    stop();
    saveGeneration.current++;
    lifetime.current++;
    setSaving(false);
    session.clear();
    setCaptureEpoch((n) => n + 1);
    setFile(null);
    setSessionFile(null);
    if (fileInput.current) fileInput.current.value = "";
    if (sessionFileInput.current) sessionFileInput.current.value = "";
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
      ref={region}
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
      {kept && !accepted && (
        <div className="notice">
          <p>
            A kept copy contains {kept.rows} observation rows. Preview its analysis choices before
            calculating, or remove the copy.
          </p>
          <div className="actions">
            <button type="button" disabled={!ready || busy} onClick={restoreKept}>
              Preview kept session
            </button>
            <button type="button" className="secondary" onClick={removeKept}>
              Remove kept session
            </button>
          </div>
        </div>
      )}
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
              dismissPreview();
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
        <details>
          <summary>Open a saved kitchen session</summary>
          <p>
            A session file contains observations, calibration, analysis choices and evaluator
            identity. Opening it shows a preview. Confirmation calculates fresh results locally.
          </p>
          <div className="input-field">
            <label htmlFor={`${id}-session-file`}>Saved session JSON</label>
            <input
              ref={sessionFileInput}
              id={`${id}-session-file`}
              type="file"
              accept=".json,application/json"
              disabled={!ready || busy}
              onChange={(event) => {
                dismissPreview();
                setSessionFile(event.target.files?.[0] ?? null);
                setError("");
              }}
            />
          </div>
          <button
            type="button"
            disabled={!ready || busy || !sessionFile}
            onClick={() => void importSessionFile()}
          >
            Preview selected session
          </button>
          <p className="fine">Session files: at most 2.2 MB. Video and decoded frames are never saved.</p>
        </details>
      </div>
      {incoming && (
        <section
          className="notice"
          data-kitchen-session-preview={incoming.compatibility}
          aria-labelledby={`${id}-session-preview`}
        >
          <h3 id={`${id}-session-preview`}>Review the saved analysis</h3>
          <p>{incoming.notice}</p>
          <dl>
            <dt>Observation rows</dt>
            <dd>{incoming.session.rows}</dd>
            <dt>Particle track</dt>
            <dd>{savedTrackLabel(incoming.session.options.track)}</dd>
            <dt>Coordinate</dt>
            <dd>{incoming.session.options.axis}</dd>
            <dt>Target coverage</dt>
            <dd>{display(incoming.session.options.coverage, 100)}%</dd>
            <dt>Gas-constant source</dt>
            <dd>
              {incoming.session.options.constantSet === "metadata"
                ? "Use the observation file's declaration"
                : incoming.session.options.constantSet === "modern-si-2019"
                  ? "Modern SI: consistency check"
                  : "Measured from gases"}
            </dd>
          </dl>
          {incoming.session.origin && (
            <details>
              <summary>Recorded model and observation identities</summary>
              <p>Model: <code>{incoming.session.origin.modelVersion}</code>.</p>
              <p>Evaluator: <code>{incoming.session.origin.sourceDigest}</code>.</p>
              <p>Original file: <code>{incoming.session.origin.sourceId}</code>.</p>
              <p>Accepted observations: <code>{incoming.session.origin.documentDigest}</code>.</p>
            </details>
          )}
          <p>
            The observations stay on this device. Current accepted results remain visible until
            the new calculation succeeds. The file supplies no numerical results to trust.
          </p>
          <div className="actions">
            <button type="button" disabled={!ready || busy} onClick={confirmSession}>
              Analyze saved session
            </button>
            <button type="button" className="secondary" onClick={dismissPreview}>
              Keep current analysis
            </button>
          </div>
        </section>
      )}
      <p className="fine">
        CSV limit: 2 MiB and 20,000 rows. To capture coordinates from your own video, use the
        tracker at the end of this laboratory. Nothing is saved automatically: export the
        observations and a resumable session, or keep the accepted session on this device, before
        closing or reloading the page.
      </p>
      <p className="status-line" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </p>
      {keptNote && (
        <p className="status-line" role="status" aria-live="polite">
          {keptNote}
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {accepted && (
        <>
          <div className="actions kitchen-export">
            <button type="button" className="secondary" onClick={() => void download("csv")}>
              Export accepted observations
            </button>
            <button type="button" className="secondary" onClick={() => void download("json")}>
              Export accepted analysis
            </button>
            <button type="button" className="secondary" onClick={() => void download("session")}>
              Export resumable session
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => reanalyze(accepted.report.options)}
            >
              Reanalyze accepted observations
            </button>
            <button type="button" className="secondary" disabled={saving} onClick={() => void keep()}>
              Keep accepted session on this device
            </button>
            {kept && (
              <>
                <button type="button" className="secondary" disabled={!ready || busy} onClick={restoreKept}>
                  Preview kept session
                </button>
                <button type="button" className="secondary" onClick={removeKept}>
                  Remove the kept copy
                </button>
              </>
            )}
            <button type="button" className="secondary" onClick={() => setConfirmClear(true)}>
              Clear local observations
            </button>
          </div>
          {confirmClear && (
            <div className="notice">
              <p>
                Clear observations and drafts, including unsaved video annotations, from this
                laboratory? This stops its worker and releases its video. Downloaded files, a copy
                kept on this device, and the other laboratory are not deleted.
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
              An identity hash records content, not whether an observation is true. The analysis
              export records the calculated results. Use “Export resumable session” to keep the
              observations and choices for a later calculation.
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
