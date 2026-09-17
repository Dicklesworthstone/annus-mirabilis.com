import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_EDITORIAL_NOTES,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { GermanFace } from "./GermanFace.tsx";

describe("GermanFace render tests", () => {
  test("renders full German source face with metadata, masthead, and dateline", () => {
    const html = renderToStaticMarkup(
      <GermanFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
      />,
    );

    expect(html).toContain('data-view="german"');
    expect(html).toContain('data-face="german"');
    expect(html).toContain('lang="de"');
    expect(html).toContain("Über die von der molekularkinetischen Theorie");
    expect(html).toContain("von A. Einstein");
    expect(html).toContain("Bern, Mai 1905.");
    expect(html).toContain("Annalen der Physik (4) 17, 549–560 (1905)");
  });

  test("renders footnotes section at the bottom with backlinks", () => {
    const html = renderToStaticMarkup(
      <GermanFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
      />,
    );

    expect(html).toContain("Fußnoten");
    expect(html).toContain('id="footnote-bm-s5-fn1"');
    expect(html).toContain("Smoluchowski hat eine ähnliche Formel abgeleitet");
    expect(html).toContain('href="#ref-bm-s5-fn1"');
  });

  test("renders alignment controller island markup", () => {
    const html = renderToStaticMarkup(
      <GermanFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
      />,
    );

    expect(html).toContain('data-alignment-live-region="true"');
  });
});
