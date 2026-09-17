import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { FootnoteItem, FootnotesSection } from "./Footnote.tsx";
import { GermanFace } from "./GermanFace.tsx";
import { SourceBlock } from "./SourceBlock.tsx";

describe("footnotes navigation and markup", () => {
  const paragraphWithFootnote = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((b) => b.id === "bm-s5-p1")!;
  const footnoteBlock = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((b) => b.id === "bm-s5-fn1")!;

  test("paragraph renders footnote mark with forward link to footnote item", () => {
    const html = renderToStaticMarkup(
      <SourceBlock block={paragraphWithFootnote} paperSlug="brownian-motion" />,
    );

    expect(html).toContain('id="ref-bm-s5-fn1"');
    expect(html).toContain('href="#footnote-bm-s5-fn1"');
    expect(html).toContain('aria-describedby="footnote-bm-s5-fn1"');
    expect(html).toContain("[1]");
  });

  test("footnote item renders body with backlink to footnote mark reference", () => {
    const html = renderToStaticMarkup(<FootnoteItem footnote={footnoteBlock} />);

    expect(html).toContain('id="footnote-bm-s5-fn1"');
    expect(html).toContain('role="doc-footnote"');
    expect(html).toContain("Smoluchowski hat eine ähnliche Formel abgeleitet");
    expect(html).toContain('href="#ref-bm-s5-fn1"');
    expect(html).toContain('data-footnote-backlink="bm-s5-fn1"');
  });

  test("round-trip footnote reference IDs match in full GermanFace render", () => {
    const html = renderToStaticMarkup(
      <GermanFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
      />,
    );

    // Forward reference
    expect(html).toContain('href="#footnote-bm-s5-fn1"');
    // Destination item
    expect(html).toContain('id="footnote-bm-s5-fn1"');
    // Return backlink
    expect(html).toContain('href="#ref-bm-s5-fn1"');
    // Origin reference ID
    expect(html).toContain('id="ref-bm-s5-fn1"');
  });
});
