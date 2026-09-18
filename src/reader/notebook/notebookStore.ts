import { mergeNotebook } from "./import.ts";
import {
  emptyNotebook,
  type LastPlace,
  NOTEBOOK_KEY,
  type NotebookDocument,
  type NotebookEntry,
  parseLastPlace,
  parseNotebookDocument,
  parseNotebookEntry,
} from "./schema.ts";

export type NotebookPersistence = "unopened" | "saved" | "session-only" | "protected" | "conflict";
export type NotebookState = Readonly<{
  document: NotebookDocument;
  persistence: NotebookPersistence;
  message: string;
  /** Preserved opaque original; exported only by explicit user action, never interpreted as markup. */
  recoveryRaw: string | null;
}>;
export type NotebookChange = Readonly<{ ok: true } | { ok: false; message: string }>;
/** I/O port implemented by storage.ts using the existing registered storage layer. */
export interface NotebookStorage {
  readonly maxBytes: number;
  read(): Readonly<{ status: "ok" | "missing" | "unavailable" | "corrupt"; value?: string }>;
  write(
    document: NotebookDocument,
  ): Readonly<{ status: "ok" | "unavailable" | "quota" | "unregistered" }>;
  decode(raw: string): unknown;
  preserve(raw: string): void;
  discardFallback(): void;
}
const estimateBytes = (key: string, value: string) => (key.length + value.length) * 2;
const SESSION_MESSAGE =
  "Notes are available in this tab, but could not be saved on this device. Export them before leaving.";
const PROTECTED_MESSAGE =
  "A saved notebook could not be read by this version. Its original is preserved. New notes stay in this tab until you export them or explicitly clear the saved notebook.";
const CONFLICT_MESSAGE =
  "The saved notebook changed in another tab or was cleared. This tab's work is retained without overwriting that change. Export it before loading the saved notebook.";

/** One owner of am:notebook:v1. Construction is pure; open() is called after hydration. */
export function createNotebookStore(storage: NotebookStorage) {
  if (!Number.isSafeInteger(storage.maxBytes) || storage.maxBytes <= 0)
    throw new TypeError("The notebook requires a registered byte limit.");
  let state: NotebookState = Object.freeze({
    document: emptyNotebook(),
    persistence: "unopened",
    message: "",
    recoveryRaw: null,
  });
  let baseRaw: string | null = null;
  const listeners = new Set<() => void>();
  function publish(next: NotebookState) {
    state = Object.freeze(next);
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* A detached view must not interrupt persistence or another subscriber. */
      }
    }
  }
  function readSaved() {
    const raw = storage.read();
    return { raw, text: raw.status === "ok" ? (raw.value ?? null) : null };
  }
  function open() {
    if (state.persistence !== "unopened") return;
    const saved = readSaved();
    baseRaw = saved.text;
    if (saved.text === null) {
      publish({
        ...state,
        persistence: saved.raw.status === "unavailable" ? "session-only" : "saved",
        message:
          saved.raw.status === "unavailable"
            ? SESSION_MESSAGE
            : "Notes stay on this device. Browser storage is not a permanent backup.",
      });
      return;
    }
    try {
      if (estimateBytes(NOTEBOOK_KEY, saved.text) > storage.maxBytes)
        throw new TypeError("Saved notebook exceeds its registered size limit.");
      const document = parseNotebookDocument(storage.decode(saved.text));
      publish({
        document,
        persistence: "saved",
        message: "Notes stay on this device. Browser storage is not a permanent backup.",
        recoveryRaw: null,
      });
    } catch {
      try {
        storage.preserve(saved.text);
      } catch {
        /* The opaque original also remains in memory. */
      }
      publish({
        ...state,
        persistence: "protected",
        message: PROTECTED_MESSAGE,
        recoveryRaw: saved.text,
      });
    }
  }
  function commit(input: NotebookDocument, allowProtected = false): NotebookChange {
    open();
    let document: NotebookDocument;
    try {
      document = parseNotebookDocument(input);
      if (estimateBytes(NOTEBOOK_KEY, JSON.stringify(document)) > storage.maxBytes)
        return {
          ok: false,
          message:
            "The notebook is full. Export it and remove entries before adding more; no notes were discarded.",
        };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Invalid notebook change.",
      };
    }
    if (state.persistence === "protected" && !allowProtected) {
      publish({ ...state, document, message: PROTECTED_MESSAGE });
      return { ok: true };
    }
    const saved = readSaved();
    // Optimistic conflict detection, including external clearing. Never merge or erase private
    // work silently. The UI offers an explicit reload only after an in-page confirmation.
    if (
      state.persistence === "conflict" ||
      (saved.raw.status !== "unavailable" &&
        saved.text !== baseRaw &&
        !(state.persistence === "session-only" && saved.text === JSON.stringify(state.document)))
    ) {
      publish({ ...state, document, persistence: "conflict", message: CONFLICT_MESSAGE });
      return { ok: true };
    }
    const outcome = storage.write(document);
    if (outcome.status === "ok") baseRaw = JSON.stringify(document);
    publish({
      document,
      persistence: outcome.status === "ok" ? "saved" : "session-only",
      message:
        outcome.status === "ok"
          ? "Saved on this device. Export important notes as a backup."
          : SESSION_MESSAGE,
      recoveryRaw: allowProtected && outcome.status === "ok" ? null : state.recoveryRaw,
    });
    return { ok: true };
  }
  return Object.freeze({
    open,
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    add(input: NotebookEntry): NotebookChange {
      open();
      let entry: NotebookEntry;
      try {
        entry = parseNotebookEntry(input);
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Invalid entry." };
      }
      if (state.document.entries.some((item) => item.id === entry.id))
        return { ok: false, message: "That notebook entry id is already in use." };
      return commit({ ...state.document, entries: [...state.document.entries, entry] });
    },
    updateText(id: string, text: string): NotebookChange {
      open();
      if (!state.document.entries.some((entry) => entry.id === id))
        return { ok: false, message: "That notebook entry no longer exists." };
      return commit({
        ...state.document,
        entries: state.document.entries.map((entry) =>
          entry.id === id ? { ...entry, text } : entry,
        ),
      });
    },
    updateReplayWords(id: string, words: Readonly<{ before: string; after: string; notes: string }>): NotebookChange {
      open();
      const entry = state.document.entries.find((item) => item.id === id);
      if (!entry || entry.kind !== "replay") return { ok: false, message: "That saved comparison no longer exists." };
      return commit({ ...state.document, entries: state.document.entries.map((item) => item.id !== id ? item : {
        ...entry, text: words.notes,
        replay: { ...entry.replay, explanationBefore: words.before, explanationAfter: words.after },
      }) });
    },
    remove(id: string): NotebookChange {
      open();
      return commit({
        ...state.document,
        entries: state.document.entries.filter((entry) => entry.id !== id),
      });
    },
    remember(input: LastPlace): NotebookChange {
      open();
      let place: LastPlace;
      try {
        place = parseLastPlace(input);
      } catch {
        return {
          ok: false,
          message: "This passage has no portable reading location or authored recap.",
        };
      }
      if (JSON.stringify(place) === JSON.stringify(state.document.lastPlace)) return { ok: true };
      return commit({ ...state.document, lastPlace: place });
    },
    forgetPlace(): NotebookChange {
      open();
      return commit({ ...state.document, lastPlace: null });
    },
    retry(): NotebookChange {
      open();
      return commit(state.document);
    },
    importConfirmed(input: unknown): NotebookChange {
      open();
      try {
        return commit(mergeNotebook(state.document, input).document);
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof Error ? error.message : "The import is not a supported notebook.",
        };
      }
    },
    /** Caller must ask for confirmation in the page, including when the original is unsupported. */
    clearConfirmed(): NotebookChange {
      open();
      if (state.persistence === "conflict") return { ok: false, message: CONFLICT_MESSAGE };
      return commit(emptyNotebook(), true);
    },
    /** Explicit replacement of this tab's view, not an automatic response to a storage event. */
    reloadConfirmed() {
      storage.discardFallback();
      state = Object.freeze({
        document: emptyNotebook(),
        persistence: "unopened",
        message: "",
        recoveryRaw: null,
      });
      open();
    },
    checkForExternalChange() {
      if (state.persistence === "unopened") return;
      const saved = readSaved();
      if (
        saved.raw.status !== "unavailable" &&
        saved.text !== baseRaw &&
        !(state.persistence === "session-only" && saved.text === JSON.stringify(state.document))
      )
        publish({ ...state, persistence: "conflict", message: CONFLICT_MESSAGE });
    },
  });
}
export type NotebookStore = ReturnType<typeof createNotebookStore>;
