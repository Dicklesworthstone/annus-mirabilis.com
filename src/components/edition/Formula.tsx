import { renderToString } from "katex";
/** Authored formula, rendered at build time with a MathML alternative; no client mathematics library. */
export function Formula({ latex }: { latex: string }) {
  const html = renderToString(latex, {
    displayMode: true,
    output: "htmlAndMathml",
    throwOnError: true,
    strict: "error",
    trust: false,
  });
  return <div className="formula" {...{ dangerouslySetInnerHTML: { __html: html } }} />;
}
