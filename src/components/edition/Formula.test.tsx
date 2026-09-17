import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Formula } from "./Formula.tsx";

describe("Formula (edition/Formula.tsx, am-bc6s)", () => {
  test("renders as a focusable section with className formula and tabIndex=0", () => {
    const markup = renderToStaticMarkup(<Formula latex="E = mc^2" />);
    expect(markup).toMatch(/^<section\b[^>]*\bclass="formula"/);
    expect(markup).toContain('tabindex="0"');
  });

  test("applies default aria-label for accessibility", () => {
    const markup = renderToStaticMarkup(<Formula latex="\\lambda_m T = b" />);
    expect(markup).toContain('aria-label="Mathematical formula"');
  });

  test("respects a custom ariaLabel prop", () => {
    const markup = renderToStaticMarkup(
      <Formula
        latex="\\overline{\\Delta x^2} = 2Dt"
        ariaLabel="Mean squared displacement equation"
      />,
    );
    expect(markup).toContain('aria-label="Mean squared displacement equation"');
  });

  test("renders KaTeX HTML and MathML elements within the section", () => {
    const markup = renderToStaticMarkup(<Formula latex="D = \\frac{RT}{6\\pi \\eta k N}" />);
    expect(markup).toContain("katex-display");
    expect(markup).toContain("<math");
    expect(markup).toContain("</math>");
  });
});
