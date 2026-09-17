import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PaperPage } from "../PaperPage.tsx";
import { PaperReader } from "../PaperReader.tsx";

describe("am-read-detail-axis-sfc: static reading emission", () => {
  test("PaperReader emits all four readings statically into markup with R1 visible and R0/R2/R3 hidden", async () => {
    const element = await PaperReader({});
    const html = renderToStaticMarkup(element);

    // Document root structure
    expect(html).toContain('data-reader-root="true"');
    expect(html).toContain('data-view="reading"');

    // Passage contains data-unit attribute
    expect(html).toContain('data-unit="arg-bm-observable"');

    // All four readings are present in the static markup
    expect(html).toContain('data-reading="0"');
    expect(html).toContain('data-reading="1"');
    expect(html).toContain('data-reading="2"');
    expect(html).toContain('data-reading="3"');

    // R1 is visible by default (does not carry hidden), while R0, R2, R3 carry hidden attribute
    // Check reading-version containers
    expect(html).toMatch(/<div data-reading="0" hidden="" class="reading-version">/);
    expect(html).toMatch(/<div data-reading="1" class="reading-version">/);
    expect(html).toMatch(/<div data-reading="2" hidden="" class="reading-version">/);
    expect(html).toMatch(/<aside class="modern-margin" data-reading="3" hidden="">/);

    // No-JS per-unit expansion disclosure exists statically
    expect(html).toContain('<details class="local-steps">');
    expect(html).toContain("<summary>Show every step here:");
  });

  test("PaperPage emits all four readings statically for generic paper routes", async () => {
    const element = await PaperPage({ paperId: "brownian-motion" });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-reader-root="true"');
    expect(html).toContain('data-unit="arg-bm-observable"');

    // Static emission of all 4 readings
    expect(html).toContain('data-reading="0"');
    expect(html).toContain('data-reading="1"');
    expect(html).toContain('data-reading="2"');
    expect(html).toContain('data-reading="3"');

    // R1 visible by default; others hidden
    expect(html).toMatch(/<div data-reading="0" hidden="" class="reading-version">/);
    expect(html).toMatch(/<div data-reading="1" class="reading-version">/);
    expect(html).toMatch(/<div data-reading="2" hidden="" class="reading-version">/);
    expect(html).toMatch(/<aside class="modern-margin" data-reading="3" hidden="">/);

    // No-JS local-steps disclosure exists statically
    expect(html).toContain('<details class="local-steps">');
    expect(html).toContain("<summary>Show every step here:");
  });
});
