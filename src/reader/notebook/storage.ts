import { quarantine } from "../../platform/storage/quarantine.ts";
import {
  createStorageContext,
  type StorageContext,
  writeDocument,
} from "../../platform/storage/store.ts";
import { readNotebookDocument } from "./migrations/teachBack.ts";
import type { NotebookStorage } from "./notebookStore.ts";
import { NOTEBOOK_KEY } from "./schema.ts";

/** Reuse the site's key ownership, forward migrations, quarantine and session fallback. */
export function createNotebookStorage(
  context: StorageContext = createStorageContext(),
): NotebookStorage {
  const registration = context.registry.get(NOTEBOOK_KEY);
  if (
    !registration ||
    registration.kind !== "document" ||
    registration.ownerBeadId !== "am-read-notebook-tde"
  )
    throw new Error("The reading notebook requires its registered storage namespace.");
  return Object.freeze({
    maxBytes: registration.maxBytes,
    read: () => {
      // Conflict detection must see a real deletion, not readRaw's session fallback.
      // The notebook store already retains unsaved work in its own immutable document.
      const backend = context.backend();
      if (!backend) return { status: "unavailable" };
      try {
        const value = backend.getItem(NOTEBOOK_KEY);
        return value === null ? { status: "missing" } : { status: "ok", value };
      } catch {
        return { status: "unavailable" };
      }
    },
    write: (document) => writeDocument(context, NOTEBOOK_KEY, document),
    decode: (raw: string) => readNotebookDocument(JSON.parse(raw)),
    preserve: (raw: string) => {
      quarantine(context, NOTEBOOK_KEY, raw, "invalid-notebook-document");
    },
    discardFallback: () => {
      context.fallback.delete(NOTEBOOK_KEY);
    },
  } satisfies NotebookStorage);
}
