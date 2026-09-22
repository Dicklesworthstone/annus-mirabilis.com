import {
  exportRelativitySession,
  importRelativitySession,
  RELATIVITY_IMPORT_LIMIT,
  RELATIVITY_SESSION_VERSION,
  type RelativitySession,
  type SessionDecode,
} from "./specialRelativitySession.ts";

export const RELATIVITY_FILE_BYTE_LIMIT = RELATIVITY_IMPORT_LIMIT * 4;

/** Native File implements this interface; no filesystem or network access is required. */
export type LocalRelativityFile = Readonly<{
  size: number;
  text(): Promise<string>;
}>;

/** Private exports deliberately include notes and predictions. Public links use a
 * different owner (encodeRelativityLink) and never receive this payload.
 */
export function prepareRelativityDownload(session: RelativitySession) {
  return {
    filename: `special-relativity-investigation-v${RELATIVITY_SESSION_VERSION}.json`,
    mediaType: "application/json",
    text: exportRelativitySession(session),
  } as const;
}

/** Latest request wins, per workbench instance. Invalidate on edits, cancellation
 * and unmount. A late read or late failure must not replace a newer user's choice.
 * null means superseded, not an invalid file and never an empty valid session.
 */
export function createRelativityImportReader() {
  let generation = 0;
  return {
    invalidate(): void {
      generation += 1;
    },
    async read(file: LocalRelativityFile): Promise<SessionDecode | null> {
      const request = ++generation;
      if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > RELATIVITY_FILE_BYTE_LIMIT) {
        return { kind: "invalid", message: "This investigation file has an invalid or excessive size. No session was changed." };
      }
      try {
        const text = await file.text();
        if (request !== generation) return null;
        return importRelativitySession(text);
      } catch {
        if (request !== generation) return null;
        return { kind: "invalid", message: "The investigation file could not be read. No session was changed." };
      }
    },
  };
}
