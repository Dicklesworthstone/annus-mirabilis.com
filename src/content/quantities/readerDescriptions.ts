/**
 * WHAT A QUANTITY IS, IN A READER'S WORDS (dispatch 250): content/reader-descriptions/quantities.yaml.
 *
 * A printed display's inspector (src/equations/printed/paperDisplays.ts) shows this line where no
 * model record linked to the display says what a term does. The registry's `description` is the
 * authors' note, and most of those read "Paper 2 section 3's printed l" or name the ids a quantity
 * must not be confused with, which is right for an author choosing an id and wrong for a reader.
 *
 * The file lives outside content/quantities/, because the registry loads every YAML file there
 * (and in its subdirectories) as quantity records.
 *
 * EXACT IDS. A key must be a registered quantity id, by exact equality, as everywhere else.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";

export const READER_DESCRIPTIONS_PATH = join("content", "reader-descriptions", "quantities.yaml");

export class ReaderDescriptionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[reader-descriptions] ${message} (${code})`);
    this.name = "ReaderDescriptionError";
    this.code = code;
  }
}

/**
 * The author's shorthand a reader should never meet, found by the token it leaves: a camelCase id
 * ("radiationPressureMirror"), an underscore spelling ("p_nu", "k_B"), a file name, the registry's
 * own talk ("binds", "this id"), or a paper named by its number ("Paper 2").
 */
const SHORTHAND: readonly (readonly [RegExp, string])[] = [
  [/\b[a-z]+[A-Z]\w*/, "a camelCase id"],
  [/\w_\w/, "an underscore spelling"],
  [/\.ya?ml\b/, "a file name"],
  [/\bbinds?\b|\bthis id\b/i, "the registry's own wording"],
  [/\b[Pp]aper \d\b/, "a paper named by its number"],
];

/** Where a description reads as an author's note: what gave it away, and the text that did. */
export function shorthandIn(text: string): string | undefined {
  for (const [pattern, what] of SHORTHAND) {
    const found = pattern.exec(text);
    if (found) return `${what} ("${found[0]}")`;
  }
  return undefined;
}

/**
 * The parsed file, each description checked: an object `quantities` mapping registered ids to
 * non-empty text without shorthand. Every problem is refused by name, with the id.
 */
export function parseReaderDescriptions(
  raw: unknown,
  isRegistered: (quantityId: string) => boolean,
): ReadonlyMap<string, string> {
  const quantities = (raw as { quantities?: unknown } | null)?.quantities;
  if (!quantities || typeof quantities !== "object" || Array.isArray(quantities))
    throw new ReaderDescriptionError(
      "reader-descriptions-invalid-file",
      `${READER_DESCRIPTIONS_PATH} must hold one object, quantities, mapping quantity ids to text.`,
    );
  const out = new Map<string, string>();
  for (const [id, value] of Object.entries(quantities)) {
    if (!isRegistered(id))
      throw new ReaderDescriptionError(
        "reader-description-unknown-quantity",
        `"${id}" is not a registered quantity id (content/quantities/).`,
      );
    if (typeof value !== "string" || !value.trim())
      throw new ReaderDescriptionError(
        "reader-description-blank",
        `${id}: the description must be a non-empty string.`,
      );
    const shorthand = shorthandIn(value);
    if (shorthand)
      throw new ReaderDescriptionError(
        "reader-description-shorthand",
        `${id}: the description holds ${shorthand}, an author's note rather than a reader's sentence.`,
      );
    out.set(id, value.trim());
  }
  return out;
}

/** The repository's reader descriptions, or an empty map where the file does not exist. */
export function loadReaderDescriptions(
  root: string,
  isRegistered: (quantityId: string) => boolean,
): ReadonlyMap<string, string> {
  const path = join(root, READER_DESCRIPTIONS_PATH);
  if (!existsSync(path)) return new Map();
  return parseReaderDescriptions(parseYaml(readFileSync(path, "utf8")), isRegistered);
}
