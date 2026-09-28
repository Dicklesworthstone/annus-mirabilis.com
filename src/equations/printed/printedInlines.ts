/**
 * The faces' view of src/generated/printed-inlines.json (scripts/build-equations.ts, dispatch 272):
 * an inline formula's coloured render, found by the paper, the block, sentence or unit that prints
 * it, and its exact LaTeX. A formula the build did not compile (a refusal in a paper not yet
 * enforced, or a transcription changed after the payload was built) finds nothing and is drawn
 * plain. Imported only by server components, so the payload never reaches the reader's JavaScript.
 * No "use client".
 */
import payload from "../../generated/printed-inlines.json";
import type { TermFacts } from "../termFacts.ts";

export type PrintedInline = Readonly<{
  html: string;
  terms: readonly Readonly<{ termId: string; quantityId: string; glyph: string }>[];
  /** Its atoms marked as labels: a point, an axis, a system, a sign (dispatch 280, step 1b). */
  labels?: readonly PrintedInlineLabel[];
  /**
   * Where the whole formula is a number the paper prints in its prose: what it is the value of
   * (dispatch 302). The quantity is absent where the sentence supports none, as with light quanta's
   * 2/3, which is the ratio of two energies and the value of neither.
   */
  value?: Readonly<{ quantityId?: string; note: string }>;
}>;

/** A label an inline formula marks, with the glyph and what it names. */
export type PrintedInlineLabel = Readonly<{ labelId: string; glyph: string; note?: string }>;

/** What the page's inspector says about one inline quantity (paperInlines.ts, InlineQuantityFacts). */
export type PrintedInlineQuantity = Readonly<{
  name: string;
  glyphHtml: string;
  facts: TermFacts;
  href: string;
  hrefMeaning?: string | undefined;
}>;

type PaperPayload = Readonly<{
  holders: Readonly<Record<string, string>>;
  formulas: Readonly<Record<string, PrintedInline>>;
  quantities: Readonly<Record<string, PrintedInlineQuantity>>;
  /** Named occurrences in printed order, keyed by scope and LaTeX (am-rse2). */
  occurrences?: Readonly<Record<string, readonly string[]>> | undefined;
}>;

const PAPERS = (payload as unknown as { papers: Readonly<Record<string, PaperPayload>> }).papers;

/** The coloured render of this inline formula where its holder prints it, or undefined. */
export function printedInline(
  paper: string | undefined,
  holder: string | undefined,
  latex: string,
  /**
   * This printing of the formula, where the record names one (a math inline's `inlineId`). A
   * paragraph that prints one glyph twice in two meanings has a render for each, and the occurrence
   * is what tells them apart (am-rse2: relativity's s10-p10 X-axis and its electrostatic force X).
   * Every other formula has one render for its scope and LaTeX, found by the same call without it.
   */
  inlineId?: string | undefined,
): PrintedInline | undefined {
  if (paper === undefined || holder === undefined) return undefined;
  const own = PAPERS[paper];
  const scope = own?.holders[holder];
  if (scope === undefined) return undefined;
  const atOccurrence =
    inlineId === undefined ? undefined : own?.formulas[`${scope}\u0000${inlineId}\u0000${latex}`];
  return atOccurrence ?? own?.formulas[`${scope}\u0000${latex}`];
}

/**
 * The render of the `ordinal`-th printing of this LaTeX in its holder, for a caller that renders a
 * paragraph from its text and so has no inline record to read an id from - a result card's quotation
 * (sourceMarkup.tsx). Where the paragraph names no occurrence of that LaTeX, which is every
 * paragraph but one, this is exactly printedInline.
 */
export function printedInlineAt(
  paper: string | undefined,
  holder: string | undefined,
  latex: string,
  ordinal: number,
): PrintedInline | undefined {
  if (paper === undefined || holder === undefined) return undefined;
  const own = PAPERS[paper];
  const scope = own?.holders[holder];
  if (scope === undefined) return undefined;
  const named = own?.occurrences?.[`${scope}\u0000${latex}`];
  const occurrence = named?.[ordinal];
  return printedInline(paper, holder, latex, occurrence);
}

/** The inspector's facts for every quantity a paper's inline formulas bind, or undefined for a paper
 * whose inline formulas are not drawn in colour. */
export function printedInlineQuantities(
  paper: string,
): Readonly<Record<string, PrintedInlineQuantity>> | undefined {
  return PAPERS[paper]?.quantities;
}

/**
 * Every label a paper's inline formulas mark, by id, with its glyph and what it names: the notes
 * the page's island shows when a reader points at a point, an axis or a system (dispatch 280).
 * Undefined for a paper whose inline formulas are not drawn in colour.
 */
export function printedInlineLabels(
  paper: string,
): Readonly<Record<string, Readonly<{ glyph: string; note?: string }>>> | undefined {
  const own = PAPERS[paper];
  if (!own) return undefined;
  const labels: Record<string, { glyph: string; note?: string }> = {};
  for (const formula of Object.values(own.formulas))
    for (const label of formula.labels ?? [])
      labels[label.labelId] ??= {
        glyph: label.glyph,
        ...(label.note ? { note: label.note } : {}),
      };
  return labels;
}
