/**
 * Tests for LatexRenderer and KaTeX trust callback (am-scaf-extract-ui-components-c31 requirement 5).
 */

import { describe, expect, it } from "bun:test";
import type { TrustContext } from "katex";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LatexRenderer,
  MalformedLatexError,
  renderLatexToHtmlAndMathml,
  trustInteractiveTokenMarkup,
} from "./LatexRenderer.tsx";

describe("LatexRenderer & MathML Generation", () => {
  it("renders valid LaTeX with both HTML and MathML tags", () => {
    const html = renderLatexToHtmlAndMathml("E = mc^2");
    expect(html).toContain("<math");
    expect(html).toContain("katex-html");
    expect(html).toContain("katex-mathml");
  });

  it("throws MalformedLatexError for unparseable LaTeX and never returns raw TeX", () => {
    const badMath = String.raw`\notAValidCommand{unclosed`;
    expect(() => renderLatexToHtmlAndMathml(badMath)).toThrow(MalformedLatexError);

    try {
      renderLatexToHtmlAndMathml(badMath);
    } catch (err) {
      expect(err).toBeInstanceOf(MalformedLatexError);
      expect((err as MalformedLatexError).math).toBe(badMath);
    }
  });

  it("trust callback rejects all forbidden commands: \\href, \\url, \\includegraphics, \\htmlClass, \\htmlId, \\htmlStyle, \\htmlData", () => {
    const forbiddenContexts: readonly TrustContext[] = [
      { command: "\\href", url: "https://example.com", protocol: "https" },
      { command: "\\url", url: "https://example.com", protocol: "https" },
      { command: "\\includegraphics", url: "https://example.com" },
      { command: "\\htmlClass", class: "foo" },
      { command: "\\htmlId", id: "foo" },
      { command: "\\htmlStyle", style: "color:red" },
      { command: "\\htmlData", attributes: { foo: "bar" } },
    ];

    for (const ctx of forbiddenContexts) {
      expect(trustInteractiveTokenMarkup(ctx)).toBe(false);
    }
  });

  it("fails closed on untrusted HTML/linking commands", () => {
    // \href is untrusted and strict: "error" causes render to throw
    expect(() => renderLatexToHtmlAndMathml(String.raw`\href{javascript:alert(1)}{click}`)).toThrow(
      MalformedLatexError,
    );
    expect(() => renderLatexToHtmlAndMathml(String.raw`\includegraphics{test.png}`)).toThrow(
      MalformedLatexError,
    );
  });

  it("component renders accessible fallback rather than leaking raw TeX on malformed input", () => {
    const malformed = String.raw`\frac{incomplete`;
    const markup = renderToStaticMarkup(<LatexRenderer math={malformed} />);
    expect(markup).toContain("Mathematical notation unavailable");
    expect(markup).not.toContain(malformed);
  });

  it("negative test: naive string letter replacement corrupts LaTeX syntax", () => {
    // AGENTS.md rule: never infer meaning by replacing letters in raw LaTeX,
    // because the same symbol means different things in different sections
    // and a letter can appear inside a command name, exponent, subscript or annotation.
    const raw = String.raw`\frac{v}{c}`;
    // Naively replacing 'c' with a value like 3e8 corrupts \frac into \fra3e8 !
    const naiveReplaced = raw.replace(/c/g, "3e8");
    expect(naiveReplaced).toBe(String.raw`\fra3e8{v}{3e8}`);
    expect(() => renderLatexToHtmlAndMathml(naiveReplaced)).toThrow(MalformedLatexError);
  });
});
