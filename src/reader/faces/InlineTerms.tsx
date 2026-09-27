/**
 * The inline formulas' island on a reading face (dispatch 272): mounted once per face, beside it,
 * for a paper whose inline formulas are drawn in colour, with the facts of every quantity they bind
 * and what each name the paper prints says (inlineLabels.ts; labels, dispatch 280). For any other
 * paper it renders nothing. A server component: the notation is read here and only the one paper's
 * facts and notes reach the island.
 */
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { InlineTermLighting } from "../../equations/InlineTermLighting.tsx";
import { inlineLabelNotes } from "../../equations/printed/inlineLabels.ts";
import { loadInlineExceptions } from "../../equations/printed/paperInlines.ts";
import { printedInlineQuantities } from "../../equations/printed/printedInlines.ts";
import "../../equations/equations.css";
import "../../generated/quantity-colours-by-paper.css";

export function InlineTerms({ paper }: { paper: string }) {
  const quantities = printedInlineQuantities(paper);
  if (!quantities) return null;
  const labels = inlineLabelNotes(
    paper,
    loadConcordanceForPaper(paper).entries,
    loadInlineExceptions(process.cwd()),
  );
  return <InlineTermLighting paper={paper} quantities={quantities} labels={labels} />;
}
