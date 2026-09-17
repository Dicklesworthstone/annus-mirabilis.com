import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PaperPage } from "../PaperPage.tsx";
import { PaperReader } from "../PaperReader.tsx";

describe("emitReadings.integration (am-read-detail-axis-sfc)", () => {
  test("paragraph unit contains exactly four readings with R1 visible and R0, R2, R3 hidden", async () => {
    const page = await PaperReader({ section: "s4" });
    const html = renderToStaticMarkup(page);

    // Verify unit container
    expect(html).toContain('data-unit="arg-bm-observable"');

    // Verify readings R0 to R3
    expect(html).toContain('<div data-reading="0" hidden="" class="reading-version">');
    expect(html).toContain('<div data-reading="1" class="reading-version">');
    expect(html).toContain('<div data-reading="2" hidden="" class="reading-version">');
    expect(html).toContain('<aside class="modern-margin" data-reading="3" hidden="">');
  });

  test("equation unit emits semantic structure within the passage unit", async () => {
    const page = await PaperReader({ section: "s4" });
    const html = renderToStaticMarkup(page);

    // Semantic equations rendered within the passage
    expect(html).toContain("semantic-equation");
    expect(html).toContain('data-equation-id="eq-model-bm-apparent-speed"');
  });

  test("no-JS per-unit expansion exists as a static disclosure", async () => {
    const page = await PaperReader({ section: "s4" });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('<details class="local-steps">');
    expect(html).toContain("<summary>Show every step here:");
  });

  test("static paper route produces all four readings for each argument unit", async () => {
    const page = await PaperPage({ paperId: "brownian-motion" });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('data-reader-root="true"');
    expect(html).toContain('data-unit="arg-bm-observable"');
    expect(html).toContain('data-reading="0"');
    expect(html).toContain('data-reading="1"');
    expect(html).toContain('data-reading="2"');
    expect(html).toContain('data-reading="3"');
  });
});
