"use client";

import { useEffect, useId, useRef, useState } from "react";
import { type DiscoveryNotebook, decodeNotebook, NOTE_FILE_LIMIT } from "../notebook.ts";
import { useDiscoveryNotebook, useNotebookView } from "./context.tsx";
import { notebookHtml } from "./files.ts";
import { NOTE_PAPER_TITLES } from "./manifest.ts";

export function DiscoveryNotebookControls() {
  const notebook = useDiscoveryNotebook();
  if (!notebook) return null;
  return <NotebookControls notebook={notebook} />;
}

type ImportPreview = Readonly<{
  document: DiscoveryNotebook;
  original: DiscoveryNotebook;
  raw: string;
  token: number;
  draftSequence: number;
}>;

function NotebookControls({
  notebook,
}: {
  notebook: NonNullable<ReturnType<typeof useDiscoveryNotebook>>;
}) {
  const { session, manifest, draftSequence, draftVersion } = notebook;
  const view = useNotebookView(session);
  const instance = useId();
  const heading = useRef<HTMLElement | null>(null);
  const request = useRef(0);
  const downloads = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [notice, setNotice] = useState("");
  const [paste, setPaste] = useState("");
  const [pending, setPending] = useState<ImportPreview | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exported, setExported] = useState<{ text: string; original: DiscoveryNotebook } | null>(
    null,
  );
  const preview =
    pending?.original === view.document && pending.draftSequence === draftSequence && !view.blocked
      ? pending
      : null;
  const copyable = exported?.original === view.document ? exported.text : null;

  useEffect(() => {
    const urls = downloads.current;
    return () => {
      request.current += 1;
      session.invalidateImport();
      for (const [url, timer] of urls) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, [session]);

  function cancelImport() {
    request.current += 1;
    session.invalidateImport();
    setPending(null);
    setNotice("Import cancelled. Your recorded notes are unchanged.");
  }

  function validate(raw: string, token: number, original: DiscoveryNotebook, sequence: number) {
    try {
      const document = decodeNotebook(raw, manifest);
      setPending({ document, original, raw, token, draftSequence: sequence });
      setConfirmClear(false);
      setNotice(
        "File checked. Review its recorded notes below before replacing this guide’s notes.",
      );
    } catch (error) {
      setPending(null);
      session.invalidateImport();
      setNotice(
        error instanceof Error
          ? error.message
          : "This file could not be read. Your notes are unchanged.",
      );
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    const currentRequest = ++request.current;
    const token = session.beginImport();
    const original = session.getSnapshot().document;
    const sequence = draftVersion.current;
    setPending(null);
    setNotice("Reading the selected file on this device. Your notes are unchanged.");
    function current() {
      return (
        request.current === currentRequest &&
        original === session.getSnapshot().document &&
        sequence === draftVersion.current &&
        !session.getSnapshot().blocked
      );
    }
    if (file.size > NOTE_FILE_LIMIT) {
      if (current()) {
        session.invalidateImport();
        setNotice("The notes file is too large. Your recorded notes are unchanged.");
      }
      return;
    }
    try {
      const raw = await file.text();
      if (current()) validate(raw, token, original, sequence);
    } catch {
      if (current()) {
        session.invalidateImport();
        setNotice("The selected file could not be read. Your recorded notes are unchanged.");
      }
    }
  }

  function replaceWithPreview() {
    if (!preview) return;
    request.current += 1;
    const accepted = session.completeImport(preview.token, preview.raw);
    setPending(null);
    if (accepted) setPaste("");
    setNotice(session.getSnapshot().message);
    heading.current?.focus();
  }

  function download(text: string, extension: string, mediaType: string) {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([text], { type: mediaType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${manifest.paper}-discovery-notes.${extension}`;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      const issued = url;
      downloads.current.set(
        issued,
        setTimeout(() => {
          URL.revokeObjectURL(issued);
          downloads.current.delete(issued);
        }, 1000),
      );
      setNotice("Prepared a private notes file on this device. Nothing was uploaded.");
    } catch {
      if (url) URL.revokeObjectURL(url);
      setNotice("The download could not start. Copy the notes text below to keep it.");
    }
  }

  function exportNotes(printable: boolean, copyOnly = false) {
    const json = session.exportNotes();
    setExported({ text: json, original: view.document });
    if (copyOnly) {
      setNotice(
        "The JSON below contains your recorded predictions and observations. Draft fields are not included.",
      );
      return;
    }
    download(
      printable ? notebookHtml(view.document, manifest) : json,
      printable ? "html" : "json",
      printable ? "text/html;charset=utf-8" : "application/json",
    );
  }

  return (
    <section
      className="discovery-notebook-controls"
      id={`discovery-notes-${manifest.paper}`}
      aria-label={`${NOTE_PAPER_TITLES[manifest.paper]} notes controls`}
    >
      <p>{view.message}</p>
      {view.ready && !view.blocked && view.document.journeyRevision !== manifest.revision && (
        <p data-notes-compatible-revision="">
          These notes began with guide revision {view.document.journeyRevision}. The questions and
          choices are unchanged in revision {manifest.revision}, so you can keep using them. Their
          original revision stays in saved and downloaded copies.
        </p>
      )}
      <details>
        <summary ref={heading}>Save, open or clear this guide’s private notes</summary>
        <p>
          Each step offers an optional prediction and observation. Recorded notes stay in this
          browser; draft fields do not. Download a copy to keep or move to another device.
        </p>
        <fieldset disabled={!view.ready}>
          <legend>Keep a copy of the recorded notes in this tab</legend>
          <div className="actions">
            <button type="button" onClick={() => exportNotes(false)}>
              Download notes JSON
            </button>
            <button type="button" onClick={() => exportNotes(true)}>
              Download readable notes
            </button>
            <button type="button" onClick={() => exportNotes(false, true)}>
              Show copyable notes JSON
            </button>
          </div>
          {copyable !== null && (
            <>
              <label htmlFor={`${instance}-export`}>Private recorded notes JSON</label>
              <textarea
                id={`${instance}-export`}
                readOnly
                rows={6}
                value={copyable}
                onFocus={(event) => event.currentTarget.select()}
              />
            </>
          )}
        </fieldset>
        {view.retainedRaw !== null && (
          <details>
            <summary>Recover the original stored text</summary>
            <p>
              The original could not be opened here. Save it before clearing or replacing anything.
            </p>
            <button
              type="button"
              onClick={() =>
                download(view.retainedRaw ?? "", "original.txt", "text/plain;charset=utf-8")
              }
            >
              Download original stored notes
            </button>
            <label htmlFor={`${instance}-original`}>Original stored text, unchanged</label>
            <textarea id={`${instance}-original`} readOnly rows={5} value={view.retainedRaw} />
          </details>
        )}
        <details>
          <summary>Open a notes JSON file</summary>
          <p>
            The file must belong to this paper. Earlier guide revisions are accepted only when their
            questions and choices are unchanged. Checking a file leaves your notes unchanged.
          </p>
          <fieldset disabled={!view.ready || view.blocked}>
            <legend>Check a file before replacing these notes</legend>
            <label htmlFor={`${instance}-file`}>Choose a notes JSON file</label>
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
            <label htmlFor={`${instance}-paste`}>Or paste notes JSON</label>
            <textarea
              id={`${instance}-paste`}
              rows={4}
              maxLength={NOTE_FILE_LIMIT}
              value={paste}
              onChange={(event) => {
                cancelImport();
                setPaste(event.currentTarget.value);
                setNotice("");
              }}
            />
            <div className="actions">
              <button
                type="button"
                disabled={!paste.trim()}
                onClick={() => {
                  request.current += 1;
                  validate(
                    paste,
                    session.beginImport(),
                    session.getSnapshot().document,
                    draftVersion.current,
                  );
                }}
              >
                Check pasted notes
              </button>
              <button type="button" onClick={cancelImport}>
                Cancel import
              </button>
            </div>
            {preview && (
              <section
                className="notice"
                aria-label="Notes replacement preview"
                data-discovery-notes-preview
              >
                <p>
                  This file contains{" "}
                  {preview.document.entries.reduce(
                    (count, entry) => count + entry.attempts.length,
                    0,
                  )}{" "}
                  recorded predictions across {preview.document.entries.length} steps. Replacing
                  will discard this guide’s current notes and all draft fields.
                </p>
                {preview.document.entries.map((entry) => (
                  <div key={entry.stageId}>
                    <p>
                      <strong>
                        {manifest.stages.find((stage) => stage.id === entry.stageId)?.title}
                      </strong>
                    </p>
                    {entry.attempts.map((attempt, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the immutable preview preserves the file's attempt order
                      <div key={`${index}-${attempt.prediction}`}>
                        <p className="discovery-note-text">
                          <strong>Prediction {index + 1}:</strong> {attempt.prediction}
                        </p>
                        <p className="discovery-note-text">
                          <strong>Observation:</strong> {attempt.observation || "None recorded."}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
                <button type="button" onClick={replaceWithPreview}>
                  Replace this guide’s notes with this file
                </button>
              </section>
            )}
          </fieldset>
        </details>
        <details>
          <summary>Start a new notebook for this guide</summary>
          <p>
            This clears the guide’s recorded predictions, observations and draft fields. Save a copy
            first if you want to keep them.
          </p>
          {!confirmClear ? (
            <button
              type="button"
              disabled={!view.ready}
              onClick={() => {
                cancelImport();
                setNotice("");
                setConfirmClear(true);
              }}
            >
              Clear this guide’s notes…
            </button>
          ) : (
            <div className="notice">
              <p>
                Clear every recorded note for {NOTE_PAPER_TITLES[manifest.paper]} on this device?
              </p>
              <div className="actions">
                <button
                  type="button"
                  onClick={() => {
                    request.current += 1;
                    session.startOver();
                    setConfirmClear(false);
                    setPaste("");
                    setNotice(session.getSnapshot().message);
                    heading.current?.focus();
                  }}
                >
                  Yes, clear this guide’s recorded notes
                </button>
                <button type="button" onClick={() => setConfirmClear(false)}>
                  Keep my notes
                </button>
              </div>
            </div>
          )}
        </details>
        <p>
          <a href="/notebook/#discovery-notes">Open your notebook</a> ·{" "}
          <a href="/your-data/">Manage all data on this device</a>
        </p>
        <p role="status" aria-atomic="true" data-discovery-notes-transfer-notice>
          {notice}
        </p>
      </details>
    </section>
  );
}
