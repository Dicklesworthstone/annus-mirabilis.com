import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";
import { PaperReader } from "../PaperReader.tsx";

describe("am-read-detail-axis-sfc: static reading emission", () => {
  test("PaperReader emits all four readings statically into markup with R1 visible and R0/R2/R3 hidden", async () => {
    const element = await PaperReader({});
    const html = await exportMarkup(element);

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
    // R2 is rendered ONCE, as the per-passage disclosure: closed and not hidden, so it opens
    // without JavaScript, and ReaderController opens it at "Show every step". It used to be a
    // hidden div AND the same blocks again in a separate disclosure (149,096 bytes twice on the
    // Brownian page), so no div copy may come back.
    expect(html).toMatch(/<details class="local-steps reading-version" data-reading="2">/);
    expect(html).not.toContain('<div data-reading="2"');
    // R3 is present and hidden. Its class list is presentation, not the contract: 9a4c224a added
    // callout-limit to the modern margin and four exact-string checks went red.
    expect(html).toMatch(/<aside\b[^>]*\sdata-reading="3"[^>]*\shidden=""/);

    // The same element is the no-JS per-passage expansion, exactly once per passage.
    const units = (html.match(/<article\b[^>]*\sdata-unit="/g) ?? []).length;
    expect(units).toBeGreaterThan(0);
    expect((html.match(/data-reading="2"/g) ?? []).length).toBe(units);
    expect((html.match(/<summary>Show every step here:/g) ?? []).length).toBe(units);

    // Passage actions include Why? link for arg-bm-observable (am-10ba)
    expect(html).toContain('href="/foundations/mean-variance-rms/"');
    expect(html).toContain('data-foundation="mean-variance-rms"');
    expect(html).toContain(">Why?</a>");
  });

  test("PaperPage emits all four readings statically for generic paper routes", async () => {
    const element = await PaperPage({ paperId: "brownian-motion" });
    const html = await exportMarkup(element);

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
    // R2 once, as the closed per-passage disclosure (see the PaperReader test above).
    expect(html).toMatch(/<details class="local-steps reading-version" data-reading="2">/);
    expect(html).not.toContain('<div data-reading="2"');
    // R3 is present and hidden. Its class list is presentation, not the contract: 9a4c224a added
    // callout-limit to the modern margin and four exact-string checks went red.
    expect(html).toMatch(/<aside\b[^>]*\sdata-reading="3"[^>]*\shidden=""/);

    // The same element is the no-JS per-passage expansion, exactly once per passage.
    const units = (html.match(/<article\b[^>]*\sdata-unit="/g) ?? []).length;
    expect(units).toBeGreaterThan(0);
    expect((html.match(/data-reading="2"/g) ?? []).length).toBe(units);
    expect((html.match(/<summary>Show every step here:/g) ?? []).length).toBe(units);

    // Passage actions include Why? link for arg-bm-observable (am-10ba)
    expect(html).toContain('href="/foundations/mean-variance-rms/"');
    expect(html).toContain('data-foundation="mean-variance-rms"');
    expect(html).toContain(">Why?</a>");
  });

  test("planted negative: removing or corrupting the Why? link fails the detection check", async () => {
    const readerHtml = await exportMarkup(await PaperReader({}));
    const pageHtml = await exportMarkup(await PaperPage({ paperId: "brownian-motion" }));

    const assertIndexHasWhyLink = (html: string) => {
      expect(html).toContain('data-unit="arg-bm-observable"');
      expect(html).toContain('href="/foundations/mean-variance-rms/"');
      expect(html).toContain('data-foundation="mean-variance-rms"');
      expect(html).toContain(">Why?</a>");
    };

    // Real render contains the link and passes detection
    assertIndexHasWhyLink(readerHtml);
    assertIndexHasWhyLink(pageHtml);

    // Planted negative 1: omitting the Why? link fails the check
    const strippedLink = readerHtml.replaceAll(">Why?</a>", "");
    expect(() => assertIndexHasWhyLink(strippedLink)).toThrow();

    // Planted negative 2: pointing to wrong foundation destination fails the check
    const wrongHref = readerHtml.replaceAll(
      'href="/foundations/mean-variance-rms/"',
      'href="/foundations/bridge-negative-numbers-direction/"',
    );
    expect(() => assertIndexHasWhyLink(wrongHref)).toThrow();

    // Planted negative 3: missing foundation data attribute fails the check
    const strippedAttr = readerHtml.replaceAll('data-foundation="mean-variance-rms"', "");
    expect(() => assertIndexHasWhyLink(strippedAttr)).toThrow();
  });
});
