import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_EDITORIAL_NOTES,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { GermanFace } from "./GermanFace.tsx";

describe("GermanFace readiness contract", () => {
  test("GermanFace root container emits all three harness readiness attributes", () => {
    const html = renderToStaticMarkup(
      <GermanFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
      />,
    );

    // 1. data-reader-root: marks the single reader root element for the browser test harness
    expect(html).toContain("data-reader-root");
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);

    // 2. data-ready="true": signals readiness to the harness without arbitrary sleeps
    expect(html).toContain('data-ready="true"');

    // 3. data-view="german": identifies the German source face specifically
    expect(html).toContain('data-view="german"');
    expect(html).toContain('data-face="german"');
  });

  test("section-scoped GermanFace preserves all three readiness contract attributes", () => {
    const html = renderToStaticMarkup(
      <GermanFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        sectionId="section-5"
      />,
    );

    expect(html).toContain("data-reader-root");
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="german"');
  });

  test("data-view explicitly identifies the 'german' face specifically rather than any other face", () => {
    const html = renderToStaticMarkup(
      <GermanFace paper={FIXTURE_BROWNIAN_PAPER} blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS} />,
    );

    const viewMatch = html.match(/data-view="([^"]+)"/);
    expect(viewMatch).not.toBeNull();
    expect(viewMatch?.[1]).toBe("german");
  });

  test("data-ready is explicitly asserted as 'true'", () => {
    const html = renderToStaticMarkup(
      <GermanFace paper={FIXTURE_BROWNIAN_PAPER} blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS} />,
    );

    const readyMatch = html.match(/data-ready="([^"]+)"/);
    expect(readyMatch).not.toBeNull();
    expect(readyMatch?.[1]).toBe("true");
  });
});
