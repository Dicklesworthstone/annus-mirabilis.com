"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { ControlledComparisonState } from "../../experiments/compare/controlledComparison.ts";
import {
  REPLAY_LIMITS,
  REPLAY_PREDICTIONS,
  type ReplayPassage,
  type ReplayPrediction,
} from "./replayEntry.ts";
import "./replaySave.css";

/** The save boundary is explicit and local. No note is included in props sent by the server. */
export function SaveComparisonReplay({
  state,
  passage,
  prediction,
  ready,
}: Readonly<{
  state: ControlledComparisonState;
  passage: ReplayPassage;
  prediction: ReplayPrediction | null;
  ready: boolean;
}>) {
  const id = useId();
  const [before, setBefore] = useState(""),
    [after, setAfter] = useState(""),
    [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const alive = useRef(false),
    inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function save() {
    if (inFlight.current || saving || state.pending || state.result.kind !== "accepted") return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    // Keep the displayed accepted snapshot and words as they were when Save was requested.
    const input = { state, passage, before, after, notes, prediction };
    try {
      const [{ getNotebookStore }, { saveComparisonReplay }] = await Promise.all([
        import("./browserStore.ts"),
        import("./saveReplay.ts"),
      ]);
      const store = getNotebookStore();
      const result = await saveComparisonReplay(store, input);
      if (!alive.current) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(`Kept in your notebook. ${store.getSnapshot().message}`);
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "The comparison could not be saved. Your words are still here.",
        );
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  }
  return (
    <section className="replay-save" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Keep this comparison and your explanation</h3>
      <p>
        Optional and private. Save the finished comparison, its exact settings and your own
        explanation. Your words are not analyzed or assessed, and the notebook stays on this device
        unless you export it.
      </p>
      <p>
        {prediction
          ? `Your prediction, made before you ran it: ${REPLAY_PREDICTIONS[prediction]}.`
          : "You made no prediction before running it. You can still save the comparison and your explanation."}
      </p>
      <fieldset disabled={!ready || saving}>
        <legend>Your explanation, in your own words</legend>
        <label htmlFor={`${id}-before`}>
          Your explanation before (optional; may be written retrospectively)
        </label>
        <textarea
          id={`${id}-before`}
          rows={3}
          maxLength={REPLAY_LIMITS.text}
          value={before}
          onChange={(event) => setBefore(event.target.value)}
        />
        <label htmlFor={`${id}-after`}>Your explanation after (optional)</label>
        <textarea
          id={`${id}-after`}
          rows={3}
          maxLength={REPLAY_LIMITS.text}
          value={after}
          onChange={(event) => setAfter(event.target.value)}
        />
        <label htmlFor={`${id}-notes`}>Private notes (optional)</label>
        <textarea
          id={`${id}-notes`}
          rows={2}
          maxLength={REPLAY_LIMITS.text}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <button
          type="button"
          disabled={state.pending || state.result.kind !== "accepted"}
          onClick={() => {
            void save();
          }}
        >
          {saving ? "Saving comparison" : "Save this comparison and my explanation"}
        </button>
      </fieldset>
      <p className="fine">
        Up to 10,000 characters per text field and 64 KiB per complete entry; the notebook has a
        total device-storage budget. Nothing is silently shortened. Replaying is a separate explicit
        action in the notebook.
      </p>
      <p role="status" aria-live="polite" aria-atomic="true">
        {message}
      </p>
      {error && <p role="alert">{error}</p>}
      <a href="/notebook/" data-open-notebook>
        Open your notebook and saved comparisons
      </a>
    </section>
  );
}
