/**
 * Misconceptions at the compiler boundary. Until 2026-09-24 the reading compiler rejected every
 * misconception as an unknown reading record and the production compiler passed them through
 * unchecked, so none could exist. Both compilers now call this, so a record one of them admits
 * the other cannot refuse.
 *
 * Editorial notes are NOT checked here, because the codebase holds two shapes for one: the
 * EditorialNote schema (src/content/schemas/source.ts), whose `kind` is the note's kind and whose
 * author is an authorship entry with an id, which the faces render; and the shape the structural
 * and epistemic checks and their tests read (`kind: "editorial-note"`, `noteKind`, `paper`, an
 * author with a name). Validating one here breaks the other's tests. Until that is decided both
 * compilers admit a note as they find it, and the paper page validates the notes it renders
 * against the schema (src/reader/paperMargins.ts).
 */
import { validateMisconception } from "../schemas/argument.ts";
import { ContentError } from "./loaders.ts";

/** Throws unless the misconception is valid under its schema and its id and paper agree with the
 * path it sits at. */
export function checkMisconceptionRecord(
  parsed: unknown,
  path: string,
  params: Readonly<{ id?: string | undefined; paper?: string | undefined }>,
): void {
  const record = validateMisconception(parsed, path);
  if (record.id !== params.id || (params.paper !== undefined && record.paper !== params.paper))
    throw new ContentError("path-identity", path, "Record identity disagrees with its file path.");
}
