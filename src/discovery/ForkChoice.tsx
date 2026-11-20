"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createStorageContext, type StorageContext } from "../platform/storage/store.ts";
import {
  clearJourneyChoice,
  JOURNEY_STORAGE_NAMESPACE,
  type JourneyWriteStatus,
  notifyJourneyStorageClear,
  readJourneyState,
  retryJourneyChoices,
  saveJourneyChoice,
} from "./journeyStorage.ts";

type Choice = Readonly<{ id: string; label: string }>;
type ChoiceChange = Readonly<{ forkId: string; status: JourneyWriteStatus; cleared: boolean }>;
const CHANGE_EVENT = "am:journey-choice-change";

// Forks on the same page share fallback memory as well as durable storage. Release it when the
// last island leaves: "while this page is open" is the lifetime the fallback note promises.
const pageContexts = new WeakMap<Window, { context: StorageContext; users: number }>();
function acquireContext() {
  let entry = pageContexts.get(window);
  if (!entry) {
    entry = { context: createStorageContext(), users: 0 };
    pageContexts.set(window, entry);
  }
  entry.users += 1;
  return entry;
}

interface ChoiceView {
  ready: boolean;
  selected: string | undefined;
  hasChoice: boolean;
  pending: boolean;
  conflict: boolean;
  message: string;
}

/**
 * A private note to return to, never a quiz or a gate. Fork and Branch remain server-rendered;
 * this island adds a choice without concealing any hypothesis, worked steps, or outcome.
 */
export function ForkChoice({
  forkId,
  question,
  choices,
}: {
  forkId: string;
  question: string;
  choices: readonly Choice[];
}) {
  const id = useId();
  const context = useRef<StorageContext | null>(null);
  const firstChoice = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<ChoiceView>({
    ready: false,
    selected: undefined,
    hasChoice: false,
    pending: false,
    conflict: false,
    message: "",
  });

  useEffect(() => {
    const entry = acquireContext();
    const ctx = entry.context;
    context.current = ctx;
    function restore(change?: ChoiceChange) {
      const read = readJourneyState(ctx);
      const saved =
        read.value && Object.hasOwn(read.value.choices, forkId)
          ? read.value.choices[forkId]
          : undefined;
      const selected = choices.find((choice) => choice.id === saved)?.id;
      const temporary = read.pending?.includes(forkId) === true;
      const conflict = read.conflicts?.includes(forkId) === true;
      let message = selected ? "Kept on this device." : "";
      if (change?.cleared) message = "Your choice is cleared on this device.";
      if (temporary || read.status === "unavailable") {
        message = change?.cleared
          ? "Cleared for this visit. The change could not be saved, so an earlier choice may return when you reload."
          : "Your choice can stay only while this page is open. Device storage is unavailable.";
      }
      if (change?.status === "quota") {
        message = change.cleared
          ? "Cleared for this visit. This device has no room to save the change, so an earlier choice may return when you reload."
          : "This device has no room to save the choice. It will stay only while this page is open.";
      }
      if (change?.status === "unregistered")
        message = "The change could not be kept on this device.";
      if (change?.status === "conflict" && temporary)
        message =
          "This choice stays in this page until the competing changes at the other questions are resolved.";
      if (conflict)
        message =
          "Another tab changed or cleared the saved choice. This page keeps your choice here. Keep this page's choice to save it, or reload to use the saved version.";
      if (saved && !selected)
        message =
          "The saved choice is not part of this version of the question. You can choose again or clear it.";
      if (read.status === "corrupt")
        message =
          "Your saved choices could not be read. The earlier data is retained in Your data on this device; you can make a new choice.";
      setView({
        ready: true,
        selected,
        hasChoice: saved !== undefined,
        pending: temporary,
        conflict,
        message,
      });
    }
    function changed(event: Event) {
      const change = (event as CustomEvent<ChoiceChange>).detail;
      // One successful write can save several pending forks after storage recovers.
      restore(change.forkId === forkId ? change : undefined);
    }
    function storageChanged(event: StorageEvent) {
      if (event.key !== null && event.key !== JOURNEY_STORAGE_NAMESPACE) return;
      // The event records a clear that newer durable bytes may already have replaced.
      if (event.newValue === null) notifyJourneyStorageClear(ctx);
      // Refresh durable choices without discarding this page's unsaved selections.
      restore();
    }
    restore();
    window.addEventListener(CHANGE_EVENT, changed);
    window.addEventListener("storage", storageChanged);
    return () => {
      window.removeEventListener(CHANGE_EVENT, changed);
      window.removeEventListener("storage", storageChanged);
      context.current = null;
      entry.users -= 1;
      if (entry.users === 0) pageContexts.delete(window);
    };
  }, [forkId, choices]);

  function choose(choiceId?: string) {
    const ctx = context.current;
    if (!ctx || (choiceId !== undefined && !choices.some((choice) => choice.id === choiceId)))
      return;
    const result =
      choiceId === undefined
        ? clearJourneyChoice(ctx, forkId)
        : saveJourneyChoice(ctx, forkId, choiceId);
    window.dispatchEvent(
      new CustomEvent<ChoiceChange>(CHANGE_EVENT, {
        detail: { forkId, status: result.status, cleared: choiceId === undefined },
      }),
    );
    if (choiceId === undefined) firstChoice.current?.focus();
  }

  function savePending() {
    const ctx = context.current;
    if (!ctx) return;
    if (view.conflict) choose(view.selected);
    else {
      const result = retryJourneyChoices(ctx);
      window.dispatchEvent(
        new CustomEvent<ChoiceChange>(CHANGE_EVENT, {
          detail: { forkId, status: result.status, cleared: !view.hasChoice },
        }),
      );
    }
    // Saving removes this button, so return keyboard focus to the stable question controls.
    firstChoice.current?.focus();
  }

  const selected = choices.find((choice) => choice.id === view.selected);
  return (
    <div className="journey-choice" data-journey-choice={forkId}>
      <fieldset
        disabled={!view.ready}
        aria-label={`Your choice: ${question}`}
        aria-describedby={`${id}-help`}
      >
        <legend>Keep an idea to revisit (optional)</legend>
        <p id={`${id}-help`} className="fine">
          Nothing is scored or sent. Every explanation below stays available.
        </p>
        <div className="journey-choice-options">
          {choices.map((choice, index) => (
            <label key={choice.id}>
              <input
                ref={index === 0 ? firstChoice : undefined}
                type="radio"
                name={`${id}-choice`}
                value={choice.id}
                checked={view.selected === choice.id}
                onChange={() => choose(choice.id)}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </div>
        <button type="button" disabled={!view.hasChoice} onClick={() => choose()}>
          Clear my choice
        </button>
        {view.pending && (
          <button type="button" onClick={savePending}>
            {view.conflict ? "Keep this page's choice" : "Try saving again"}
          </button>
        )}
      </fieldset>
      {selected && (
        <p className="fine journey-choice-summary">
          Your choice: <a href={`#${selected.id}`}>{selected.label}</a>
        </p>
      )}
      <p className="fine" role="status" aria-atomic="true">
        {view.message}
      </p>
      <noscript>
        <p className="fine">
          Keeping a choice needs JavaScript. All the explanations are available below.
        </p>
      </noscript>
    </div>
  );
}
