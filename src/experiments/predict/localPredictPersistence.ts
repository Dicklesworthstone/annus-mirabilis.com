/**
 * The predict gate's port backed by this browser's local store. Embeds never import this module.
 * A failed save remains readable in this persistence instance for the visit. Each explicit action
 * writes only its own prompt over fresh saved data. Older pending answers are never retried by
 * an unrelated action: another tab may have cleared them while their durable key was absent.
 */
import { quarantine } from "../../platform/storage/quarantine.ts";
import { createStorageContext, type StorageContext } from "../../platform/storage/store.ts";
import { resolveEffectivePredictEntry } from "./predictEntry.ts";
import type { PredictPersistence } from "./predictPersistence.ts";
import {
  clearPrediction,
  decodePredictionsDocument,
  emptyPredictionsDocument,
  getEntryOverride,
  getStoredPrompt,
  hasVisited,
  markVisited,
  PREDICTIONS_NAMESPACE,
  type PredictionsDocumentV1,
  recordPrediction,
  recordUnrecordedStatus,
  type StoredPromptEntry,
  writePredictionsDocument,
} from "./predictStorage.ts";

type SavedPredictions = Readonly<{ raw: string | null; document: PredictionsDocumentV1 }>;
type PendingPrompt = Readonly<{
  labId: string;
  promptId: string;
  after: StoredPromptEntry | undefined;
  visited: boolean;
  apply: (document: PredictionsDocumentV1) => PredictionsDocumentV1;
}>;

function samePrompt(a: StoredPromptEntry | undefined, b: StoredPromptEntry | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Construction never touches browser storage, including during static rendering. */
export function createLocalPredictPersistence(injected?: StorageContext): PredictPersistence {
  let context = injected;
  let lastSaved: PredictionsDocumentV1 | undefined;
  let unreadableRaw: string | undefined;
  const pending = new Map<string, PendingPrompt>();

  function browserContext(): StorageContext | undefined {
    if (context) return context;
    if (typeof window === "undefined") return undefined;
    context = createStorageContext();
    return context;
  }

  function readSaved(ctx: StorageContext): SavedPredictions | undefined {
    let raw: string | null;
    try {
      const backend = ctx.backend();
      if (!backend) return undefined;
      raw = backend.getItem(PREDICTIONS_NAMESPACE);
    } catch {
      return undefined;
    }
    try {
      const document = raw === null ? emptyPredictionsDocument() : decodePredictionsDocument(raw);
      unreadableRaw = undefined;
      return { raw, document };
    } catch {
      // Keep the original in place when its schema cannot be read; a session answer cannot
      // authorize replacing it. Preserve one recovery copy without filling quarantine on reads.
      if (raw !== null && raw !== unreadableRaw) {
        quarantine(ctx, PREDICTIONS_NAMESPACE, raw, "invalid-predictions-document");
        unreadableRaw = raw;
      }
      return undefined;
    }
  }

  function refresh() {
    const ctx = browserContext();
    const saved = ctx ? readSaved(ctx) : undefined;
    if (saved) lastSaved = saved.document;
    let document = saved?.document ?? lastSaved ?? emptyPredictionsDocument();
    for (const [id, change] of pending) {
      if (
        saved &&
        samePrompt(getStoredPrompt(saved.document, change.labId, change.promptId), change.after) &&
        (!change.visited || hasVisited(saved.document, change.labId, change.promptId))
      ) {
        pending.delete(id);
        continue;
      }
      document = change.apply(document);
    }
    if (ctx) {
      if (pending.size) ctx.fallback.set(PREDICTIONS_NAMESPACE, JSON.stringify(document));
      else ctx.fallback.delete(PREDICTIONS_NAMESPACE);
    }
    return { ctx, saved, document };
  }

  function persist(
    labId: string,
    promptId: string,
    update: (document: PredictionsDocumentV1) => PredictionsDocumentV1,
  ): void {
    const current = refresh();
    if (!current.ctx) return;
    const desired = update(current.document);
    const visited = hasVisited(desired, labId, promptId);
    const id = JSON.stringify([labId, promptId]);
    pending.set(id, {
      labId,
      promptId,
      after: getStoredPrompt(desired, labId, promptId),
      visited,
      apply: (document) => update(visited ? markVisited(document, labId, promptId) : document),
    });

    const next = refresh();
    const requested = pending.get(id);
    if (!next.ctx || !next.saved || !requested) return;
    // Consent belongs to this prompt's fresh action. Keep every other pending answer in memory;
    // even a currently missing key may have been explicitly cleared in another document.
    const document = requested.apply(next.saved.document);
    // This is an optimistic comparison, not an atomic cross-tab transaction. Check again at the
    // write, including when a background tab has not received its storage event yet.
    try {
      if (next.ctx.backend()?.getItem(PREDICTIONS_NAMESPACE) !== next.saved.raw) {
        refresh();
        return;
      }
    } catch {
      return;
    }
    const result = writePredictionsDocument(next.ctx, document);
    if (result.status === "ok") {
      pending.delete(id);
      lastSaved = document;
    }
    // writeDocument clears its fallback on success and replaces it on failure. Rebuild this
    // context's recovery copy without writing any of its other pending answers to storage.
    refresh();
  }

  return Object.freeze({
    asks(labId: string, promptIds: readonly string[]): boolean {
      const { ctx, document } = refresh();
      if (!ctx) return true;
      const entry = resolveEffectivePredictEntry(ctx, getEntryOverride(document, labId)).choice;
      return entry === "predict-first" && !promptIds.some((id) => hasVisited(document, labId, id));
    },
    record(labId, promptId, choice) {
      persist(labId, promptId, (document) =>
        recordPrediction(markVisited(document, labId, promptId), labId, promptId, choice),
      );
    },
    keep(labId, promptId) {
      persist(labId, promptId, (document) =>
        recordUnrecordedStatus(
          markVisited(document, labId, promptId),
          labId,
          promptId,
          "predicted-unrecorded",
        ),
      );
    },
    skip(labId, promptId) {
      persist(labId, promptId, (document) =>
        recordUnrecordedStatus(markVisited(document, labId, promptId), labId, promptId, "skipped"),
      );
    },
    read(labId, promptId) {
      return getStoredPrompt(refresh().document, labId, promptId)?.prediction;
    },
    clear(labId, promptId) {
      persist(labId, promptId, (document) => clearPrediction(document, labId, promptId));
    },
  } satisfies PredictPersistence);
}

export const LOCAL_PREDICT_PERSISTENCE = createLocalPredictPersistence();
