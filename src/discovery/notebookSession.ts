import {
  createImportGuard,
  decodeNotebook,
  emptyNotebook,
  encodeNotebook,
  recordObservation,
  recordPrediction,
  type DiscoveryNotebook,
  type NoteManifest,
} from "./notebook.ts";

/** The adapter delegates to platform/storage. The session owns notes, never browser key spelling. */
export type NotebookStoragePort = Readonly<{
  read(): Readonly<{ status: "ok" | "missing" | "unavailable" | "corrupt"; value?: string }>;
  write(raw: string): Readonly<{ status: "ok" | "unavailable" | "quota" | "unregistered" }>;
}>;
export type NotebookView = Readonly<{
  document: DiscoveryNotebook;
  ready: boolean;
  blocked: boolean;
  message: string;
  retainedRaw: string | null;
  resetSequence: number;
}>;
/** Instance-scoped accepted state. A rejected draft/import cannot replace the notebook. */
export function createNotebookSession(manifest: NoteManifest, storage: NotebookStoragePort) {
  const server: NotebookView = Object.freeze({
    document: emptyNotebook(manifest),
    ready: false,
    blocked: false,
    message: "Notes become available after this page loads.",
    retainedRaw: null,
    resetSequence: 0,
  });
  let view = server;
  let expectedRaw: string | null = null;
  let attemptedRaw: string | null = null;
  const listeners = new Set<() => void>();
  const imports = createImportGuard();
  function publish(patch: Partial<NotebookView>) {
    view = Object.freeze({ ...view, ...patch });
    for (const listener of listeners) listener();
  }
  function read(): ReturnType<NotebookStoragePort["read"]> {
    try {
      return storage.read();
    } catch {
      return { status: "unavailable" };
    }
  }
  function load() {
    if (view.ready) return;
    const raw = read();
    expectedRaw = raw.status === "ok" ? (raw.value ?? null) : null;
    if (expectedRaw !== null) {
      try {
        publish({
          document: decodeNotebook(expectedRaw, manifest),
          ready: true,
          message: "Loaded this guide’s recorded notes.",
        });
      } catch (error) {
        publish({
          ready: true,
          blocked: true,
          retainedRaw: expectedRaw,
          message: `${error instanceof Error ? error.message : "Stored notes could not be read."} The original stored text was preserved.`,
        });
      }
    } else
      publish({
        ready: true,
        blocked: raw.status === "corrupt",
        message:
          raw.status === "unavailable"
            ? "Device storage is unavailable. Record notes in this tab and export them before leaving."
            : raw.status === "corrupt"
              ? "Storage reports corrupt data. Nothing has been overwritten."
              : "No notes recorded yet. All explanations are available without answering.",
      });
  }
  function unchanged(): boolean {
    const raw = read();
    if (raw.status === "unavailable") return true;
    const value = raw.status === "ok" ? (raw.value ?? null) : null;
    if (raw.status === "corrupt" || (value !== expectedRaw && value !== attemptedRaw)) {
      imports.invalidate();
      publish({
        blocked: true,
        retainedRaw: value,
        message:
          "Stored notes changed elsewhere. Your in-tab notes were retained and not saved over the other version. Export them before reloading or starting over.",
      });
      return false;
    }
    return true;
  }
  function persist(doc: DiscoveryNotebook, reset: boolean): void {
    const raw = encodeNotebook(doc, manifest);
    attemptedRaw = raw;
    let result: ReturnType<NotebookStoragePort["write"]>;
    try {
      result = storage.write(raw);
    } catch {
      result = { status: "unavailable" };
    }
    if (result.status === "ok") expectedRaw = raw;
    publish({
      document: doc,
      resetSequence: view.resetSequence + (reset ? 1 : 0),
      message:
        result.status === "ok"
          ? "Recorded notes saved on this device. Draft fields are not saved."
          : "Recorded in this tab, but device storage did not save it. Export before leaving; an older saved version may return after reload.",
    });
  }
  function change(update: (doc: DiscoveryNotebook) => DiscoveryNotebook, reset = false): boolean {
    imports.invalidate();
    if (!view.ready || view.blocked) return false;
    try {
      const next = update(view.document);
      if (!unchanged()) return false;
      persist(next, reset);
      return true;
    } catch (error) {
      publish({ message: error instanceof Error ? error.message : "The notes were not changed." });
      return false;
    }
  }
  return Object.freeze({
    load,
    getSnapshot: () => view,
    getServerSnapshot: () => server,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    capture: (stageId: string, prediction: string, alternativeId: string | null) =>
      change((doc) => recordPrediction(doc, manifest, stageId, prediction, alternativeId)),
    observe: (stageId: string, attemptIndex: number, observation: string) =>
      change((doc) => recordObservation(doc, manifest, stageId, attemptIndex, observation)),
    exportNotes: () => encodeNotebook(view.document, manifest),
    beginImport: imports.begin,
    invalidateImport: imports.invalidate,
    completeImport(token: number, raw: string): boolean {
      if (!imports.current(token)) return false;
      return change(() => decodeNotebook(raw, manifest), true);
    },
    importFailed(token: number, message: string) {
      if (!imports.current(token)) return;
      imports.invalidate();
      publish({ message });
    },
    /** Only call after a reader explicitly confirms replacement of this guide's stored notes. */
    startOver() {
      if (!view.ready) return;
      imports.invalidate();
      const raw = read();
      expectedRaw = raw.status === "ok" ? (raw.value ?? null) : null;
      publish({ blocked: false, retainedRaw: null });
      persist(emptyNotebook(manifest), true);
    },
  });
}
export type NotebookSession = ReturnType<typeof createNotebookSession>;
