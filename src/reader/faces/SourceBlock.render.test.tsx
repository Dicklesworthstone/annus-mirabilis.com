import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_EDITORIAL_NOTES,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { SourceBlock } from "./SourceBlock.tsx";

describe("SourceBlock render tests", () => {
  test("renders paragraph with sentence spans and lang='de'", () => {
    const block = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((b) => b.id === "bm-s4-p1")!;
    const html = renderToStaticMarkup(
      <SourceBlock
        block={block}
        paperSlug="brownian-motion"
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
      />,
    );

    expect(html).toContain('lang="de"');
    expect(html).toContain('data-block-id="bm-s4-p1"');
    expect(html).toContain('data-sentence-id="bm-s4-p1-s1"');
    expect(html).toContain('data-sentence-id="bm-s4-p1-s2"');
    expect(html).toContain("Es sei ein Zeitintervall τ gegeben.");
  });

  test("renders locators linking to facsimile page", () => {
    const block = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((b) => b.id === "bm-s4-p1")!;
    const html = renderToStaticMarkup(<SourceBlock block={block} paperSlug="brownian-motion" />);

    expect(html).toContain('data-facsimile-link="556"');
    expect(html).toContain('href="/papers/brownian-motion/?view=facsimile#page-556"');
    expect(html).toContain("[p. 556]");
  });

  test("renders equation in printed notation only", () => {
    const block = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((b) => b.id === "bm-s4-eq1")!;
    const html = renderToStaticMarkup(<SourceBlock block={block} paperSlug="brownian-motion" />);

    expect(html).toContain('data-kind="equation"');
    expect(html).toContain('data-printed-notation="true"');
    expect(html).toContain('data-equation-label="1"');
    expect(html).toContain("(1)");
    expect(html).toContain("katex");
  });

  test("renders headings and closing dateline", () => {
    const headingBlock = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((b) => b.id === "bm-s4-h1")!;
    const headingHtml = renderToStaticMarkup(
      <SourceBlock block={headingBlock} paperSlug="brownian-motion" />,
    );
    expect(headingHtml).toContain("<h2");
    expect(headingHtml).toContain("§ 4.");

    const closingBlock = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((b) => b.id === "bm-closing")!;
    const closingHtml = renderToStaticMarkup(
      <SourceBlock block={closingBlock} paperSlug="brownian-motion" />,
    );
    expect(closingHtml).toContain("Bern, Mai 1905.");
  });

  test("renders editorial notes attached to block", () => {
    const block = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((b) => b.id === "bm-s4-p1")!;
    const html = renderToStaticMarkup(
      <SourceBlock
        block={block}
        paperSlug="brownian-motion"
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
      />,
    );

    expect(html).toContain("Historian’s Margin");
    expect(html).toContain("Einstein submitted this paper without knowing");
  });
});
