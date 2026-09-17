import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Formula } from "./Formula.tsx";

describe("Formula (edition/Formula.tsx, am-bc6s)", () => {
  test("renders as a div with className formula and data-latex, with NO bulk tabIndex by default", () => {
    const markup = renderToStaticMarkup(<Formula latex="E = mc^2" />);
    expect(markup).toMatch(/^<div\b[^>]*\bclass="formula"/);
    expect(markup).toContain('data-latex="E = mc^2"');
    // Must NOT have tabindex statically by default to prevent ~69 useless tab stops (am-bc6s)
    expect(markup).not.toContain("tabindex");
    // Must NOT be a section to prevent landmark-unique violations
    expect(markup).not.toMatch(/^<section\b/);
  });

  test("does not set static aria-label to prevent landmark duplication", () => {
    const markup = renderToStaticMarkup(<Formula latex="\\lambda_m T = b" />);
    expect(markup).not.toContain("aria-label");
  });

  test("respects an explicit tabIndex prop if provided", () => {
    const markup = renderToStaticMarkup(<Formula latex="E = mc^2" tabIndex={0} />);
    expect(markup).toContain('tabindex="0"');
  });

  test("renders KaTeX HTML and MathML elements within the div", () => {
    const markup = renderToStaticMarkup(<Formula latex="D = \\frac{RT}{6\\pi \\eta k N}" />);
    expect(markup).toContain("katex-display");
    expect(markup).toContain("<math");
    expect(markup).toContain("</math>");
  });
});
