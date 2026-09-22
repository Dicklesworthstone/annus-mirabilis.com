"use client";

import { useEffect, useId, useRef, useState } from "react";
import "./relativitySessionFiles.css";
import {
  assessRelativity,
  RELATIVITY_OUTCOMES,
  relativityMeasurement,
} from "./specialRelativityInvestigation.ts";
import {
  importRelativitySession,
  RELATIVITY_IMPORT_LIMIT,
  type RelativitySession,
  type SessionDecode,
} from "./specialRelativitySession.ts";
import {
  createRelativityImportReader,
  prepareRelativityDownload,
} from "./relativitySessionTransfer.ts";

/** Session files are an explicit local operation, not a new account or storage backend.
 * Parsing and request arbitration belong to the tested transfer/codec owners.
 */
export function RelativitySessionFileControls({
  session,
  onRestore,
  disabled = false,
}: {
  session: RelativitySession;
  onRestore: (session: RelativitySession) => void;
  disabled?: boolean;
}) {
  const instance = useId();
  const [reader] = useState(createRelativityImportReader);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<{
    imported: RelativitySession;
    original: RelativitySession;
  } | null>(null);
  const [exported, setExported] = useState<{
    text: string;
    original: RelativitySession;
  } | null>(null);
  const title = useRef<HTMLHeadingElement | null>(null);
  // Identity ties a preview to the session it would replace, even before effects run.
  const preview = pending?.original === session ? pending.imported : null;
  const exportText = exported?.original === session ? exported.text : null;

  useEffect(() => {
    reader.invalidate();
    setPending(null);
    setExported(null);
    setNotice("");
    return () => reader.invalidate();
  }, [session, reader]);

  function showResult(result: SessionDecode | null) {
    if (result === null) return;
    if (result.kind !== "session") {
      setPending(null);
      setNotice(result.kind === "invalid" ? result.message : "No investigation record found.");
      return;
    }
    setPending({ imported: result.session, original: session });
    setNotice("Valid session file. Review the replacement below; your current session has not changed.");
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setPending(null);
    setNotice("Reading the selected local file. Your current session is unchanged.");
    showResult(await reader.read(file));
  }

  function exportSession(download: boolean) {
    let objectUrl: string | null = null;
    try {
      const prepared = prepareRelativityDownload(session);
      setExported({ text: prepared.text, original: session });
      if (download) {
        objectUrl = URL.createObjectURL(new Blob([prepared.text], { type: prepared.mediaType }));
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = prepared.filename;
        document.body.appendChild(link);
        try {
          link.click();
        } finally {
          link.remove();
        }
      }
      setNotice("Prepared a PRIVATE session including your note and predictions. Nothing was uploaded. The JSON below can also be copied.");
    } catch {
      setNotice("The download could not be started. Your session is unchanged; copy the prepared JSON below when available.");
    } finally {
      if (objectUrl) {
        const issued = objectUrl;
        setTimeout(() => URL.revokeObjectURL(issued), 1000);
      }
    }
  }

  function validatePaste() {
    reader.invalidate();
    showResult(importRelativitySession(input));
  }

  function cancelImport() {
    reader.invalidate();
    setPending(null);
    setNotice("Import cancelled. Your current session is unchanged.");
  }

  function restore() {
    if (!preview) return;
    reader.invalidate();
    setPending(null);
    setInput("");
    // The confirmation control disappears after restoration. Keep keyboard focus
    // on a stable, named element rather than dropping it onto the page body.
    title.current?.focus();
    onRestore(preview);
  }

  return (
    <section aria-labelledby={`${instance}-title`} data-sr-session-files>
      <h3 id={`${instance}-title`} tabIndex={-1} ref={title}>Save and reopen a private investigation</h3>
      <p>
        A private file keeps the card order, selected example, every recorded prediction and your
        note. Public links exclude the note and predictions. Export before leaving this page;
        no automatic storage or upload is used.
      </p>
      <fieldset disabled={disabled}>
        <legend>Export the current session</legend>
        <div className="actions">
          <button type="button" onClick={() => exportSession(true)}>Download private session JSON</button>
          <button type="button" onClick={() => exportSession(false)}>Show copyable private JSON</button>
        </div>
        {exportText !== null && (
          <div>
            <label htmlFor={`${instance}-export`}>Private JSON — includes your note and predictions</label>
            <textarea
              id={`${instance}-export`}
              rows={8}
              readOnly
              value={exportText}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        )}
      </fieldset>
      <details>
        <summary>Import a saved session from this device</summary>
        <p>
          Validation does not change your work. Review the imported note before explicitly
          replacing the current session. Unknown versions, malformed records and oversized files
          are rejected rather than repaired into apparently valid arguments.
        </p>
        <fieldset disabled={disabled}>
          <legend>Read and validate a private session</legend>
          <label htmlFor={`${instance}-file`}>Select a session JSON file</label>
          <input
            id={`${instance}-file`}
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void readFile(file);
            }}
          />
          <label htmlFor={`${instance}-input`}>Or paste session JSON</label>
          <textarea
            id={`${instance}-input`}
            rows={6}
            maxLength={RELATIVITY_IMPORT_LIMIT}
            value={input}
            onChange={(event) => {
              reader.invalidate();
              setPending(null);
              setNotice("");
              setInput(event.currentTarget.value);
            }}
          />
          <div className="actions">
            <button type="button" onClick={validatePaste}>Validate pasted JSON without replacing my session</button>
            <button type="button" onClick={cancelImport}>Cancel import</button>
          </div>
          {preview && (
            <section className="notice" data-sr-import-preview aria-label="Import replacement preview">
              <p>
                Replacement: {preview.order.length} cards; {relativityMeasurement(preview.measurement).title};
                {" "}{Object.keys(preview.predictions).length} recorded predictions.
              </p>
              <p>{RELATIVITY_OUTCOMES[assessRelativity(preview.order).outcome]}</p>
              <label htmlFor={`${instance}-incoming-note`}>The imported note that would replace yours</label>
              <textarea id={`${instance}-incoming-note`} rows={5} readOnly value={preview.note} />
              <p>The entire current session, including its note and predictions, will be replaced.</p>
              <button type="button" onClick={restore}>Replace current session with this import</button>
            </section>
          )}
        </fieldset>
      </details>
      <p role="status" aria-atomic="true" data-sr-transfer-notice>{notice}</p>
    </section>
  );
}
