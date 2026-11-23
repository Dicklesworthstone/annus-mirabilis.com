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
 *   letter per component: X, Y, Z for the electric force) applies in the section; an entry that
 *   records a printed number for the quantity is its value, not a letter, and is not counted;
 * - that entry is a rename, and its modern target or already printed letter is the record's;
 * - what Einstein printed is one letter, or an explicit, dimensionally consistent group pattern.
 *   A group is rendered as a parenthesized expression inside the original term, so a difference
 *   or radical keeps its meaning in a product, a negation and a power;
 * - its quantity has no electric-current dimension. The records are SI and Einstein's
 *   electrodynamics is Gaussian (section 6 prints Y' = beta(Y - v/V N)), so an SI formula in his
 *   letters would be neither his formula nor ours.
 * Nothing here ever matches a quantity to an entry by its letter: that is how kinetic energy's K
 * came to be drawn as the stationary system's modern S.
 */
import { scopeMatches } from "../content/notation/resolve.ts";
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";
import { type Expression, walk } from "./ast.ts";
import type { SymbolExpression } from "./latex/types.ts";
import { printedGroup } from "./notationGroups.ts";
import type { QuantityRegistry } from "./quantities.ts";

type Letter = Readonly<{
  latex: string;
  unicode: string;
  entryId: string;
  /** A display-only expansion; the semantic term, binding and value remain the record's. */
  expression?: SymbolExpression;
}>;

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
  | "unsupported-group"
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

/** E'_{y} and E'_y are one letter; E_{ab} and E_ab are not the same subscript. */
const normalizeLetter = (letter: string): string =>
  letter.replace(/_\{(\\[A-Za-z]+|[A-Za-z0-9])\}/g, "_$1");
const sameLetter = (a: string, b: string): boolean => normalizeLetter(a) === normalizeLetter(b);

/**
 * One letter: a Latin letter or a command (\beta, \mathfrak{B}), with primes and at most one
 * subscript (t'_A). Not a fraction, a product or a difference.
 */
const LETTER =
  /^(?:\\math[a-z]+\{[A-Za-z]\}|\\[A-Za-z]+|[A-Za-z])'*(?:_(?:\{[A-Za-z0-9]+\}|\\[A-Za-z]+|[A-Za-z0-9]))?'*$/;

const indexOf = (entry: ConcordanceEntry): string | undefined =>
  "quantityId" in entry.binding ? entry.binding.index : undefined;

/**
 * An entry whose printed glyph is a number records a value of its quantity, not a letter for it:
 * the Brownian paper's "k = 1,35 . 10⁻²" on p. 559 is bound to viscosity for its unit conversion.
 * It never competes with the entry that gives the quantity its letter (k), so it is not a
 * candidate; two entries that both print letters for one quantity are still ambiguous. A numeral
 * only: digits, separators, a product sign and a power of ten. "2\kappa" is a product of a number
 * and a letter, not a value, and stays a candidate.
 */
export const printsValue = (entry: ConcordanceEntry): boolean =>
  /^[0-9](?:[0-9.,{}\s]|\\cdot|\\times)*(?:\^\{-?[0-9]+\})?$/.test(entry.glyph.latex);

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
  const nodes = walk(tree);
  // Expanding gamma(u) would require an authored substitution for u inside the group. A group
  // with an index or function argument therefore stays modern, including a later occurrence of
  // a quantity already visited without that qualification.
  const qualified = new Set(
    nodes.flatMap((node) =>
      node.kind === "symbol" && (node.index !== undefined || node.at || node.args?.length)
        ? [node.quantityId]
        : [],
    ),
  );

  for (const node of nodes) {
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
        // A scaled printed quantity (L/2) is not another name for the whole quantity (L).
        // A scale on the AST node is already applied by the renderer and must not be doubled.
        (!e.binding.scale || (e.binding.scale.num === 1 && e.binding.scale.den === 1)) &&
        !printsValue(e) &&
        scopeMatches(e.scope, section, section),
    );
    // A component Einstein printed as its own letter is found by its index. Any other label
    // (t_0, a summation index) sits on the quantity's own letter, so the unindexed entry applies.
    const component = index === undefined ? [] : here.filter((e) => indexOf(e) === index);
    const asComponent = component.length > 0;
    const possible = asComponent ? component : here.filter((e) => indexOf(e) === undefined);
    const modern = asComponent ? `${quantity.glyph}_{${index}}` : quantity.glyph;
    // E and E_0 can name the same quantity in one section. The record's exact target decides
    // which rename is applicable, only AFTER quantity, component, scale and scope have matched.
    // Two entries with that same target are still ambiguous; a glyph never identifies a quantity.
    const matching = possible.filter((e) => {
      const target = modernTarget(e);
      return (target !== undefined && sameLetter(target, modern)) || sameLetter(e.glyph.latex, modern);
    });
    const candidates = possible.length > 1 && matching.length > 0 ? matching : possible;
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
    if (!sameLetter(target, modern) && !sameLetter(entry.glyph.latex, modern)) {
      refuse("target-differs");
      continue;
    }
    if (sameLetter(entry.glyph.latex, modern)) continue;
    let expression: SymbolExpression | undefined;
    if (!LETTER.test(entry.glyph.latex)) {
      if (entry.operation.kind !== "rename" || entry.operation.target.form !== "group") {
        refuse("not-a-letter");
        continue;
      }
      expression = qualified.has(quantityId)
        ? undefined
        : printedGroup(entry, table, entries, section, (glyph) => LETTER.test(glyph));
      if (!expression) {
        refuse("unsupported-group");
        continue;
      }
    }
    const letter: Letter = {
      latex: entry.glyph.latex,
      unicode: entry.glyph.unicode,
      entryId: entry.id,
      ...(expression ? { expression } : {}),
    };
    if (asComponent) components[key] = letter;
    else letters[quantityId] = letter;
  }

  return unprinted.length > 0
    ? { state: "modern", unprinted }
    : { state: "printed", letters, components };
}
