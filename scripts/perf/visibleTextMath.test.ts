import { describe, expect, test } from "bun:test";
import { checkVisibleTextAndMath } from "./visibleTextMath.ts";

describe("Visible Text and Math Static Verification", () => {
  const validHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @font-face {
            font-family: 'Newsreader-Fallback';
            src: local('Times New Roman');
            size-adjust: 104%;
            ascent-override: 95%;
            descent-override: 25%;
            line-gap-override: 0%;
          }
        </style>
      </head>
      <body>
        <article>
          <p id="p-1">In this paper it will be shown that according to the molecular-kinetic theory of heat...</p>
          <div class="katex-display">
            <span class="katex">
              <span class="katex-mathml">
                <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
                  <semantics><mrow><msub><mi>λ</mi><mi>x</mi></msub><mo>=</mo><msqrt><mrow><mn>2</mn><mi>D</mi><mi>t</mi></mrow></msqrt></mrow></semantics>
                </math>
              </span>
              <span class="katex-html" aria-hidden="true"><span class="base"><span class="strut"></span></span></span>
            </span>
          </div>
        </article>
      </body>
    </html>
  `;

  test("passes when R1 text, KaTeX, MathML, and font metric overrides are present", () => {
    const result = checkVisibleTextAndMath(validHtml, {
      expectedParagraphTexts: ["In this paper it will be shown"],
    });
    expect(result.ok).toBe(true);
    expect(result.mathMlCount).toBeGreaterThan(0);
    expect(result.katexCount).toBeGreaterThan(0);
    expect(result.fontOverridesFound).toEqual([
      "size-adjust",
      "ascent-override",
      "descent-override",
      "line-gap-override",
    ]);
  });

  test("fails when expected R1 text is missing from initial HTML (e.g. CSR rendered)", () => {
    const result = checkVisibleTextAndMath(validHtml, {
      expectedParagraphTexts: ["Some text that only renders via JavaScript"],
    });
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain("is missing from initial HTML");
  });

  test("fails when MathML (<math>) is missing from math markup", () => {
    const htmlNoMathMl = `<div class="katex"><span class="katex-html">...</span></div>`;
    const result = checkVisibleTextAndMath(htmlNoMathMl);
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain("lacks <math> (MathML) element");
  });

  test("fails when font metric overrides are missing from CSS", () => {
    const cssWithoutOverrides = `@font-face { font-family: 'Newsreader'; src: url('/fonts/Newsreader.woff2'); }`;
    const result = checkVisibleTextAndMath(validHtml, {
      cssContent: cssWithoutOverrides,
    });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("size-adjust"))).toBe(true);
  });
});
