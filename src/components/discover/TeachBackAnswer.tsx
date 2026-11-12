"use client";

import { useEffect, useState } from "react";
import { useDiscoveryNotebook } from "../../discovery/notes/context.tsx";
import type { NotebookState, NotebookStore } from "../../reader/notebook/notebookStore.ts";
import { NOTEBOOK_LIMITS } from "../../reader/notebook/schema.ts";

export type TeachBackBinding = Readonly<{ title: string; sourceAnchor: string }>;

/** Optional local saving. The worked comparison belongs to the surrounding server component. */
export function TeachBackAnswer({
  promptId,
  prompt,
  binding,
}: Readonly<{ promptId: string; prompt: string; binding: TeachBackBinding }>) {
  const guide = useDiscoveryNotebook();
  const paper = guide?.manifest.paper;
  const [store, setStore] = useState<NotebookStore | null>(null);
  const [snapshot, setSnapshot] = useState<NotebookState | null>(null);
  const [answer, setAnswer] = useState("");
  const [changed, setChanged] = useState(false);
  const [notice, setNotice] = useState("");
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
    if (!store || !guide || !changed || !answer.trim()) return;
    try {
      const result = store.add({
        id:
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `teachback-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
        kind: "teachBack",
        frame: {
          paper: guide.manifest.paper,
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
          guideRevision: guide.manifest.revision,
        },
      });
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      setChanged(false);
      setNotice(`Explanation kept. ${store.getSnapshot().message}`);
    } catch {
      setNotice(
        "The explanation could not be kept. Your words are still here; copy them before leaving.",
      );
    }
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
        id={box}
        className="exercise-explanation"
        rows={5}
        maxLength={NOTEBOOK_LIMITS.text}
        aria-describedby={`${box}-note`}
        value={answer}
        onChange={(event) => {
          setAnswer(event.target.value);
          setChanged(true);
          setNotice("");
        }}
      />
      <button
        type="button"
        disabled={!store || !guide || !changed || !answer.trim()}
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
            return (
              <article className="discovery-note-attempt" key={entry.id}>
                <p>
                  Saved <time dateTime={entry.createdAt}>{entry.createdAt.slice(0, 10)}</time>
                </p>
                {entry.teachBack.guideRevision !== guide?.manifest.revision ||
                entry.teachBack.prompt !== prompt ? (
                  <p>
                    This explanation belongs to guide revision {entry.teachBack.guideRevision}. The
                    question then was: {entry.teachBack.prompt}
                  </p>
                ) : null}
                <p className="discovery-note-text">{entry.text}</p>
              </article>
            );
          })}
        </details>
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
