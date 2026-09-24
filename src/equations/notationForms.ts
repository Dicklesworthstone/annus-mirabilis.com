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
 * A letter is taken only where the concordance is unambiguous about it. Measured on the 40
 * relativity records (2026-09-24): 73 of the 85 quantity-and-section pairs they bind qualify. The
 * other 12 keep the record's own letter in both forms. They fall into three kinds:
 * - a vector whose components Einstein printed as separate letters (xi, eta, zeta; X, Y, Z; L, M,
 *   N), which the tree binds as one quantity with a subscript;
 * - a modern target the concordance and the records disagree on (phi or vartheta);
 * - a quantity the concordance has no entry for.
 * Nothing here ever matches a quantity to an entry by its letter: that is how kinetic energy's K
 * came to be drawn as the stationary system's modern S.
 */
import { scopeMatches } from "../content/notation/resolve.ts";
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";
import { type Expression, quantityBindings } from "./ast.ts";
import type { QuantityRegistry } from "./quantities.ts";

/** Quantity id to the letter Einstein printed for it here, and the concordance entry that says so. */
export type PrintedLetters = Readonly<
  Record<string, Readonly<{ latex: string; unicode: string; entryId: string }>>
>;

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

/**
 * The printed letters for the quantities `tree` binds, in `section`. A quantity qualifies when
 * exactly one entry bound to its id applies in the section, that entry is a rename, its modern
 * target is the letter the table already prints, and its printed letter differs from it.
 */
export function printedLetters(
  tree: Expression,
  table: QuantityRegistry,
  entries: readonly ConcordanceEntry[],
  section: string,
): PrintedLetters {
  const out: Record<string, { latex: string; unicode: string; entryId: string }> = {};
  for (const quantityId of new Set(quantityBindings(tree).map((b) => b.quantityId))) {
    const here = entries.filter(
      (e) =>
        "quantityId" in e.binding &&
        e.binding.quantityId === quantityId &&
        scopeMatches(e.scope, section, section),
    );
    if (here.length !== 1) continue;
    const entry = here[0] as ConcordanceEntry;
    const modern = table[quantityId]?.glyph;
    if (modern === undefined || modernTarget(entry) !== modern) continue;
    if (entry.glyph.latex === modern) continue;
    out[quantityId] = { latex: entry.glyph.latex, unicode: entry.glyph.unicode, entryId: entry.id };
  }
  return out;
}
