/**
 * THE INLINE-EQUATION UNIT CLASS, AND THE ONE EDITORIAL JUDGMENT IT NEEDS.
 *
 * `inline-equation` was the last entry in DECLARED_ABSENCES for all four papers: the Requirements
 * row "Substantive inline equations and nontrivial symbol occurrences | `s<n>-p<m>-s<k>-m<i>`"
 * that every inventory bead carries and no inventory had recorded. AGENTS.md named the reason it
 * stayed open rather than any blocker: "needing the editorial judgment of which inline regions are
 * substantive".
 *
 * WHAT IS MECHANICAL AND WHAT IS A JUDGMENT. Two different things were tangled in that sentence.
 *
 * - The INDEX is mechanical. `i` counts EVERY inline math region of the sentence or footnote,
 *   1-based, in printed order. It is a property of the plate, read off the reviewed source block's
 *   `inlines` list, and no opinion enters it.
 * - The SUBSET is the judgment. Only the substantive regions become units, so "the substantive
 *   subset has gaps" in `i`, exactly as the id grammar says.
 *
 * Separating them is what makes the judgment cheap to take and cheap to revise, and it is why
 * `am-edn-inventory-brownian-slg` says "Decide 'substantive inline equation' generously". Because
 * the index is positional over all regions, promoting a region into the subset LATER gives it the
 * index it always had and moves nothing. `indexIsIndependentOfCriterion` in the test beside this
 * file asserts that property across four criteria rather than asserting that someone believed it.
 *
 * THE CRITERION, stated once: a region is substantive when its formula is MORE THAN A SINGLE
 * SYMBOL. A lone `$v$` or `$\varphi$` is a symbol occurrence, which the notation concordance
 * already owns by first-use id; everything else -- a relation, an operation, a tuple, a ratio, a
 * printed numeral -- is an inline equation or a nontrivial symbol occurrence, which is the row's
 * own wording.
 *
 * MEASURED over the four papers' 714 regions before the criterion was chosen, so the choice was
 * made against its consequences rather than discovered after them:
 *
 *   criterion                                  units    what it drops
 *   A  relation only (`=`, `<`, ...)              58     every operation and tuple
 *   B  relation or operation                     166     tuples, ratios, numerals
 *   C  all but a single bare symbol              270     444 lone-symbol occurrences   <- chosen
 *   D  every region                              714     nothing; no gaps at all
 *
 * A and B drop `$(\xi, \eta, \zeta)$` and `$H - E$`, which are plainly nontrivial. D makes the
 * subset equal to the index space, which contradicts the grammar's own "the substantive subset has
 * gaps" and would inventory 444 lone letters as equations. C is the generous reading that still
 * leaves gaps.
 *
 * The population is the authored inline expression: a math inline that is neither a reference to a
 * displayed equation (`display`) nor the body of one (`equationId`). Those two are display
 * equations, inventoried under `eq-*` ids, and counting them here was a real error caught by
 * measurement -- the first pass read 914 regions because the 200 `equation`-kind blocks carry
 * their body as a math inline with `equationId` set and `display` unset.
 */

import type { Inline } from "../schemas/inlines.ts";
import { plainText } from "../schemas/inlines.ts";
import type { ManifestLocator, ManifestUnit } from "./types.ts";

/** A single printed inline math region, with the positional index that becomes its `-m<i>`. */
export type InlineMathRegion = Readonly<{
  /** The alignable unit that prints it: a sentence id, or a footnote id where it has no sentences. */
  ownerUnitId: string;
  /** 1-based position among EVERY inline math region of that owner, in printed order. */
  index: number;
  latex: string;
  /** Whether the criterion admits it as a unit. The index above does not depend on this. */
  substantive: boolean;
}>;

/**
 * Whether a region is more than a single symbol.
 *
 * A bare symbol is one TeX command (`\varphi`, `\nu`) or one alphanumeric character (`v`, `N`, `2`),
 * optionally wrapped in the braces a transcriber may have left. Anything longer carries structure:
 * a relation, an operator, a subscript, a tuple, a ratio, or a multi-character numeral.
 *
 * Trailing printed punctuation is stripped first. The plate prints "der Kraft $K$," and the comma
 * belongs to the sentence, not the formula; a region transcribed as `K,` is still a lone symbol and
 * must not be promoted by its punctuation. That is the one normalization here, and it only ever
 * moves a region OUT of the subset, never into it.
 */
export function isSubstantiveInlineMath(latex: string): boolean {
  const bare = latex
    .trim()
    .replace(/[.,;:]+$/, "")
    .replace(/^\{+|\}+$/g, "")
    .trim();
  if (bare === "") return false;
  return !/^(\\[a-zA-Z]+|[A-Za-z0-9])$/.test(bare);
}

/** An authored inline expression: not a display reference, not a display body. */
function isAuthoredInlineMath(node: unknown): node is { kind: "math"; latex: string } {
  if (node === null || typeof node !== "object") return false;
  const o = node as Record<string, unknown>;
  return (
    o.kind === "math" &&
    typeof o.latex === "string" &&
    o.display !== true &&
    o.equationId === undefined
  );
}

/**
 * Every inline math region of a block, each tagged with the alignable unit that prints it and its
 * positional index within that unit.
 *
 * Offsets are code points over `plainText(inlines)`, which is what a sentence span indexes, so this
 * walks the inlines the same way `src/reader/faces/sentenceInlines.ts` does. A display formula adds
 * no characters and is skipped by the same rule that skips it there. A `term`, `misprint` or
 * `reference` wrapper may hold a formula; that formula is printed at that position and counts.
 *
 * A block with no `sentenceSpans` (a footnote, a heading) owns its regions directly, which is how
 * `s<n>-fn<k>-m<i>` arises.
 */
export function inlineMathRegions(
  inlines: readonly Inline[],
  sentenceSpans: readonly Readonly<{
    id: string;
    span: Readonly<{ start: number; end: number }>;
  }>[],
  blockUnitId: string,
): readonly InlineMathRegion[] {
  const found: { ownerUnitId: string | undefined; latex: string }[] = [];
  let offset = 0;

  const walk = (nodes: readonly Inline[]): void => {
    for (const node of nodes) {
      if (node === null || typeof node !== "object") continue;
      const o = node as unknown as Record<string, unknown>;
      if (o.kind === "emphasis" && Array.isArray(o.inlines)) {
        walk(o.inlines as readonly Inline[]);
        continue;
      }
      const length = Array.from(plainText([node])).length;
      const inner = o.math;
      const formula = isAuthoredInlineMath(o) ? o : isAuthoredInlineMath(inner) ? inner : undefined;
      if (formula !== undefined) {
        const owner =
          sentenceSpans.length === 0
            ? blockUnitId
            : sentenceSpans.find((s) => offset >= s.span.start && offset < s.span.end)?.id;
        found.push({ ownerUnitId: owner, latex: formula.latex.trim() });
      }
      offset += length;
    }
  };
  walk(inlines);

  const perOwner = new Map<string, number>();
  const regions: InlineMathRegion[] = [];
  for (const entry of found) {
    // A region outside every span is reported by the caller, never silently given an index: an
    // index assigned under the wrong owner would be a frozen id naming the wrong sentence.
    if (entry.ownerUnitId === undefined) continue;
    const index = (perOwner.get(entry.ownerUnitId) ?? 0) + 1;
    perOwner.set(entry.ownerUnitId, index);
    regions.push({
      ownerUnitId: entry.ownerUnitId,
      index,
      latex: entry.latex,
      substantive: isSubstantiveInlineMath(entry.latex),
    });
  }
  return regions;
}

/**
 * The regions of a block that fall in no sentence span, named rather than counted.
 *
 * This is the failure this file must not paper over. A region the walk cannot place would either be
 * dropped from the inventory or, worse, given an index under a neighbouring sentence, which freezes
 * an id naming the wrong passage. The corpus measured 0 of 714 unplaced, and the test asserts that
 * from this function rather than inferring it from a total, so a span table that stops covering its
 * own block is a named finding instead of a quieter count.
 */
export function unplacedRegions(
  inlines: readonly Inline[],
  sentenceSpans: readonly Readonly<{
    id: string;
    span: Readonly<{ start: number; end: number }>;
  }>[],
  blockId: string,
): readonly Readonly<{ blockId: string; latex: string }>[] {
  if (sentenceSpans.length === 0) return [];
  const out: { blockId: string; latex: string }[] = [];
  let offset = 0;
  const walk = (nodes: readonly Inline[]): void => {
    for (const node of nodes) {
      if (node === null || typeof node !== "object") continue;
      const o = node as unknown as Record<string, unknown>;
      if (o.kind === "emphasis" && Array.isArray(o.inlines)) {
        walk(o.inlines as readonly Inline[]);
        continue;
      }
      const length = Array.from(plainText([node])).length;
      const inner = o.math;
      const formula = isAuthoredInlineMath(o) ? o : isAuthoredInlineMath(inner) ? inner : undefined;
      if (
        formula !== undefined &&
        !sentenceSpans.some((s) => offset >= s.span.start && offset < s.span.end)
      ) {
        out.push({ blockId, latex: formula.latex.trim() });
      }
      offset += length;
    }
  };
  walk(inlines);
  return out;
}

export type InlineUnitSource = Readonly<{
  blockId: string;
  paper: string;
  section?: string | undefined;
  inlines: readonly Inline[];
  sentenceSpans: readonly Readonly<{
    id: string;
    span: Readonly<{ start: number; end: number }>;
  }>[];
}>;

/**
 * The `inline-equation` manifest units a paper's source blocks imply, in printed order.
 *
 * `locators` and `section` come from the manifest unit that CONTAINS the region, never invented
 * here: a region is printed wherever its sentence is printed, so reusing that unit's locators
 * cannot introduce a page the page map does not already cover. `editionBlockId` names the block
 * whose `inlines` actually render the region, which is the paragraph or footnote, not the sentence.
 */
export function inlineEquationUnits(
  sources: readonly InlineUnitSource[],
  containingUnits: ReadonlyMap<
    string,
    Readonly<{ locators: readonly ManifestLocator[]; section?: string | undefined }>
  >,
): readonly ManifestUnit[] {
  const units: ManifestUnit[] = [];
  for (const source of sources) {
    for (const region of inlineMathRegions(source.inlines, source.sentenceSpans, source.blockId)) {
      if (!region.substantive) continue;
      const container = containingUnits.get(region.ownerUnitId);
      if (container === undefined) continue;
      units.push({
        id: `${region.ownerUnitId}-m${region.index}`,
        kind: "inline-equation",
        ...(container.section === undefined ? {} : { section: container.section }),
        containedIn: region.ownerUnitId,
        locators: container.locators,
        destination: {
          editionBlockId: `de-${source.paper}-${source.blockId}`,
          translationUnits: ["planned"],
        },
      });
    }
  }
  return units;
}
