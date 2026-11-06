import { InlineTermLighting } from "../../equations/InlineTermLighting.tsx";
import { paperLabelNotes } from "../../equations/printed/inlineLabels.ts";
import {
  type PrintedInlineQuantity,
  printedInlineQuantities,
} from "../../equations/printed/printedInlines.ts";
import payload from "../../generated/explanation-inlines.json";
import "../../equations/equations.css";
import "../../generated/quantity-colours-by-paper.css";

const PAPERS = (
  payload as unknown as {
    papers: Readonly<
      Record<string, { quantities: Readonly<Record<string, PrintedInlineQuantity>> }>
    >;
  }
).papers;

/** One inspector owns both faces; mounting each face's global island would handle every click twice. */
export function SplitInlineTerms({ paper }: { paper: string }) {
  const quantities = {
    ...PAPERS[paper]?.quantities,
    ...printedInlineQuantities(paper),
  };
  if (Object.keys(quantities).length === 0) return null;
  return (
    <InlineTermLighting
      paper={paper}
      quantities={quantities}
      labels={paperLabelNotes(paper, process.cwd())}
    />
  );
}
