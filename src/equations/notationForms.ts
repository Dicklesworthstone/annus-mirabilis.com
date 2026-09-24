/**
 * EINSTEIN'S LETTERS FOR ONE FORMULA (am-read-perspective-toggle-abd, the notation toggle).
 *
 * A formula is drawn from its expression tree with a glyph table: quantity id to letter
 * (expressionLatex). The explanation faces' tables print the modern letters (special relativity's
 * records declare "modern-pedagogical": c, gamma). The paper's notation concordance records, per
 * section, the letter Einstein printed for a quantity and the rename that gives the modern one (V
 * to c, beta to gamma). So the printed form is the same tree drawn with the concordance's printed
 * letters in place: a re-render, never a substitution on LaTeX, and never a change of binding.
 *
 * No formula mixes notations (ruling (c) on the bead). A formula is drawn in Einstein's letters
 * only when every symbol it binds resolves cleanly; one symbol that does not keeps the WHOLE
 * formula in today's letters, and the reader is told so in one line. A symbol resolves when:
 * - exactly one entry bound to its quantity (and to its component, where Einstein printed one
 *   letter per component: X, Y, Z for the electric force) applies in the section;
 * - that entry is a rename, and its modern letter is the one the record prints;
 * - what Einstein printed is one letter. Where he wrote a factor out (1/sqrt(1 - v^2/V^2) for
 *   gamma in the mass-energy paper) or a difference (K_0 - K_1), putting it in a symbol's place
 *   can drop the brackets its meaning needs;
 * - its quantity has no electric-current dimension. The records are SI and Einstein's
 *   electrodynamics is Gaussian (section 6 prints Y' = beta(Y - v/V N)), so an SI formula in his
 *   letters would be neither his formula nor ours.
 * Nothing here ever matches a quantity to an entry by its letter: that is how kinetic energy's K
 * came to be drawn as the stationary system's modern S.
 */
import { scopeMatches } from "../content/notation/resolve.ts";
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";
import { type Expression, walk } from "./ast.ts";
import type { QuantityRegistry } from "./quantities.ts";

type Letter = Readonly<{ latex: string; unicode: string; entryId: string }>;

/** Quantity id to the letter Einstein printed for it here; a component label is kept (t_0). */
export type PrintedLetters = Readonly<Record<string, Letter>>;

/**
 * `quantityId#index` to the letter Einstein printed for that one component, which replaces the
 * modern letter AND its component label: E with index y is drawn Y, not Y_y.
 */
export type ComponentLetters = Readonly<Record<string, Letter>>;

/** Why a symbol keeps a formula in today's letters. */
export type UnprintedReason =
  | "no-entry"
  | "ambiguous"
  | "not-a-rename"
  | "target-differs"
  | "not-a-letter"
  | "electromagnetic-units";

export type Unprinted = Readonly<{
  quantityId: string;
  index?: string | undefined;
  reason: UnprintedReason;
}>;

/**
 * "printed": every symbol resolved, and the letters that differ from today's are listed (both
 * lists may be empty when Einstein's letters are today's). "modern": at least one symbol did not
 * resolve, so no letter changes.
 */
export type PrintedForm =
  | Readonly<{ state: "printed"; letters: PrintedLetters; components: ComponentLetters }>
  | Readonly<{ state: "modern"; unprinted: readonly Unprinted[] }>;

export const componentKey = (quantityId: string, index: string): string => `${quantityId}#${index}`;

function modernTarget(entry: ConcordanceEntry): string | undefined {
  if (entry.operation.kind !== "rename") return undefined;
  const target = entry.operation.target as { modernGlyph?: unknown };
  const glyph = target.modernGlyph;
  if (typeof glyph === "string") return glyph;
  if (glyph && typeof glyph === "object") {
    const g = glyph as { latex?: unknown; unicode?: unknown };
    return typeof g.latex === "string"
      ? g.latex
      : typeof g.unicode === "string"
        ? g.unicode
        : undefined;
  }
  return undefined;
}

/** E'_{y} and E'_y are one letter: braces around a one-token subscript carry nothing. */
const sameLetter = (a: string, b: string): boolean =>
  a.replace(/_\{([^{}]+)\}/g, "_$1") === b.replace(/_\{([^{}]+)\}/g, "_$1");

/**
 * One letter: a Latin letter or a command (\beta, \mathfrak{B}), with primes and at most one
 * subscript (t'_A). Not a fraction, a product or a difference.
 */
const LETTER =
  /^(?:\\math[a-z]+\{[A-Za-z]\}|\\[A-Za-z]+|[A-Za-z])'*(?:_(?:\{[A-Za-z0-9]+\}|\\[A-Za-z]+|[A-Za-z0-9]))?'*$/;

const indexOf = (entry: ConcordanceEntry): string | undefined =>
  "quantityId" in entry.binding ? entry.binding.index : undefined;

/**
 * Einstein's letters for `tree` in `section`, or the reasons it keeps today's. `table` is the
 * record's own table: the letters the formula prints now, after any per-record override.
 */
export function printedForm(
  tree: Expression,
  table: QuantityRegistry,
  entries: readonly ConcordanceEntry[],
  section: string,
): PrintedForm {
  const letters: Record<string, Letter> = {};
  const components: Record<string, Letter> = {};
  const unprinted: Unprinted[] = [];
  const seen = new Set<string>();

  for (const node of walk(tree)) {
    if (node.kind !== "symbol") continue;
    const { quantityId, index } = node;
    const key = index === undefined ? quantityId : componentKey(quantityId, index);
    if (seen.has(key)) continue;
    seen.add(key);
    const refuse = (reason: UnprintedReason) =>
      unprinted.push({ quantityId, ...(index === undefined ? {} : { index }), reason });

    const quantity = table[quantityId];
    if (quantity === undefined) {
      refuse("no-entry");
      continue;
    }
    if ((quantity.dimension[4] ?? "0") !== "0") {
      refuse("electromagnetic-units");
      continue;
    }

    const here = entries.filter(
      (e) =>
        "quantityId" in e.binding &&
        e.binding.quantityId === quantityId &&
        scopeMatches(e.scope, section, section),
    );
    // A component Einstein printed as its own letter is found by its index. Any other label
    // (t_0, a summation index) sits on the quantity's own letter, so the unindexed entry applies.
    const component = index === undefined ? [] : here.filter((e) => indexOf(e) === index);
    const asComponent = component.length > 0;
    const candidates = asComponent ? component : here.filter((e) => indexOf(e) === undefined);
    if (candidates.length === 0) {
      refuse("no-entry");
      continue;
    }
    if (candidates.length > 1) {
      refuse("ambiguous");
      continue;
    }
    const entry = candidates[0] as ConcordanceEntry;
    const target = modernTarget(entry);
    if (target === undefined) {
      refuse("not-a-rename");
      continue;
    }
    const modern = asComponent ? `${quantity.glyph}_{${index}}` : quantity.glyph;
    if (!sameLetter(target, modern)) {
      refuse("target-differs");
      continue;
    }
    if (entry.glyph.latex === modern) continue;
    if (!LETTER.test(entry.glyph.latex)) {
      refuse("not-a-letter");
      continue;
    }
    const letter = { latex: entry.glyph.latex, unicode: entry.glyph.unicode, entryId: entry.id };
    if (asComponent) components[key] = letter;
    else letters[quantityId] = letter;
  }

  return unprinted.length > 0
    ? { state: "modern", unprinted }
    : { state: "printed", letters, components };
}
