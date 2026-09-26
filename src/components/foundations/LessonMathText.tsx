import { hasInlineMath, splitInlineMath } from "../../content/inlineMath.ts";
import { LESSON_PALETTE, lessonInlineFormula } from "./lessonFormulas.ts";
// The rule that turns a marked term its colour, and each palette's colour for each quantity: this
// component relies on both, so it names them rather than inherit them from ColouredFormula.
import "../../equations/equations.css";
import "../../generated/quantity-colours-by-paper.css";

/**
 * A lesson's paragraph or step with its `\( … \)` mathematics typeset, as InlineMathText sets an
 * explanation's, each formula decided by lessonFormulas.ts (dispatch 275): coloured in the lessons'
 * palette where the lesson means a paper's quantity, and marked as the faces' inline formulas are
 * (inline-math, data-inline-terms, data-paper) so equations.css tints it; otherwise drawn in the ink
 * with its reason on the span (data-formula-plain). The words stay escaped React text.
 */
export function LessonMathText({ text, lesson }: { text: string; lesson: string }) {
  if (!hasInlineMath(text)) return text;
  return (
    <>
      {splitInlineMath(text).map((segment) => {
        if (segment.kind === "text") return segment.value;
        const formula = lessonInlineFormula(lesson, segment.value);
        return (
          <span
            key={segment.start}
            className={formula.coloured ? "inline-math" : undefined}
            data-inline-terms={formula.coloured ? "" : undefined}
            data-paper={formula.coloured ? LESSON_PALETTE : undefined}
            data-formula-plain={formula.plain}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: static KaTeX output of a validated lesson record, rendered with trust: false (the marked render trusts only its own data-term attributes); the surrounding words stay escaped React text.
            dangerouslySetInnerHTML={{ __html: formula.html }}
          />
        );
      })}
    </>
  );
}
