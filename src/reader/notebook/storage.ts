import { createMigrationChain, migrateDocument } from "../../platform/storage/migrations.ts";
import { quarantine } from "../../platform/storage/quarantine.ts";
import { createStorageContext, readRaw, type StorageContext, writeDocument } from "../../platform/storage/store.ts";
import type { NotebookStorage } from "./notebookStore.ts";
import { NOTEBOOK_KEY } from "./schema.ts";

const migrations = createMigrationChain(1);
/** Reuse the site's key ownership, forward migrations, quarantine and session fallback. */
export function createNotebookStorage(context: StorageContext = createStorageContext()): NotebookStorage {
  const registration = context.registry.get(NOTEBOOK_KEY);
  if (!registration || registration.kind !== "document" || registration.ownerBeadId !== "am-read-notebook-tde")
    throw new Error("The reading notebook requires its registered storage namespace.");
  return Object.freeze({
    maxBytes: registration.maxBytes,
    read: () => readRaw(context, NOTEBOOK_KEY),
    write: (document) => writeDocument(context, NOTEBOOK_KEY, document),
    decode: (raw: string) => migrateDocument(migrations, JSON.parse(raw)),
    preserve: (raw: string) => { quarantine(context, NOTEBOOK_KEY, raw, "invalid-notebook-document"); },
    discardFallback: () => { context.fallback.delete(NOTEBOOK_KEY); },
  } satisfies NotebookStorage);
}
