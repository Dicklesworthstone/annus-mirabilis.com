/**
 * The explanation page's inline formulas as targets (dispatch 273): the same island the reading
 * faces mount (InlineTermLighting, NavyKite's 0c067e18), once per paper page. Pointing at a coloured
 * glyph lights every copy of its quantity in that paper on the page; pressing it pins the quantity
 * and opens the inspector just after the formula.
 *
 * The facts are built with the page (build-equations.ts, explanation-inlines.json) from the same
 * formulas the page draws (explanationFormulas.ts), so only the one paper's reach the island. For a
 * paper whose explanations are not yet coloured it renders nothing.
 */
import { InlineTermLighting } from "../equations/InlineTermLighting.tsx";
import type { PrintedInlineQuantity } from "../equations/printed/printedInlines.ts";
import payload from "../generated/explanation-inlines.json";
import "../equations/equations.css";
import "../generated/quantity-colours-by-paper.css";

const PAPERS = (
  payload as unknown as {
    papers: Readonly<
      Record<string, Readonly<{ quantities: Readonly<Record<string, PrintedInlineQuantity>> }>>
    >;
  }
).papers;

export function ExplanationInlineTerms({ paper }: { paper: string }) {
  const quantities = PAPERS[paper]?.quantities;
  return quantities ? <InlineTermLighting paper={paper} quantities={quantities} /> : null;
}
