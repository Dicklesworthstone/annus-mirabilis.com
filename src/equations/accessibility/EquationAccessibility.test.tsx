import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EquationAccessibility } from "./EquationAccessibility.tsx";
import { evaluatePatternAccessibility } from "./patterns.ts";

describe("am-eq-spoken-forms-w4f: EquationAccessibility tests", () => {
  const sampleProps = {
    equationId: "eq-test-einstein",
    title: "Einstein Diffusion Relation",
    spokenText:
      "D, the diffusion coefficient, equals Boltzmann's constant k sub B times temperature T over 6 pi eta a.",
    html: '<span class="katex-html"><span class="base"><span class="mord mathnormal">D</span></span></span>',
    mathml: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mi>D</mi></math>',
  };

  test("Pattern A renders sr-only span with visual and MathML aria-hidden", () => {
    const markup = renderToStaticMarkup(
      <EquationAccessibility {...sampleProps} pattern="A" />,
    );

    expect(markup).toContain('data-pattern="A"');
    expect(markup).toContain('data-a11y-name-source="sr-only-text"');
    expect(markup).toContain('<span class="sr-only" data-a11y-spoken-name="true">');
    expect(markup).toContain("D, the diffusion coefficient, equals Boltzmann&#x27;s constant");
    expect(markup).toContain('class="equation-visual" aria-hidden="true"');
    expect(markup).toContain('class="equation-mathml" aria-hidden="true"');
  });

  test("Pattern B renders role='math' and aria-label on container with children aria-hidden", () => {
    const markup = renderToStaticMarkup(
      <EquationAccessibility {...sampleProps} pattern="B" />,
    );

    expect(markup).toContain('role="math"');
    expect(markup).toContain('data-pattern="B"');
    expect(markup).toContain('data-a11y-name-source="container-aria-label"');
    expect(markup).toContain('aria-label="D, the diffusion coefficient, equals Boltzmann&#x27;s constant');
    expect(markup).toContain('class="equation-visual" aria-hidden="true"');
    expect(markup).toContain('class="equation-mathml" aria-hidden="true"');
  });

  test("Pattern C renders aria-label on MathML element and visual KaTeX aria-hidden", () => {
    const markup = renderToStaticMarkup(
      <EquationAccessibility {...sampleProps} pattern="C" />,
    );

    expect(markup).toContain('data-pattern="C"');
    expect(markup).toContain('data-a11y-name-source="mathml-aria-label"');
    expect(markup).toContain('class="equation-visual" aria-hidden="true"');
    expect(markup).toContain('<math aria-label="D, the diffusion coefficient, equals Boltzmann\'s constant');
  });

  test("Guarantees visual KaTeX HTML is always aria-hidden in all patterns", () => {
    for (const pattern of ["A", "B", "C"] as const) {
      const markup = renderToStaticMarkup(
        <EquationAccessibility {...sampleProps} pattern={pattern} />,
      );
      expect(markup).toContain('class="equation-visual" aria-hidden="true"');
    }
  });

  test("Evaluator yields exactly one name source for every pattern", () => {
    const aEval = evaluatePatternAccessibility({ ...sampleProps, pattern: "A" });
    expect(aEval.nameSource).toBe("sr-only-text");
    expect(aEval.visualHtmlHidden).toBe(true);
    expect(aEval.mathmlHidden).toBe(true);

    const bEval = evaluatePatternAccessibility({ ...sampleProps, pattern: "B" });
    expect(bEval.nameSource).toBe("container-aria-label");
    expect(bEval.visualHtmlHidden).toBe(true);
    expect(bEval.mathmlHidden).toBe(true);

    const cEval = evaluatePatternAccessibility({ ...sampleProps, pattern: "C" });
    expect(cEval.nameSource).toBe("mathml-aria-label");
    expect(cEval.visualHtmlHidden).toBe(true);
    expect(cEval.mathmlHidden).toBe(false);
  });

  test("Prevents duplicate announcements when hasVisibleCaption is true", () => {
    const evalWithCaption = evaluatePatternAccessibility({
      ...sampleProps,
      pattern: "B",
      hasVisibleCaption: true,
    });
    expect(evalWithCaption.accessibleName).toContain("Einstein Diffusion Relation: D, the diffusion coefficient");
  });
});
