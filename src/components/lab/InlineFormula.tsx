import { renderToString } from "katex";

/**
 * Mathematics inside a sentence, rendered at build time like Formula.tsx but in KaTeX's inline
 * mode and as a <span>.
 *
 * Formula is a display block (a <div> in display mode). Placed inside a <p> it broke the
 * sentence in two: the browser closes the paragraph before the <div>, so "at optical
 * frequencies (ν ∼ 10¹⁴–10¹⁵ Hz)." rendered as a centred equation on its own line with the
 * closing ")." stranded on the next. The laboratory pages carried 94 of these inside
 * paragraphs. Use Formula for a displayed equation and this for a symbol or relation that
 * belongs to the sentence around it.
 */
export function InlineFormula({ latex }: { readonly latex: string }) {
  const html = renderToString(latex, {
    displayMode: false,
    output: "htmlAndMathml",
    throwOnError: true,
    strict: "error",
    trust: false,
  });
  return (
    <span
      className="formula-inline"
      data-latex={latex}
      {...{ dangerouslySetInnerHTML: { __html: html } }}
    />
  );
}
