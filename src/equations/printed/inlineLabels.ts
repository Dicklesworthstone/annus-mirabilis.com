/**
 * THE NAMES A PAPER PRINTS, AND THE ID EVERY RENDERER GIVES THEM (dispatch 280, step 1b).
 *
 * The owner: "all the equations must be colored, and all must have the nice hover-over effects".
 * A letter the notation declares no quantity, a point A, an axis X, a system K, a sign such as π,
 * has no colour to take, so it keeps the ink and takes a note instead: pointing at it lights every
 * copy of the SAME READING IN THE SAME SECTION, and pressing it says what it names.
 *
 * ONE ID, COMPUTED THE SAME WAY BY EVERY PATH. A reading face resolves its formulas at build time
 * (paperInlines.ts) and an explanation panel resolves its own as the page renders
 * (explanationInlines.ts), yet both print on one page: relativity's § 8 prints k in the source
 * paragraph and again in the explanation under its display, and pointing at either must light both.
 * So the id is DERIVED from the reading and the section, never counted: a counter would number the
 * same reading differently in two passes, and the two halves of the page would not know each other.
 *
 * The note is the concordance's own meaning for a declared entry, and the listed sign's note for an
 * exception (content/inline-terms/exceptions.yaml). Both are read here, so a name the reader points
 * at on any page of a paper says the same thing.
 */
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { normalizeSectionId } from "../../content/notation/resolve.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
/** The name a display-terms sign is read under (equationExplanations.ts gives its entry this id). */
export const signSource = (glyph: string): string => `display-terms sign ${glyph}`;

import { loadDisplayTerms } from "./displayTerms.ts";
import type { InlineException } from "./inlineTerms.ts";
import { loadInlineExceptions } from "./paperInlines.ts";

/**
 * The id of one reading of a name in one section. Short, because it is printed once per marked
 * letter on faces held to a byte budget, and stable, because two independent passes must agree.
 * djb2 over the pair, in base 36: inlineLabels.test.ts holds it to both properties.
 */
export function inlineLabelId(source: string, section: string): string {
  let hash = 5381;
  const key = `${source}\u0000${section}`;
  for (let i = 0; i < key.length; i++) hash = (Math.imul(hash, 33) ^ key.charCodeAt(i)) >>> 0;
  return `L${hash.toString(36)}`;
}

/** The section a scope entry holds in: its own, or the one its paragraph belongs to. */
function sectionOf(scope: string): string | undefined {
  return (
    /^s\d+$/.exec(normalizeSectionId(scope))?.[0] ?? /^s\d+/.exec(normalizeSectionId(scope))?.[0]
  );
}

/** Every section the paper's concordance scopes an entry to, in printed order. */
export function paperSections(concordance: readonly ConcordanceEntry[]): readonly string[] {
  const seen = new Set<string>();
  for (const entry of concordance)
    for (const scope of entry.scope) {
      const section = sectionOf(scope);
      if (section) seen.add(section);
    }
  return [...seen].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

/**
 * What each name says, by id: every reading the paper's notation declares no quantity, and every
 * listed sign, in each section it holds in. The whole set, not only the names one page happens to
 * print, so any page can say what the reader points at.
 *
 * `exceptions` is the whole list as the resolver reads it (loadInlineExceptions), because a
 * listed sign is named by its place in that list, as inlineTerms.ts names it.
 *
 * `signs` are the glyphs a paper's display-terms file declares no quantity, which an explanation
 * panel reads before the paper's own notation (equationExplanations.ts). Each says what the
 * concordance or the listed exception already says of that glyph where either does, so one sign
 * does not say two things on one page, and its own reason only where neither does.
 */
export function inlineLabelNotes(
  paper: string,
  concordance: readonly ConcordanceEntry[],
  exceptions: readonly InlineException[],
  signs: readonly Readonly<{ glyph: string; reason: string }>[] = [],
): Readonly<Record<string, string>> {
  const sections = paperSections(concordance);
  const notes: Record<string, string> = {};
  const keyOf = new Map<string, string>();
  const add = (source: string, section: string, note: string) => {
    const id = inlineLabelId(source, section);
    const key = `${source}\u0000${section}`;
    const taken = keyOf.get(id);
    // Two readings under one id would light together and say one another's words.
    if (taken !== undefined && taken !== key)
      throw new Error(
        `inline-label-id-collision: ${paper} gives ${id} to both ${taken.replace("\u0000", " in ")} and ${key.replace("\u0000", " in ")}.`,
      );
    keyOf.set(id, key);
    notes[id] = note;
  };
  const placesOf = (scope: readonly string[]) =>
    scope.includes("all")
      ? sections
      : [...new Set(scope.flatMap((s) => sectionOf(s) ?? []))].filter((s) => s);
  for (const entry of concordance) {
    if ("quantityId" in entry.binding || !entry.meaning) continue;
    for (const section of placesOf(entry.scope)) add(entry.id, section, entry.meaning);
  }
  exceptions.forEach((exception, index) => {
    if (exception.paper !== paper || !exception.note) return;
    for (const section of placesOf(exception.scope))
      add(`exception ${index}`, section, exception.note);
  });
  // A sign a display-terms file declares: what the paper already says of that glyph in that
  // section, or, where nothing does, the file's own reason for declaring it.
  const saidOf = (glyph: string, section: string): string | undefined => {
    const listed = exceptions.find(
      (e) => e.paper === paper && e.glyph === glyph && placesOf(e.scope).includes(section),
    );
    if (listed?.note) return listed.note;
    const declared = concordance.find(
      (e) =>
        !("quantityId" in e.binding) &&
        e.glyph.latex === glyph &&
        e.meaning &&
        placesOf(e.scope).includes(section),
    );
    return declared?.meaning;
  };
  for (const sign of signs)
    for (const section of sections)
      add(signSource(sign.glyph), section, saidOf(sign.glyph, section) ?? sign.reason);
  return notes;
}

/**
 * What each name a paper prints says, read from the paper's own files: its notation concordance,
 * the listed signs, and the signs its display-terms file declares. Both islands call this, so a
 * name says the same thing under a paragraph and under the panel that explains it.
 */
export function paperLabelNotes(paper: string, root: string): Readonly<Record<string, string>> {
  const signs = loadDisplayTerms(root, paper)?.notQuantities ?? [];
  return inlineLabelNotes(
    paper,
    loadConcordanceForPaper(paper).entries,
    loadInlineExceptions(root),
    signs.map((sign) => ({ glyph: sign.glyph, reason: sign.reason })),
  );
}
