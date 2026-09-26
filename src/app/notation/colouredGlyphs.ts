/**
 * THE NOTATION PAGE'S FORMULAS IN THEIR PAPERS' COLOURS (dispatch 275). The owner: "I still see a
 * ton of equations that aren't properly using the colored equations with latex system like in
 * classic-patents.com". On the built page of b16bc66b, /notation/ drew 556 formulas and coloured
 * none of them.
 *
 * An entry's printed glyph and its modern form are the concordance's own, so each is read by its
 * own entry, through the inline resolver (inlineTerms.ts) with that entry as the only reading:
 * - a form of one atom binds the entry's quantity;
 * - a form the entry declares no quantity (an index, an operator, a number) stays in the ink, and
 *   the declaration is its reason;
 * - a form of several atoms (L/2, (x, y, z), the Lorentz root) is one expression the entry binds
 *   as a whole, so it is marked as one term in the entry's quantity, through the same compile and
 *   the same checks (the term survives, the MathML is unchanged).
 * A modern-only symbol and a display's legend line (the unlisted quantities) are read the same way
 * with their own quantity. A glyph that stands for several meanings (the index, a collision card)
 * cannot take one of their colours; the page leaves it in the ink and says why (data-formula-plain).
 *
 * The colour itself comes from the page: each paper's group carries data-paper, and
 * quantity-colours-by-paper.css gives each paper's quantity its slot. This module is pure; the page
 * passes the registered-id check (QUANTITY_LABELS, because the registry cannot be bundled), and the
 * test passes the registry itself.
 */

import { renderToString } from "katex";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import {
  compileInlineFormula,
  INLINE_KATEX,
  type ResolvedInline,
  resolveInlineTerms,
} from "../../equations/printed/inlineTerms.ts";

/** One formula the notation page draws: coloured by a quantity, or plain with its reason. */
export type NotationFormula = Readonly<{
  html: string;
  latex: string;
  /** The quantity it is drawn in, when it is coloured. */
  quantityId?: string | undefined;
  /** Why it is left in the ink, when it is. */
  plain?: string | undefined;
}>;

/** Who owns a formula on the page: an entry, a modern-only symbol, or a legend line. */
export type FormulaOwner = Readonly<{
  /** The concordance entry, symbol or legend line, named in any refusal. */
  id: string;
  paper: string;
  /** The paragraph it is read in (the entry's first use). */
  anchor: string;
  latex: string;
  /** The quantity it binds, or none. */
  quantityId?: string | undefined;
  /** When it binds none: what the concordance declares it (index, operator, number). */
  declared?: string | undefined;
}>;

export class NotationFormulaError extends Error {
  readonly code: "notation-formula-unregistered-quantity";
  constructor(code: NotationFormulaError["code"], message: string) {
    super(`${code}: ${message}`);
    this.name = "NotationFormulaError";
    this.code = code;
  }
}

const sectionOf = (anchor: string) => /^s\d+/.exec(anchor)?.[0] ?? "s0";

function plainRender(latex: string): string {
  return renderToString(latex, INLINE_KATEX);
}

/** A formula drawn in its owner's quantity, or left plain with the reason. */
export function notationFormula(
  owner: FormulaOwner,
  isRegistered: (quantityId: string) => boolean,
  /** Whether the paper's palette gives the quantity a colour (quantity-colours.json). */
  hasColour: (paper: string, quantityId: string) => boolean = () => true,
): NotationFormula {
  const { latex } = owner;
  const scope = {
    paper: owner.paper,
    where: owner.id,
    anchor: owner.anchor,
    section: sectionOf(owner.anchor),
  };
  const declaredReason = `the concordance declares it no quantity (${owner.declared ?? "unnamed"})`;
  if (owner.quantityId !== undefined && !isRegistered(owner.quantityId))
    throw new NotationFormulaError(
      "notation-formula-unregistered-quantity",
      `/notation/: ${owner.paper} ${owner.id} draws ${JSON.stringify(latex)} in ${owner.quantityId}, which is not a registered quantity id (content/quantities/).`,
    );
  const own = {
    id: owner.id,
    paper: owner.paper,
    scope: ["all"],
    glyph: { latex, unicode: latex },
    binding:
      owner.quantityId !== undefined
        ? { quantityId: owner.quantityId }
        : { nonQuantityKind: owner.declared ?? "unnamed" },
  } as unknown as ConcordanceEntry;
  const resolved = resolveInlineTerms(latex, scope, {
    concordance: [own],
    isRegistered,
    exceptions: [],
  });
  // A quantity the paper's palette gives no colour would carry its mark and still be drawn in the
  // ink, so it is left plain and says so, rather than marked for a colour that never shows.
  if (owner.quantityId !== undefined && !hasColour(owner.paper, owner.quantityId))
    return {
      html: plainRender(latex),
      latex,
      plain: `${owner.paper}'s palette gives ${owner.quantityId} no colour`,
    };
  if (resolved.problems.length === 0) {
    const compiled = compileInlineFormula(resolved);
    return compiled.terms.length > 0
      ? { html: compiled.html, latex, quantityId: owner.quantityId }
      : { html: compiled.html, latex, plain: declaredReason };
  }
  // Several atoms: the owner binds the expression as a whole, or declares it no quantity.
  if (owner.quantityId === undefined)
    return { html: plainRender(latex), latex, plain: declaredReason };
  const whole: ResolvedInline = {
    latex,
    scope,
    terms: [
      {
        termId: "i1",
        quantityId: owner.quantityId,
        glyph: latex,
        start: 0,
        end: latex.length,
        braced: true,
      },
    ],
    declared: 0,
    exceptions: 0,
    problems: [],
  };
  return { html: compileInlineFormula(whole).html, latex, quantityId: owner.quantityId };
}

/** The owner of an entry's printed glyph or modern form. */
export function entryOwner(entry: ConcordanceEntry, latex: string): FormulaOwner {
  const binding = entry.binding as { quantityId?: string; nonQuantityKind?: string };
  return {
    id: entry.id,
    paper: entry.paper,
    anchor: entry.sources.anchor,
    latex,
    quantityId: binding.quantityId,
    declared: binding.nonQuantityKind,
  };
}
