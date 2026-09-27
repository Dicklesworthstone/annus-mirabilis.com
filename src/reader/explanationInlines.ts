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
import { loadInlineExceptions } from "../equations/printed/inlineExceptions.ts";
import { inlineLabelId } from "../equations/printed/inlineLabels.ts";
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
 * read against the passage it is written in. Resolving is not the same as being right: light quanta
 * § 8 wrote eV ≥ hν with V the accelerating potential, and the concordance's § 8 reading of V is the
 * volume, so it resolved and would have been coloured as a volume. A paper's letters are fixed at the
 * source before it joins (dispatch 273): light quanta's Ē (§ 1) and V_acc (§ 8); Brownian's K (§ 3)
 * and partition area A (§ 1); relativity's charge q (§§ 6, 10), field E (§ 10) and speeds u
 * (§§ 4, 9, 10).
 */
export const COLOURED_EXPLANATION_PAPERS: readonly string[] = [
  "mass-energy",
  "light-quanta",
  "brownian-motion",
  "special-relativity",
];

/** Papers whose every explanation formula must colour or be a listed exception. */
export const ENFORCED_EXPLANATION_PAPERS: readonly string[] = [];

const contexts = new Map<string, InlineTermsContext>();

function contextFor(paper: string): InlineTermsContext {
  let context = contexts.get(paper);
  if (!context) {
    context = {
      concordance: modernInlineEntries(paper, loadConcordanceForPaper(paper)),
      isRegistered: isRegisteredForPage,
      // The paper's own listed signs (dispatch 280, step 1b): an explanation writes π and d as the
      // paper does, and the whole list is passed, unfiltered, because a sign is named by its place
      // in it, which is how an explanation's π reaches the same note as a paragraph's.
      exceptions: loadInlineExceptions(process.cwd()),
    };
    contexts.set(paper, context);
  }
  return context;
}

/**
 * The formula drawn with its terms marked, or undefined when its paper is not yet coloured, or when
 * it does not resolve in its scope and its paper is not enforced (the caller then renders it plain).
 * `coloured` is false for a formula with no quantity to colour; `labelled` is true where it prints a
 * name the notation declares no quantity (a point, an axis, a system, a sign), which the page lights
 * and pins with a note of its own (dispatch 280, step 1b).
 */
export function explanationInline(
  latex: string,
  scope: ExplanationScope,
  enforced: readonly string[] = ENFORCED_EXPLANATION_PAPERS,
  coloured: readonly string[] = COLOURED_EXPLANATION_PAPERS,
): Readonly<{ html: string; coloured: boolean; labelled: boolean }> | undefined {
  if (!coloured.includes(scope.paper) && !enforced.includes(scope.paper)) return undefined;
  const read = resolveInlineTerms(
    latex,
    { paper: scope.paper, where: scope.where, anchor: scope.section, section: scope.section },
    contextFor(scope.paper),
  );
  // Its names take the ids the reading faces give them, so a k in a panel lights with the k in the
  // paragraph above it (inlineLabels.ts).
  const resolved = {
    ...read,
    labels: read.labels.map((l) => ({ ...l, labelId: inlineLabelId(l.source, scope.section) })),
  };
  if (resolved.problems.length === 0) {
    const compiled = compileInlineFormula(resolved);
    return {
      html: compiled.html,
      coloured: resolved.terms.length > 0,
      labelled: (compiled.labels?.length ?? 0) > 0,
    };
  }
  // Throws inline-terms-refused, naming the passage and each glyph.
  if (enforced.includes(scope.paper)) compileInlineFormula(resolved);
  return undefined;
}
