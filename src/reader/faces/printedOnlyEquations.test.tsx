import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
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
    const englishHtml = renderToStaticMarkup(
      <TranslationUnit unit={englishEqUnit} />,
    );

    // Both contain the exact same printed formula mathml/html content
    expect(germanHtml).toContain("katex");
    expect(englishHtml).toContain("katex");
    expect(germanHtml).toContain("eq-diffusion-1d");
  });
});
