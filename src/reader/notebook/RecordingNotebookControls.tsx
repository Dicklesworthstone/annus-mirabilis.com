"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { RecordedExperiment } from "../../experiments/permalink/recordedExperiments.ts";
import type { NotebookStore } from "./notebookStore.ts";
import type { NotebookRecording } from "./recordingEntry.ts";
import { recordingLaboratory } from "./recordingLaboratories.ts";
import type { NotebookRecordingEntry } from "./schema.ts";

async function browserNotebook(): Promise<NotebookStore> {
  return (await import("./browserStore.ts")).getNotebookStore();
}

/**
 * Load notebook code and device storage only after an explicit save/list action.
 * Opening an entry returns a preview to the recorder, never a replay command.
 */
export function RecordingNotebookControls({
  experimentId,
  recording,
  title,
  disabled = false,
  onOpen,
  loadStore = browserNotebook,
}: Readonly<{
  experimentId: string;
  recording: RecordedExperiment | null;
  title: string;
  disabled?: boolean;
  onOpen: (recording: NotebookRecording) => void;
  loadStore?: () => Promise<NotebookStore>;
}>) {
  const id = useId();
  const supported = recordingLaboratory(experimentId) !== null;
  const [entries, setEntries] = useState<readonly NotebookRecordingEntry[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const alive = useRef(false);
  const inFlight = useRef(false);
  const storeRef = useRef<NotebookStore | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      unsubscribe.current?.();
      unsubscribe.current = null;
    };
  }, []);

  function refresh(store: NotebookStore) {
    if (!alive.current) return;
    setEntries(
      store
        .getSnapshot()
        .document.entries.filter(
          (entry): entry is NotebookRecordingEntry =>
            entry.kind === "recording" && entry.recording.experimentId === experimentId,
        ),
    );
  }

  async function getStore(): Promise<NotebookStore | null> {
    if (storeRef.current) return storeRef.current;
    const store = await loadStore();
    if (!alive.current) return null;
    store.open();
    storeRef.current = store;
    unsubscribe.current = store.subscribe(() => refresh(store));
    refresh(store);
    return store;
  }

  async function save() {
    if (!supported || !recording || disabled || inFlight.current) return;
    const captured = { ...recording, title };
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const [{ saveNotebookRecording }, store] = await Promise.all([
        import("./saveRecording.ts"),
        getStore(),
      ]);
      if (!alive.current || !store) return;
      const result = saveNotebookRecording(store, captured);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setShowSaved(true);
      setMessage("Kept a copy in your notebook. " + store.getSnapshot().message);
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "This recording could not be saved. It is still here.",
        );
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function show() {
    if (!supported || disabled || inFlight.current) return;
    if (showSaved) {
      setShowSaved(false);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const store = await getStore();
      if (!alive.current || !store) return;
      refresh(store);
      setShowSaved(true);
      setMessage(store.getSnapshot().message);
    } catch (reason) {
      if (alive.current)
        setError(reason instanceof Error ? reason.message : "The notebook could not be opened.");
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function open(entry: NotebookRecordingEntry) {
    if (disabled || inFlight.current) return;
    // Notify synchronously so the recorder can invalidate an older file-import generation
    // before it starts any asynchronous notebook decoding.
    onOpen(entry.recording);
    setMessage("The saved recording is selected for preview. No checkpoint has run.");
  }

  if (!supported) return null;
  return (
    <section aria-labelledby={id + "-heading"} data-recording-notebook={experimentId}>
      <h4 id={id + "-heading"}>Keep this experiment in your notebook</h4>
      <p>
        Save a copy of the recording and your notes on this device. Opening a saved recording
        previews its stops; Restore remains a separate action.
      </p>
      <div className="actions">
        <button
          type="button"
          disabled={!recording || disabled || busy}
          onClick={() => {
            void save();
          }}
        >
          Save recording in notebook
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          aria-expanded={showSaved}
          aria-controls={id + "-saved"}
          onClick={() => {
            void show();
          }}
        >
          {showSaved ? "Hide notebook recordings" : "Show notebook recordings"}
        </button>
        <a href="/notebook/">Open your notebook</a>
      </div>
      <div id={id + "-saved"} hidden={!showSaved}>
        {entries.length === 0 ? (
          <p>No recordings for this laboratory are saved in your notebook yet.</p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.title}</strong>
                {" — " +
                  entry.recording.stops.length +
                  " saved " +
                  (entry.recording.stops.length === 1 ? "stop" : "stops") +
                  ". "}
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => {
                    void open(entry);
                  }}
                >
                  Open saved recording
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p role="status" aria-live="polite" aria-atomic="true">
        {busy ? "Opening notebook…" : message}
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
