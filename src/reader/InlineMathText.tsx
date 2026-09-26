import { hasInlineMath, splitInlineMath } from "../content/inlineMath.ts";
import { renderInlineLatex } from "../equations/render/inlineKatex.ts";
import { type ExplanationScope, explanationInline } from "./explanationInlines.ts";

/**
 * A paragraph's or a step's text with its `\( … \)` mathematics typeset. The words stay React
 * text, escaped as ever; only KaTeX's own output (strict, no trusted commands) is set as HTML.
 * Text with no inline mathematics renders exactly as it did.
 *
 * With a `scope` (an explanation passage's paper, section and name), each formula is resolved
 * against the notation concordance (explanationInlines.ts) and, where every atom resolves, drawn
 * with its terms marked and its span marked as the faces' are (inline-math, data-inline-terms, the
 * paper), so quantity-colours-by-paper.css colours it and the page's island lights it (dispatch 273). The strict plain render still runs first, so malformed mathematics still fails.
 */
export function InlineMathText({
  text,
  scope,
}: {
  text: string;
  scope?: ExplanationScope | undefined;
}) {
  if (!hasInlineMath(text)) return text;
  return (
    <>
      {splitInlineMath(text).map((segment) => {
        if (segment.kind === "text") return segment.value;
        const plain = renderInlineLatex(segment.value);
        const marked = scope ? explanationInline(segment.value, scope) : undefined;
        return (
          <span
            key={segment.start}
            // A coloured formula is marked as the faces' inline formulas are, so the page's island
            // (ExplanationInlineTerms) lights and pins its glyphs and equations.css tints them.
            className={marked?.coloured ? "inline-math" : undefined}
            data-inline-terms={marked?.coloured ? "" : undefined}
            data-paper={marked?.coloured ? scope?.paper : undefined}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: static KaTeX output of a validated record, rendered with trust: false (the marked render trusts only its own data-term attributes); the surrounding words stay escaped React text.
            dangerouslySetInnerHTML={{ __html: marked?.html ?? plain }}
          />
        );
      })}
    </>
  );
}
