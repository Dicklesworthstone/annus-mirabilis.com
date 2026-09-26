/**
 * The inline formulas' island on a reading face (dispatch 272): mounted once per face, beside it,
 * for a paper whose inline formulas are drawn in colour, with the facts of every quantity they bind
 * (printedInlines.ts). For any other paper it renders nothing. A server component: the payload is
 * read here and only the one paper's facts reach the island.
 */
import { InlineTermLighting } from "../../equations/InlineTermLighting.tsx";
import { printedInlineQuantities } from "../../equations/printed/printedInlines.ts";
import "../../equations/equations.css";
import "../../generated/quantity-colours-by-paper.css";

export function InlineTerms({ paper }: { paper: string }) {
  const quantities = printedInlineQuantities(paper);
  return quantities ? <InlineTermLighting paper={paper} quantities={quantities} /> : null;
}
