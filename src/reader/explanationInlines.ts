/**
 * THE EXPLANATION'S INLINE FORMULAS, COLOURED (dispatch 273). The owner: "I still see a ton of
 * equations that aren't properly using the colored equations with latex system like in
 * classic-patents.com". On the built paper pages of b16bc66b, 116 of 1,030 formulas were coloured:
 * the model records. Every `\( … \)` in a passage's prose and steps was plain KaTeX.
 *
 * A formula is resolved in its passage's scope (the paper, and the section the passage belongs to,
 * as its own anchor) by NavyKite's resolver (inlineTerms.ts), over the printed concordance plus the
 * modern readings an explanation writes with (modernScope.ts). Where every atom resolves, the
 * formula is drawn with its terms marked, and the caller gives it the paper's colours.
 *
 * Where one does not, the formula renders plain, as before, UNLESS its paper is listed in
 * ENFORCED_EXPLANATION_PAPERS. Then the build fails, and the refusal names the passage and the
 * glyph. A paper joins that list once every one of its explanation formulas colours or is a listed
 * exception, so nothing is left plain in silence there.
 *
 * Server only: the concordance is read from content/ at build time.
 */
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import {
  compileInlineFormula,
  type InlineTermsContext,
  resolveInlineTerms,
} from "../equations/printed/inlineTerms.ts";
import { modernInlineEntries } from "../equations/printed/modernScope.ts";
// The registry's own check (content/quantities/registry.ts) reads content/ at run time and cannot be
// bundled into a page; this generated map names every registered id (explanationInlines.test.tsx
// holds the two to the same answer).
import { QUANTITY_LABELS } from "../generated/quantity-labels.ts";

export const isRegisteredForPage = (quantityId: string): boolean =>
  Object.hasOwn(QUANTITY_LABELS, quantityId);

/** Where an explanation formula is written: its paper, its passage's section, and its passage. */
export type ExplanationScope = Readonly<{
  paper: string;
  section: string;
  /** The passage and the part of it, named in every refusal ("arg-me-mass-change full"). */
  where: string;
}>;

/**
 * Papers whose explanation formulas are coloured, each added once every binding it produces has been
 * read against the passage it is written in. Resolving is not the same as being right: in light
 * quanta § 8 an explanation writes V for the accelerating potential (eV ≥ hν), and the concordance's
 * § 8 reading of V is the volume, so it resolves and would be coloured as a volume. A paper's own
 * letters are fixed at the source before it joins.
 */
export const COLOURED_EXPLANATION_PAPERS: readonly string[] = ["mass-energy"];

/** Papers whose every explanation formula must colour or be a listed exception. */
export const ENFORCED_EXPLANATION_PAPERS: readonly string[] = [];

const contexts = new Map<string, InlineTermsContext>();

function contextFor(paper: string): InlineTermsContext {
  let context = contexts.get(paper);
  if (!context) {
    context = {
      concordance: modernInlineEntries(paper, loadConcordanceForPaper(paper)),
      isRegistered: isRegisteredForPage,
      exceptions: [],
    };
    contexts.set(paper, context);
  }
  return context;
}

/**
 * The formula drawn with its terms marked, or undefined when its paper is not yet coloured, or when
 * it does not resolve in its scope and its paper is not enforced (the caller then renders it plain). `coloured` is false for a formula
 * whose atoms are all operators, indices or exceptions: it resolves, and has nothing to colour.
 */
export function explanationInline(
  latex: string,
  scope: ExplanationScope,
  enforced: readonly string[] = ENFORCED_EXPLANATION_PAPERS,
  coloured: readonly string[] = COLOURED_EXPLANATION_PAPERS,
): Readonly<{ html: string; coloured: boolean }> | undefined {
  if (!coloured.includes(scope.paper) && !enforced.includes(scope.paper)) return undefined;
  const resolved = resolveInlineTerms(
    latex,
    { paper: scope.paper, where: scope.where, anchor: scope.section, section: scope.section },
    contextFor(scope.paper),
  );
  if (resolved.problems.length === 0)
    return { html: compileInlineFormula(resolved).html, coloured: resolved.terms.length > 0 };
  // Throws inline-terms-refused, naming the passage and each glyph.
  if (enforced.includes(scope.paper)) compileInlineFormula(resolved);
  return undefined;
}
