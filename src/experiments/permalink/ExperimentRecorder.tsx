"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import {
  captureRecordedStop,
  RECORDING_LIMITS,
  type RecordedExperiment,
  readRecordedExperiment,
  recordedExperimentWalkthrough,
  writeRecordedExperiment,
} from "./recordedExperiments.ts";
import { validateTapeV2 } from "./schema.ts";
import type { TapeV2 } from "./types.ts";
import {
  applyWalkthroughCheckpointAsync,
  calculateWalkthroughCheckpointAsync,
  type WalkthroughAction,
  type WalkthroughPlayerTarget,
} from "./walkthroughActions.ts";
import "./recordedExperiments.css";

// The recorder can sit inside the laboratory's Apply form. Enter in metadata must not submit it.
function preventMetadataSubmit(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault();
}

/** Explicit capture of accepted snapshots. Import and selection never run a laboratory. */
export function ExperimentRecorder({
  target,
  tape,
  captureNotice,
}: Readonly<{
  target: WalkthroughPlayerTarget;
  /** A fresh self-contained accepted tape, never an authored history or an unaccepted draft. */
  tape: TapeV2 | null;
  captureNotice?: string | undefined;
}>) {
  const id = useId();
  const [recording, setRecording] = useState<RecordedExperiment | null>(null);
  const [incoming, setIncoming] = useState<RecordedExperiment | null>(null);
  const [title, setTitle] = useState("My experiment");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState<WalkthroughAction | null>(null);
  const [reading, setReading] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [working, setWorking] = useState(false);
  const pendingAction = useRef<AbortController | null>(null);
  const actionTarget = useRef(target);
  const importGeneration = useRef(0);
  const formOnly = target.kind === "form";
  const scientific = target.kind === "worker";
  const stop = recording?.stops[index];
  const settingsOnlyWorkerStop =
    scientific && stop && !stop.tape.acceptedCheckpoint.scientificState;
  useEffect(
    () => () => {
      ++importGeneration.current;
      pendingAction.current?.abort();
      pendingAction.current = null;
    },
    [],
  );
  useEffect(() => {
    if (actionTarget.current === target) return;
    actionTarget.current = target;
    pendingAction.current?.abort();
    pendingAction.current = null;
    setWorking(false);
    setMessage(null);
  }, [target]);

  function cancelCalculation() {
    pendingAction.current?.abort();
    pendingAction.current = null;
    setWorking(false);
  }

  function cancelImport() {
    ++importGeneration.current;
    setReading(false);
    setIncoming(null);
  }
  function capture() {
    if (!tape || pendingAction.current) return;
    if (tape.experimentId !== target.experimentId) {
      setMessage({
        kind: "refused",
        notice: "These accepted settings belong to another laboratory and were not recorded.",
      });
      return;
    }
    const result = captureRecordedStop(
      recording,
      tape,
      title,
      label.trim() || `Stop ${(recording?.stops.length ?? 0) + 1}`,
      note,
      validateTapeV2,
    );
    if (result.kind === "refused") {
      setMessage(result);
      return;
    }
    cancelImport();
    setRecording(result.value);
    setIndex(result.value.stops.length - 1);
    setLabel("");
    setNote("");
    setMessage({
      kind: "loaded",
      notice: tape.acceptedCheckpoint.scientificState
        ? "Saved the completed trial's scientific checkpoint with its exact seeds and settings. Download the recording to keep it after leaving this page."
        : "Saved the laboratory's accepted settings, not unapplied edits in its form. Download the recording to keep it after leaving this page.",
    });
  }
  async function restore(next: number, calculate = false) {
    if (!recording?.stops[next] || pendingAction.current) return;
    const controller = new AbortController();
    pendingAction.current = controller;
    setWorking(true);
    setMessage(null);
    setIndex(next);
    const action = calculate
      ? calculateWalkthroughCheckpointAsync
      : applyWalkthroughCheckpointAsync;
    try {
      const outcome = await action(
        target,
        recordedExperimentWalkthrough(recording),
        next,
        controller.signal,
      );
      if (pendingAction.current === controller && !controller.signal.aborted) setMessage(outcome);
    } catch {
      if (pendingAction.current === controller && !controller.signal.aborted)
        setMessage({
          kind: "refused",
          notice: "The saved-stop calculation could not finish. Your recording remains available.",
        });
    } finally {
      if (pendingAction.current === controller) {
        pendingAction.current = null;
        setWorking(false);
      }
    }
  }
  async function importFile(file: File) {
    const ticket = ++importGeneration.current;
    setIncoming(null);
    setMessage(null);
    if (file.size > RECORDING_LIMITS.bytes) {
      setReading(false);
      setMessage({
        kind: "refused",
        notice:
          "Choose a recording no larger than one megabyte. The current recording is unchanged.",
      });
      return;
    }
    setReading(true);
    try {
      const source = await file.text();
      if (ticket !== importGeneration.current) return;
      const result = readRecordedExperiment(source, target.experimentId, validateTapeV2);
      if (result.kind === "accepted") setIncoming(result.value);
      else setMessage(result);
    } catch {
      if (ticket === importGeneration.current)
        setMessage({
          kind: "refused",
          notice: "The file could not be read. The current recording is unchanged.",
        });
    } finally {
      if (ticket === importGeneration.current) setReading(false);
    }
  }
  function download() {
    if (!recording) return;
    const result = writeRecordedExperiment({ ...recording, title }, validateTapeV2);
    if (result.kind === "refused") {
      setMessage(result);
      return;
    }
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([result.value], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${target.experimentId}-experiment.json`;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      setMessage({
        kind: "loaded",
        notice: recording.stops.some((entry) => entry.tape.acceptedCheckpoint.scientificState)
          ? "Recording file prepared with every saved checkpoint, title, and note. Restore a scientific stop to recompute and verify its trial."
          : "Recording file prepared. It includes every saved stop, the title, and your notes; it contains no animation or measured observations.",
      });
    } catch {
      setMessage({
        kind: "refused",
        notice: "The download could not start. Your recording is still available here.",
      });
    } finally {
      // Let the browser consume the object URL before releasing it.
      if (url) {
        const savedUrl = url;
        setTimeout(() => URL.revokeObjectURL(savedUrl), 1000);
      }
    }
  }

  return (
    <details className="notice experiment-recorder" data-experiment-recorder={target.experimentId}>
      <summary>Save and replay your own experiment</summary>
      <p>
        {scientific
          ? "Save a completed calculation with a note. Each scientific stop preserves the settings, exact seeds and checkpoint needed to reproduce its calculated trial."
          : "Save interesting accepted settings with a note, then revisit them or give the recording to another reader. This saves settings checkpoints, not animation, timing, or observations."}{" "}
        Nothing is uploaded. The recording lives only in this open page until you download it.
      </p>
      <fieldset>
        <legend>Your recording</legend>
        <label htmlFor={`${id}-title`}>Recording title</label>
        <input
          id={`${id}-title`}
          value={title}
          maxLength={RECORDING_LIMITS.title}
          onKeyDown={preventMetadataSubmit}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
        <label htmlFor={`${id}-label`}>Label for the next stop (optional)</label>
        <input
          id={`${id}-label`}
          value={label}
          maxLength={RECORDING_LIMITS.label}
          onKeyDown={preventMetadataSubmit}
          onChange={(event) => setLabel(event.currentTarget.value)}
        />
        <label htmlFor={`${id}-note`}>What did you predict or notice? (optional)</label>
        <textarea
          id={`${id}-note`}
          rows={3}
          value={note}
          maxLength={RECORDING_LIMITS.note}
          onChange={(event) => setNote(event.currentTarget.value)}
        />
        <button
          type="button"
          disabled={working || !tape || (recording?.stops.length ?? 0) >= RECORDING_LIMITS.stops}
          onClick={capture}
        >
          {recording
            ? scientific
              ? "Save current scientific checkpoint"
              : "Save current accepted settings"
            : "Save starting point"}
        </button>
        {captureNotice ? (
          <p role="status" data-recording-capture="">
            {captureNotice}
          </p>
        ) : !tape ? (
          <p>
            No accepted settings can be recorded yet. Apply valid settings in the laboratory first.
          </p>
        ) : null}
      </fieldset>
      {recording && (
        <fieldset>
          <legend>
            {recording.stops.length} of {RECORDING_LIMITS.stops} saved stops
          </legend>
          <label htmlFor={`${id}-stop`}>Saved stop to inspect</label>
          <select
            id={`${id}-stop`}
            value={index}
            onChange={(event) => {
              cancelCalculation();
              setIndex(Number(event.currentTarget.value));
              setMessage(null);
            }}
          >
            {recording.stops.map((entry, i) => (
              <option key={entry.id} value={i}>
                {i + 1}. {entry.label}
              </option>
            ))}
          </select>
          {stop && (
            <div className="recording-stop" data-saved-stop={index}>
              <p>
                <strong>{stop.label}</strong>
              </p>
              {stop.note && <p className="recording-note">{stop.note}</p>}
            </div>
          )}
          <p>
            {formOnly
              ? "Loading a stop fills the form only. Use Apply to calculate; no recorded result has been verified."
              : scientific
                ? settingsOnlyWorkerStop
                  ? "This saved stop contains settings without a scientific checkpoint. Calculate them as a new run with the current model. Its original record stays unchanged."
                  : "Restore recomputes the saved trial and verifies its scientific checkpoint before replacing the accepted result. You can cancel while it is being checked."
                : "Restore verifies the stop through this laboratory before changing its accepted settings. Matching a settings checkpoint is not experimental evidence."}
          </p>
          <div className="recording-actions">
            <button
              type="button"
              disabled={working || index === 0}
              onClick={() => void restore(index - 1)}
            >
              {formOnly ? "Load previous saved settings" : "Restore previous saved stop"}
            </button>
            <button type="button" disabled={working} onClick={() => void restore(index)}>
              {formOnly ? "Load saved settings into form" : "Restore saved stop"}
            </button>
            <button
              type="button"
              disabled={working || index >= recording.stops.length - 1}
              onClick={() => void restore(index + 1)}
            >
              {formOnly ? "Load next saved settings" : "Restore next saved stop"}
            </button>
            {working && (
              <button
                type="button"
                onClick={() => {
                  cancelCalculation();
                  setMessage({
                    kind: "loaded",
                    notice:
                      "Calculation stopped. Saved stops and accepted results remain available.",
                  });
                }}
              >
                Cancel saved-stop calculation
              </button>
            )}
            {!working &&
              (message?.kind === "refused" || settingsOnlyWorkerStop) &&
              target.kind !== "form" &&
              target.calculate && (
                <button type="button" onClick={() => void restore(index, true)}>
                  Calculate saved settings as a new run
                </button>
              )}
            <button type="button" onClick={download}>
              Download recording JSON
            </button>
            <button type="button" onClick={() => setConfirmNew(true)}>
              Start another recording
            </button>
          </div>
          {confirmNew && (
            <div className="notice">
              <p>
                Starting another recording replaces the one in this page. Download it first to keep
                its saved stops and notes.
              </p>
              <button
                type="button"
                onClick={() => {
                  cancelCalculation();
                  cancelImport();
                  setRecording(null);
                  setIndex(0);
                  setTitle("My experiment");
                  setLabel("");
                  setNote("");
                  setMessage(null);
                  setConfirmNew(false);
                }}
              >
                Replace this in-page recording
              </button>{" "}
              <button type="button" onClick={() => setConfirmNew(false)}>
                Keep this recording
              </button>
            </div>
          )}
        </fieldset>
      )}
      <label htmlFor={`${id}-file`}>Open a saved recording JSON file</label>
      <input
        id={`${id}-file`}
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void importFile(file);
        }}
      />
      {reading && <p role="status">Reading the recording on this device…</p>}
      {incoming && (
        <div className="notice">
          <p>
            <strong>{incoming.title}</strong>: {incoming.stops.length} saved stops. Opening this
            file does not run the laboratory or verify its claims.
          </p>
          <button
            type="button"
            onClick={() => {
              const next = incoming;
              cancelCalculation();
              cancelImport();
              setRecording(next);
              setTitle(next.title);
              setLabel("");
              setNote("");
              setIndex(0);
              setConfirmNew(false);
              setMessage({
                kind: "loaded",
                notice:
                  "Recording opened. The laboratory is unchanged. Select a saved stop, then choose its restore or load action.",
              });
            }}
          >
            {recording ? "Replace with imported recording" : "Open imported recording"}
          </button>{" "}
          <button type="button" onClick={cancelImport}>
            Cancel import
          </button>
        </div>
      )}
      {working && <p role="status">Checking the saved stop with the laboratory…</p>}
      {message && (
        <p
          role={message.kind === "refused" ? "alert" : "status"}
          data-recording-outcome={message.kind}
        >
          {message.notice}
        </p>
      )}
    </details>
  );
}
