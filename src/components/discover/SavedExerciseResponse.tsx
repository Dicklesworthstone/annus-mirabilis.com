"use client";

import { useEffect, useState } from "react";
import { useDiscoveryNotebook } from "../../discovery/notes/context.tsx";
import type { NotebookAnswerBinding } from "../../reader/notebook/answerContext.ts";
import { type ExerciseCapture, exerciseResponseText } from "../../reader/notebook/exerciseEntry.ts";
import type { NotebookState, NotebookStore } from "../../reader/notebook/notebookStore.ts";
import type { NotebookExerciseEntry } from "../../reader/notebook/schema.ts";

export type ExerciseNotebookBinding = NotebookAnswerBinding;
export type SavedExerciseDefinition = Readonly<{
  partId: string;
  prompt: string;
  partKind: ExerciseCapture["partKind"];
  definitionKey: string;
}>;

/** Optional private response history. Restoring a response never restores or runs a verdict. */
export function SavedExerciseResponse({
  definition,
  binding,
  answer,
  unit,
  units = [],
  onRestore,
}: Readonly<{
  definition: SavedExerciseDefinition;
  binding: ExerciseNotebookBinding;
  answer: string;
  unit: string | null;
  units?: readonly string[];
  onRestore(answer: string, unit: string | null): void;
}>) {
  const guide = useDiscoveryNotebook();
  const context = binding.context ?? guide?.manifest;
  const paper = context?.paper;
  const [store, setStore] = useState<NotebookStore | null>(null);
  const [snapshot, setSnapshot] = useState<NotebookState | null>(null);
  const [notice, setNotice] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    entry: NotebookExerciseEntry;
    draft: string;
  } | null>(null);
  const draft = JSON.stringify([answer, unit, definition.definitionKey]);
  const preview =
    pending?.draft === draft && snapshot?.document.entries.includes(pending.entry)
      ? pending.entry
      : null;

  // Editing away and back must not revive an earlier replacement confirmation.
  useEffect(() => {
    setPending((current) => (current && current.draft !== draft ? null : current));
  }, [draft]);

  useEffect(() => {
    if (!paper) return;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void import("../../reader/notebook/browserStore.ts")
      .then(({ getNotebookStore }) => {
        if (!alive) return;
        const notebook = getNotebookStore();
        unsubscribe = notebook.subscribe(() => {
          if (alive) setSnapshot(notebook.getSnapshot());
        });
        notebook.open();
        setSnapshot(notebook.getSnapshot());
        setStore(notebook);
      })
      .catch(() => {
        if (alive)
          setNotice("The notebook could not be opened. Copy your response before leaving.");
      });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [paper]);

  if (!context) return null;

  function save() {
    if (!store || !context || !answer.trim() || draft === lastSaved) return;
    try {
      const result = store.add({
        id:
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `exercise-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
        kind: "exercise",
        frame: {
          paper: context.paper,
          anchor: binding.sourceAnchor,
          view: "reading",
          detail: 1,
          lens: "paper",
          open: "",
        },
        title: binding.title,
        text: answer,
        createdAt: new Date().toISOString(),
        exercise: {
          schemaVersion: 1,
          ...definition,
          guideRevision: context.revision,
          unit,
        },
      });
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      setLastSaved(draft);
      setPending(null);
      setNotice(`Response kept. ${store.getSnapshot().message}`);
    } catch {
      setNotice(
        "The response could not be kept. Your answer is still in the field; copy it before leaving.",
      );
    }
  }

  function restore(entry: NotebookExerciseEntry) {
    onRestore(entry.text, entry.exercise.unit);
    setLastSaved(JSON.stringify([entry.text, entry.exercise.unit, definition.definitionKey]));
    setPending(null);
    setNotice(
      "Response restored to the answer field. Check it again to get a current result; nothing was checked automatically.",
    );
  }

  const earlier =
    snapshot?.document.entries.filter(
      (entry): entry is NotebookExerciseEntry =>
        entry.kind === "exercise" &&
        entry.frame.paper === paper &&
        entry.exercise.partId === definition.partId &&
        entry.exercise.partKind === definition.partKind,
    ) ?? [];

  return (
    <fieldset
      data-saved-exercise-response={definition.partId}
      aria-label={`${binding.title}: saved responses`}
    >
      <button
        type="button"
        aria-label={`Save response in my notebook: ${binding.title}`}
        disabled={!store || !answer.trim() || draft === lastSaved}
        onClick={save}
      >
        Save response in my notebook
      </button>
      <p className="fine">
        Saving keeps this response and its question. Draft changes are not saved. Earlier responses
        stay beside new ones, and restoring one asks for a fresh check. Nothing is uploaded.
      </p>
      <noscript>
        <p>Saving needs JavaScript. The prompt and worked explanation remain available.</p>
      </noscript>
      {snapshot && snapshot.persistence !== "saved" && <p>{snapshot.message}</p>}
      {earlier.length > 0 && (
        <details>
          <summary>Your saved responses</summary>
          {earlier.map((entry) => {
            const compatible =
              entry.exercise.definitionKey === definition.definitionKey &&
              entry.exercise.prompt === definition.prompt &&
              (definition.partKind === "expression"
                ? entry.exercise.unit === null
                : units.includes(entry.exercise.unit ?? ""));
            return (
              <article className="discovery-note-attempt" key={entry.id}>
                <p>
                  Saved <time dateTime={entry.createdAt}>{entry.createdAt.slice(0, 10)}</time>
                </p>
                <p className="discovery-note-text">
                  {exerciseResponseText(entry.text, entry.exercise)}
                </p>
                {entry.exercise.guideRevision !== context.revision || !compatible ? (
                  <p>
                    {binding.context
                      ? "This response belongs to an earlier version of this question."
                      : `This response belongs to guide revision ${entry.exercise.guideRevision}.`}{" "}
                    The question then was: {entry.exercise.prompt}
                  </p>
                ) : null}
                {compatible ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (answer.trim() && (answer !== entry.text || unit !== entry.exercise.unit))
                        setPending({ entry, draft });
                      else restore(entry);
                    }}
                  >
                    Use this saved response
                  </button>
                ) : (
                  <p>
                    This exercise has changed since the response was saved. The earlier response
                    stays available to read or copy; it is not restored into the changed exercise.
                  </p>
                )}
              </article>
            );
          })}
        </details>
      )}
      {preview && (
        <section className="notice" aria-label="Replace exercise answer preview">
          <p>
            Replace the answer currently in the field? Save it first if you want to keep it. This
            restores your saved response and clears the current checker result.
          </p>
          <p className="discovery-note-text">
            {exerciseResponseText(preview.text, preview.exercise)}
          </p>
          <div className="actions">
            <button type="button" onClick={() => restore(preview)}>
              Replace the answer with this saved response
            </button>
            <button type="button" onClick={() => setPending(null)}>
              Keep the current answer
            </button>
          </div>
        </section>
      )}
      <p role="status" aria-live="polite" aria-atomic="true">
        {notice}
      </p>
      <p>
        <a href="/notebook/">Open your notebook to export or import responses</a>
      </p>
    </fieldset>
  );
}
