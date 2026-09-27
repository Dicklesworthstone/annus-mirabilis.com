/**
 * The inline formulas' island on a reading face (dispatch 272): mounted once per face, beside it,
 * for a paper whose inline formulas are drawn in colour, with the facts of every quantity they bind
 * and the note of every label they mark (printedInlines.ts; labels, dispatch 280). For any other
 * paper it renders nothing. A server component: the payload is read here and only the one paper's
 * facts and notes reach the island.
 */
import { renderToString } from "katex";
import { type InlineLabelNote, InlineTermLighting } from "../../equations/InlineTermLighting.tsx";
import {
  printedInlineLabels,
  printedInlineQuantities,
} from "../../equations/printed/printedInlines.ts";
import "../../equations/equations.css";
import "../../generated/quantity-colours-by-paper.css";

export function InlineTerms({ paper }: { paper: string }) {
  const quantities = printedInlineQuantities(paper);
  if (!quantities) return null;
  const labels: Record<string, InlineLabelNote> = {};
  for (const [id, label] of Object.entries(printedInlineLabels(paper) ?? {}))
    if (label.note)
      labels[id] = {
        note: label.note,
        glyphHtml: renderToString(label.glyph, {
          output: "html",
          throwOnError: false,
          strict: "ignore",
          trust: false,
          maxExpand: 100,
          maxSize: 10,
        }),
      };
  return <InlineTermLighting paper={paper} quantities={quantities} labels={labels} />;
}
