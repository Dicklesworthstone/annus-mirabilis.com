import { renderToString } from "katex";

export interface FormulaProps {
  readonly latex: string;
  readonly tabIndex?: number;
}

/** Authored formula, rendered at build time with a MathML alternative; no client mathematics library. */
export function Formula({ latex, tabIndex }: FormulaProps) {
  const html = renderToString(latex, {
    displayMode: true,
    output: "htmlAndMathml",
    throwOnError: true,
    strict: "error",
    trust: false,
  });
  return (
    <div
      className="formula"
      tabIndex={tabIndex}
      data-latex={latex}
      {...{ dangerouslySetInnerHTML: { __html: html } }}
    />
  );
}
