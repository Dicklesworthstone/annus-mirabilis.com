import { DISCOVERY_NOTE_KEYS } from "../platform/storage/keys.ts";
import {
  type CreateStorageContextOptions,
  createStorageContext,
  writeRaw,
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
    read: () => {
      // The session retains unsaved notes itself. A fallback must never hide a real
      // external clear or make unavailable storage look safe to overwrite.
      const backend = context.backend();
      if (!backend) return { status: "unavailable" };
      try {
        const value = backend.getItem(key);
        return value === null ? { status: "missing" } : { status: "ok", value };
      } catch {
        return { status: "unavailable" };
      }
    },
    write: (raw) => writeRaw(context, key, raw),
  });
}
