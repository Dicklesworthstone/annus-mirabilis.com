"use client";

import { useEffect, useRef, useState } from "react";
import { useDiscoveryNotebook } from "../../discovery/notes/context.tsx";
import type {
  NotebookAnswerBinding,
  NotebookAnswerContext,
} from "../../reader/notebook/answerContext.ts";
import type { NotebookState, NotebookStore } from "../../reader/notebook/notebookStore.ts";
import { NOTEBOOK_LIMITS, type NotebookTeachBackEntry } from "../../reader/notebook/schema.ts";

export type TeachBackBinding = NotebookAnswerBinding;
type AnswerProps = Readonly<{ promptId: string; prompt: string; binding: TeachBackBinding }>;

/** Optional local saving. The worked comparison belongs to the surrounding server component. */
export function TeachBackAnswer(props: AnswerProps) {
  const guide = useDiscoveryNotebook();
  const context = props.binding.context ?? guide?.manifest;
  return (
    <TeachBackForm
      key={JSON.stringify([context?.paper, context?.revision, props.promptId, props.prompt])}
      {...props}
      context={context}
    />
  );
}

/** A changed question starts a fresh draft; its earlier saved explanations remain readable. */
function TeachBackForm({
  promptId,
  prompt,
  binding,
  context,
}: AnswerProps & Readonly<{ context: NotebookAnswerContext | undefined }>) {
  const paper = context?.paper;
  const [store, setStore] = useState<NotebookStore | null>(null);
  const [snapshot, setSnapshot] = useState<NotebookState | null>(null);
  const [answer, setAnswer] = useState("");
  const [changed, setChanged] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<{ entry: NotebookTeachBackEntry; draft: string } | null>(
    null,
  );
  const field = useRef<HTMLTextAreaElement>(null);
  const preview =
    pending?.draft === answer && snapshot?.document.entries.includes(pending.entry)
      ? pending.entry
      : null;
  const box = `explanation-${promptId}`;

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
          setNotice(
            "The notebook could not be opened. Your words stay in this box; copy them before leaving.",
          );
      });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [paper]);

  function save() {
    if (!store || !context || !changed || !answer.trim()) return;
    try {
      const result = store.add({
        id:
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `teachback-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
        kind: "teachBack",
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
        teachBack: {
          schemaVersion: 1,
          promptId,
          prompt,
          guideRevision: context.revision,
        },
      });
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      setChanged(false);
      setPending(null);
      setNotice(`Explanation kept. ${store.getSnapshot().message}`);
    } catch {
      setNotice(
        "The explanation could not be kept. Your words are still here; copy them before leaving.",
      );
    }
  }

  function restore(entry: NotebookTeachBackEntry) {
    if (
      !store?.getSnapshot().document.entries.includes(entry) ||
      entry.teachBack.prompt !== prompt ||
      entry.teachBack.guideRevision !== context?.revision
    ) {
      setPending(null);
      setNotice(
        "This saved explanation or its question has changed. Review the saved versions again before replacing your draft.",
      );
      return;
    }
    setAnswer(entry.text);
    setChanged(false);
    setPending(null);
    setNotice(
      "Explanation restored to the field. No answer was assessed, and your saved version is unchanged.",
    );
    field.current?.focus();
  }

  const earlier =
    snapshot?.document.entries.filter(
      (entry) =>
        entry.kind === "teachBack" &&
        entry.frame.paper === paper &&
        entry.teachBack.promptId === promptId,
    ) ?? [];

  return (
    <div data-teach-back-answer={promptId}>
      <textarea
        ref={field}
        id={box}
        className="exercise-explanation"
        rows={5}
        maxLength={NOTEBOOK_LIMITS.text}
        aria-describedby={`${box}-note`}
        value={answer}
        onChange={(event) => {
          setAnswer(event.target.value);
          setChanged(true);
          setPending(null);
          setNotice("");
        }}
      />
      <button
        type="button"
        aria-label={`Save explanation in my notebook: ${binding.title}`}
        disabled={!store || !context || !changed || !answer.trim()}
        onClick={save}
      >
        Save explanation in my notebook
      </button>
      <p className="fine">
        Saving keeps this version. You can change your words and save another; earlier explanations
        stay beside it. Draft changes are not saved. Up to 4,000 characters.
      </p>
      <noscript>
        <p>
          Saving needs JavaScript. You can still write here and open the worked explanation below.
        </p>
      </noscript>
      {snapshot && snapshot.persistence !== "saved" && <p>{snapshot.message}</p>}
      {earlier.length > 0 && (
        <details>
          <summary>Your saved explanations</summary>
          {earlier.map((entry) => {
            if (entry.kind !== "teachBack") return null;
            const compatible =
              entry.teachBack.guideRevision === context?.revision &&
              entry.teachBack.prompt === prompt;
            return (
              <article className="discovery-note-attempt" key={entry.id}>
                <p>
                  Saved <time dateTime={entry.createdAt}>{entry.createdAt.slice(0, 10)}</time>
                </p>
                {!compatible ? (
                  <p>
                    {binding.context
                      ? "This explanation belongs to an earlier version of this question."
                      : `This explanation belongs to guide revision ${entry.teachBack.guideRevision}.`}{" "}
                    The question then was: {entry.teachBack.prompt}
                  </p>
                ) : null}
                <p className="discovery-note-text">{entry.text}</p>
                {compatible ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (answer.trim() && answer !== entry.text)
                        setPending({ entry, draft: answer });
                      else restore(entry);
                    }}
                  >
                    Use this saved explanation
                  </button>
                ) : (
                  <p>
                    This question or its comparison criteria have changed. The earlier explanation
                    stays available to read or copy.
                  </p>
                )}
              </article>
            );
          })}
        </details>
      )}
      {preview && (
        <section className="notice" aria-label="Replace explanation preview">
          <p>
            Replace the explanation currently in the field? Save it first if you want to keep both
            versions.
          </p>
          <p className="discovery-note-text">{preview.text}</p>
          <div className="actions">
            <button type="button" onClick={() => restore(preview)}>
              Replace the explanation with this saved version
            </button>
            <button type="button" onClick={() => setPending(null)}>
              Keep the current explanation
            </button>
          </div>
        </section>
      )}
      <p role="status" aria-live="polite" aria-atomic="true">
        {notice}
      </p>
      <p>
        <a href="/notebook/" data-open-notebook>
          Open your notebook and saved explanations
        </a>
      </p>
    </div>
  );
}
