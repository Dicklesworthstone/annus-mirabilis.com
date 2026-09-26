/**
 * The faces' view of src/generated/printed-inlines.json (scripts/build-equations.ts, dispatch 272):
 * an inline formula's coloured render, found by the paper, the block, sentence or unit that prints
 * it, and its exact LaTeX. A formula the build did not compile (a refusal in a paper not yet
 * enforced, or a transcription changed after the payload was built) finds nothing and is drawn
 * plain. Imported only by server components, so the payload never reaches the reader's JavaScript.
 * No "use client".
 */
import payload from "../../generated/printed-inlines.json";

export type PrintedInline = Readonly<{
  html: string;
  terms: readonly Readonly<{ termId: string; quantityId: string; glyph: string }>[];
}>;

type PaperPayload = Readonly<{
  holders: Readonly<Record<string, string>>;
  formulas: Readonly<Record<string, PrintedInline>>;
}>;

const PAPERS = (payload as unknown as { papers: Readonly<Record<string, PaperPayload>> }).papers;

/** The coloured render of this inline formula where its holder prints it, or undefined. */
export function printedInline(
  paper: string | undefined,
  holder: string | undefined,
  latex: string,
): PrintedInline | undefined {
  if (paper === undefined || holder === undefined) return undefined;
  const own = PAPERS[paper];
  const scope = own?.holders[holder];
  return scope === undefined ? undefined : own?.formulas[`${scope}\u0000${latex}`];
}
