/**
 * The predict gate's port (predictPersistence.ts) backed by the reader's local store, the
 * am:predictions:v1 document and the predict-entry setting. This is the behaviour PredictGate.tsx
 * had inline until the embed boundary test found it reachable from /embed/ (TanElk 39076).
 *
 * Every call opens its own storage context. A blocked or full store leaves this visit's answer in
 * memory, and the result still shows.
 */
import { createStorageContext } from "../../platform/storage/store.ts";
import { resolveEffectivePredictEntry } from "./predictEntry.ts";
import type { PredictPersistence } from "./predictPersistence.ts";
import {
  getEntryOverride,
  hasVisited,
  markVisited,
  type PredictionsDocumentV1,
  readPredictionsDocument,
  recordPrediction,
  recordUnrecordedStatus,
  writePredictionsDocument,
} from "./predictStorage.ts";

function persist(update: (doc: PredictionsDocumentV1) => PredictionsDocumentV1): void {
  const ctx = createStorageContext();
  writePredictionsDocument(ctx, update(readPredictionsDocument(ctx)));
}

export const LOCAL_PREDICT_PERSISTENCE: PredictPersistence = Object.freeze({
  asks(labId: string, promptIds: readonly string[]): boolean {
    const ctx = createStorageContext();
    const doc = readPredictionsDocument(ctx);
    const entry = resolveEffectivePredictEntry(ctx, getEntryOverride(doc, labId)).choice;
    return entry === "predict-first" && !promptIds.some((id) => hasVisited(doc, labId, id));
  },
  record(labId, promptId, choice) {
    persist((doc) => recordPrediction(markVisited(doc, labId, promptId), labId, promptId, choice));
  },
  keep(labId, promptId) {
    persist((doc) =>
      recordUnrecordedStatus(
        markVisited(doc, labId, promptId),
        labId,
        promptId,
        "predicted-unrecorded",
      ),
    );
  },
  skip(labId, promptId) {
    persist((doc) =>
      recordUnrecordedStatus(markVisited(doc, labId, promptId), labId, promptId, "skipped"),
    );
  },
});
