import { DISCOVERY_NOTE_KEYS } from "../platform/storage/keys.ts";
import {
  createStorageContext,
  readRaw,
  writeRaw,
  type CreateStorageContextOptions,
} from "../platform/storage/store.ts";
import type { NoteManifest } from "./notebook.ts";
import { createNotebookSession } from "./notebookSession.ts";

/** The same storage adapter is used by the browser and integration tests.
 * Construction does not touch window/localStorage; reads begin at session.load().
 */
export function createStoredNotebookSession(
  manifest: NoteManifest,
  options: CreateStorageContextOptions = {},
) {
  const context = createStorageContext(options);
  const key = DISCOVERY_NOTE_KEYS[manifest.paper];
  return createNotebookSession(manifest, {
    read: () => readRaw(context, key),
    write: (raw) => writeRaw(context, key, raw),
  });
}
