import { renderToString } from "katex";

export interface FormulaProps {
  readonly latex: string;
  readonly ariaLabel?: string;
}

/** Authored formula, rendered at build time with a MathML alternative; no client mathematics library. */
export function Formula({ latex, ariaLabel = "Mathematical formula" }: FormulaProps) {
  const html = renderToString(latex, {
    displayMode: true,
    output: "htmlAndMathml",
    throwOnError: true,
    strict: "error",
    trust: false,
  });
  return (
    <section
      className="formula"
      aria-label={ariaLabel}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
      tabIndex={0}
      {...{ dangerouslySetInnerHTML: { __html: html } }}
    />
  );
}
