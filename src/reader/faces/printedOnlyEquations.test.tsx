import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { verifyEquationTranslation } from "../../content/schemas/source.ts";
import {
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { SourceBlock } from "./SourceBlock.tsx";
import { TranslationUnit } from "./TranslationUnit.tsx";

describe("printedOnlyEquations: notation is never modernized on source or translation faces", () => {
  const germanEqBlock = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((b) => b.id === "bm-s4-eq1")!;
  const englishEqUnit = FIXTURE_BROWNIAN_TRANSLATION_UNITS.find((u) => u.id === "tr-bm-s4-eq1")!;

  test("German face equation renders strictly in printed notation", () => {
    const html = renderToStaticMarkup(
      <SourceBlock block={germanEqBlock} paperSlug="brownian-motion" />,
    );

    expect(html).toContain('data-printed-notation="true"');
    // Does not have modern notation toggle or switches
    expect(html).not.toContain("data-modern-notation");
    expect(html).not.toContain("toggle-notation");
  });

  test("English translation face equation matches German source equation notation byte-for-byte", () => {
    const germanHtml = renderToStaticMarkup(
      <SourceBlock block={germanEqBlock} paperSlug="brownian-motion" />,
    );
    const englishHtml = renderToStaticMarkup(<TranslationUnit unit={englishEqUnit} />);

    // Both contain the exact same printed formula mathml/html content
    expect(germanHtml).toContain("katex");
    expect(englishHtml).toContain("katex");
    expect(germanHtml).toContain("eq-diffusion-1d");

    // Extract the equation-body content from each
    const extractBody = (html: string) => {
      const match = html.match(/<div class="equation-body"[^>]*>([\s\S]*?)<\/div>/);
      return match?.[1] ?? "";
    };

    const germanBody = extractBody(germanHtml);
    const englishBody = extractBody(englishHtml);

    expect(germanBody.length).toBeGreaterThan(0);
    expect(englishBody.length).toBeGreaterThan(0);
    // Byte-for-byte exact match of KaTeX display math
    expect(englishBody).toBe(germanBody);
  });

  test("NEGATIVE: English equation with translated notation fails byte-identity and throws", () => {
    // Attempting to translate notation (e.g. replacing \nu with n or V with c in 1905 equations)
    // 1. Render check fails byte-identity
    const modifiedEnglishUnit = {
      ...englishEqUnit,
      inlines: [
        {
          kind: "math" as const,
          latex: "\\frac{\\partial n}{\\partial t} = D \\frac{\\partial^2 n}{\\partial x^2}",
          equationId: "eq-diffusion-1d",
        },
      ],
    };

    const germanHtml = renderToStaticMarkup(
      <SourceBlock block={germanEqBlock} paperSlug="brownian-motion" />,
    );
    const modifiedEnglishHtml = renderToStaticMarkup(
      <TranslationUnit unit={modifiedEnglishUnit} />,
    );

    const extractBody = (html: string) => {
      const match = html.match(/<div class="equation-body"[^>]*>([\s\S]*?)<\/div>/);
      return match ? match[1] : "";
    };

    expect(extractBody(modifiedEnglishHtml)).not.toBe(extractBody(germanHtml));

    // 2. Schema / compiler verification throws typed error
    expect(() =>
      verifyEquationTranslation(
        "\\frac{\\partial \\nu}{\\partial t} = D \\frac{\\partial^2 \\nu}{\\partial x^2}",
        "\\frac{\\partial n}{\\partial t} = D \\frac{\\partial^2 n}{\\partial x^2}",
        "eq-diffusion-1d",
      ),
    ).toThrow("Notation must never be translated.");
  });
});
