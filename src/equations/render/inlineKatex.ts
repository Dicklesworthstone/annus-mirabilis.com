/**
 * One place that turns a piece of inline mathematics into static KaTeX, with the options the
 * reading face's display formulas use (Formula.tsx): HTML for the eye and MathML for assistive
 * technology, strict, and no trusted commands. It throws on malformed mathematics, so a bad
 * `\( … \)` in a record fails the build instead of reaching a reader. The reading face
 * (InlineMathText) and the offline chapter both call it, so the two cannot drift apart.
 */
import { renderToString } from "katex";

export function renderInlineLatex(latex: string): string {
  return renderToString(latex, {
    displayMode: false,
    output: "htmlAndMathml",
    throwOnError: true,
    strict: "error",
    trust: false,
  });
}
