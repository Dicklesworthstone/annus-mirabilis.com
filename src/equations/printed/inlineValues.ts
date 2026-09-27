/**
 * A NUMBER THE PAPER PRINTS IN ITS PROSE, AND WHAT IT IS THE VALUE OF (dispatch 302).
 *
 * The last hole in the inline surface. Five formulas across the four papers carry no bound term and
 * no label, and every one of them is a bare numeral printed in a sentence: "6 · 10²³", "2/3",
 * "1,9 · 10⁻⁵". A reader pointing at one of them gets nothing back, because there is no letter in it
 * to bind.
 *
 * A VALUE IS NOT A TERM, and the distinction is the whole reason this module exists. A term says the
 * atom IS the quantity: its glyph joins `InlineQuantityUse.glyphs` and the coloured census. The
 * number 6 · 10²³ is not N, it is what the paper assigns to N in one sentence, so marking it a term
 * would put a numeral in N's list of printed glyphs and count it as a coloured symbol. Both would be
 * false, and the census is quoted to the owner. A value therefore names the quantity it is a value
 * of WITHOUT claiming to be it: a reader pointing at the number sees that quantity's symbol light,
 * and the counts stay honest because values are counted apart.
 *
 * A VALUE IS NOT AN EXCEPTION EITHER. An exception declares a glyph left plain with a reason
 * (inlineExceptions.ts). These are not left plain: they carry a note, and mostly a quantity.
 *
 * `quantityId` IS OPTIONAL, and that is a finding rather than a convenience. Of the five, "2/3" is
 * the ratio of two energies and is the value of neither; naming a quantity for it would have to name
 * one of the two and would be wrong. A record with no quantity carries its note alone.
 *
 * NOTHING HERE IMPORTS THE QUANTITY REGISTRY, for the reason inlineExceptions.ts gives at length: a
 * module a route imports must not reach content/quantities/registry.ts, directly or through one hop,
 * or `next build` fails to resolve it. So a quantity id is checked for SHAPE here and for EXISTENCE
 * by the caller that already holds the registry (paperInlines.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";

export const INLINE_VALUES_PATH = join("content", "inline-terms", "printed-values.yaml");

/** A number printed in a paper's prose, with what it is the value of. */
export type InlineValue = Readonly<{
  paper: string;
  /** The paragraph anchor the number is printed in, as the reading faces scope their formulas. */
  anchor: string;
  /** The formula exactly as the face prints it: these are whole formulas, not atoms. */
  latex: string;
  /** The quantity whose symbol it lights. Absent where the sentence supports none. */
  quantityId?: string | undefined;
  /** What the number is, in the reader's words. Always present. */
  note: string;
}>;

export type InlineValuesCode =
  | "inline-values-not-a-list"
  | "inline-values-no-paper"
  | "inline-values-no-anchor"
  | "inline-values-no-latex"
  | "inline-values-no-note"
  | "inline-values-note-too-short"
  | "inline-values-quantity-not-an-id"
  | "inline-values-duplicate";

export class InlineValuesError extends Error {
  readonly code: InlineValuesCode;
  constructor(code: InlineValuesCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "InlineValuesError";
    this.code = code;
  }
}

/**
 * The shortest note that can say what a number is. "The value of N" names the quantity again and
 * tells a reader nothing they did not have; the five written notes run from 120 to 300 characters.
 * The floor is here so a later record cannot be filled in with a word.
 */
const NOTE_FLOOR = 40;

const isPlainString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** The listed values, each checked: a paper, an anchor, a formula, and a note that says something. */
export function parseInlineValues(raw: unknown, where: string): readonly InlineValue[] {
  const list = (raw as { values?: unknown } | null)?.values;
  if (!Array.isArray(list))
    throw new InlineValuesError("inline-values-not-a-list", `${where}: values must be a list.`);
  const seen = new Set<string>();
  return list.map((item, i) => {
    const at = `${where} values[${i}]`;
    const v = item as Record<string, unknown>;
    if (!isPlainString(v.paper))
      throw new InlineValuesError("inline-values-no-paper", `${at}: a paper is required.`);
    if (!isPlainString(v.anchor))
      throw new InlineValuesError(
        "inline-values-no-anchor",
        `${at}: an anchor is required, naming the paragraph the number is printed in.`,
      );
    if (!isPlainString(v.latex))
      throw new InlineValuesError(
        "inline-values-no-latex",
        `${at}: the formula is required, exactly as the face prints it.`,
      );
    if (!isPlainString(v.note))
      throw new InlineValuesError(
        "inline-values-no-note",
        `${at}: a note is required. A value with nothing to say about it is an exception, not a value.`,
      );
    if (v.note.trim().length < NOTE_FLOOR)
      throw new InlineValuesError(
        "inline-values-note-too-short",
        `${at}: the note is ${v.note.trim().length} characters and must be at least ${NOTE_FLOOR}. Say what the number is, not which quantity it belongs to.`,
      );
    if (v.quantityId !== undefined && !/^[a-z][A-Za-z0-9]*$/.test(String(v.quantityId)))
      throw new InlineValuesError(
        "inline-values-quantity-not-an-id",
        `${at}: ${JSON.stringify(v.quantityId)} is not a canonical quantity id. Leave it out where the sentence supports no quantity.`,
      );
    const key = `${v.paper}\u0000${v.anchor}\u0000${v.latex}`;
    if (seen.has(key))
      throw new InlineValuesError(
        "inline-values-duplicate",
        `${at}: ${v.paper} ${v.anchor} ${JSON.stringify(v.latex)} is listed twice, and two notes for one number cannot both be shown.`,
      );
    seen.add(key);
    return Object.freeze({
      paper: v.paper,
      anchor: v.anchor,
      latex: v.latex,
      ...(v.quantityId === undefined ? {} : { quantityId: String(v.quantityId) }),
      note: v.note.trim(),
    });
  });
}

/** Every listed value, or none where the file is absent. */
export function loadInlineValues(root: string): readonly InlineValue[] {
  const path = join(root, INLINE_VALUES_PATH);
  if (!existsSync(path)) return [];
  return parseInlineValues(
    strictParse(readFileSync(path, "utf8"), "yaml", path),
    INLINE_VALUES_PATH,
  );
}

/** The values of one paper, keyed by anchor and latex, as the resolver looks them up. */
export function inlineValuesByScope(
  values: readonly InlineValue[],
  paper: string,
): ReadonlyMap<string, InlineValue> {
  const out = new Map<string, InlineValue>();
  for (const v of values) if (v.paper === paper) out.set(`${v.anchor}\u0000${v.latex}`, v);
  return out;
}
