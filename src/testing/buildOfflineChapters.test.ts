import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { INLINE_SCRIPT_REGISTRY } from "../app/inline-scripts/registry.ts";
import {
  collectChapterFoundations,
  type OfflineChapterInput,
  packageOfflineChapter,
} from "../platform/offline/chapter.ts";
import { chapterFixture } from "../platform/offline/chapter.test.mjs";
import { OFFLINE_DETAIL_SOURCE } from "../platform/offline/detail.inline.ts";

function mockRenderMath(latex: string): string {
  return `<span class="katex"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>${latex}</mi></mrow></semantics></math></span>`;
}

function fixtureInput(): OfflineChapterInput {
  return chapterFixture() as unknown as OfflineChapterInput;
}

describe("buildOfflineChapters: packaging, inlining, and reproducibility", () => {
  test("generates self-contained HTML with inlined KaTeX HTML+MathML and styles", () => {
    const fixture = fixtureInput();
    const pkg = packageOfflineChapter(fixture, mockRenderMath);

    expect(pkg.html.startsWith("<!doctype html>")).toBe(true);
    expect(pkg.entry.bytes).toBe(Buffer.byteLength(pkg.html));
    expect(pkg.entry.gzipBytes).toBeGreaterThan(0);
    expect(pkg.entry.gzipBytes).toBeLessThan(pkg.entry.bytes);

    // Inlined styles and print rules
    expect(pkg.html).toContain("<style>");
    expect(pkg.html).toContain("@media print");

    // Static KaTeX MathML
    expect(pkg.html).toContain("<math");
    expect(pkg.html).toContain("katex");

    // Landmarks and accessibility
    expect(pkg.html).toContain("<header");
    expect(pkg.html).toContain("<main>");
    expect(pkg.html).toContain("<footer");
    expect(pkg.html).toContain("<article");
    expect(pkg.html).toContain('lang="en"');
    expect(pkg.html).toContain('lang="de"');
    expect(pkg.html).toContain('href="#s4">Skip to the chapter</a>');
  });

  test("two builds of identical inputs produce byte-identical files and hashes", () => {
    const fixture1 = fixtureInput();
    const fixture2 = fixtureInput();

    const pkg1 = packageOfflineChapter(fixture1, mockRenderMath);
    const pkg2 = packageOfflineChapter(fixture2, mockRenderMath);

    expect(pkg1.html).toBe(pkg2.html);
    expect(pkg1.entry.sha256).toBe(pkg2.entry.sha256);
    expect(pkg1.entry.bytes).toBe(pkg2.entry.bytes);
    expect(pkg1.entry.gzipBytes).toBe(pkg2.entry.gzipBytes);
  });

  test("size budget gate fails a seeded oversized chapter and names its largest contributors", () => {
    const fixture = fixtureInput();
    // Set an artificially small budget
    const tinyBudgetFixture: OfflineChapterInput = {
      ...fixture,
      budget: { rawBytes: 500, gzipBytes: 200 },
    };

    let thrownError: Error | null = null;
    try {
      packageOfflineChapter(tinyBudgetFixture, mockRenderMath);
    } catch (err) {
      thrownError = err as Error;
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError).toBeInstanceOf(RangeError);
    expect(thrownError?.message).toContain("exceeds budget");
    expect(thrownError?.message).toContain("contributors");
    expect(thrownError?.message).toContain("stylesAndFonts");
    expect(thrownError?.message).toContain("textAndStructure");
  });

  test("readings are all present, with reading 1 (full explanation) visible without JavaScript", () => {
    const fixture = fixtureInput();
    const pkg = packageOfflineChapter(fixture, mockRenderMath);

    // Reading 0, 2, 3 must have hidden attribute
    expect(pkg.html).toContain('<div data-reading="0" hidden>');
    expect(pkg.html).toContain('<div data-reading="1">'); // no hidden
    expect(pkg.html).toContain('<div data-reading="2" hidden>');
    expect(pkg.html).toContain('<div data-reading="3" hidden>');

    // Noscript notice informs user full explanation is readable
    expect(pkg.html).toContain("<noscript><p>JavaScript is off.");
  });

  test("foundation closure collects transitive prerequisites deterministically", () => {
    const fixture = fixtureInput();
    const foundations = collectChapterFoundations(fixture.arguments, fixture.foundations);

    // Both "squares" and its prerequisite "arithmetic" must be present in sorted order
    expect(foundations.map((f) => f.id)).toEqual(["arithmetic", "squares"]);
  });

  test("identity block contains all required provenance and revision fields", () => {
    const fixture = fixtureInput();
    const pkg = packageOfflineChapter(fixture, mockRenderMath);

    expect(pkg.html).toContain("<dt>Generated</dt>");
    expect(pkg.html).toContain(fixture.identity.generatedAt);
    expect(pkg.html).toContain("<dt>Content revision</dt>");
    expect(pkg.html).toContain(fixture.identity.contentRevision);
    expect(pkg.html).toContain("<dt>Translation revision</dt>");
    expect(pkg.html).toContain("<dt>Build digest</dt>");
    expect(pkg.html).toContain(fixture.identity.buildDigest);
    expect(pkg.html).toContain("<dt>Release</dt>");
  });

  test("rights filtering embeds publish assets and cites non-publish assets", () => {
    const fixture = fixtureInput();
    const inputWithFigures: OfflineChapterInput = {
      ...fixture,
      figures: [
        {
          id: "fig-pub",
          title: "Public Domain Diagram",
          publicationDecision: "publish",
          mimeType: "image/png",
          bytes: new Uint8Array([1, 2, 3, 4]),
          caption: "PD Diagram",
        },
        {
          id: "fig-cited",
          title: "Cited Historical Diagram",
          publicationDecision: "reference-only",
          locator: "Figure 3, page 552",
          url: "https://example.org/fig3",
        },
      ],
    };

    const pkg = packageOfflineChapter(inputWithFigures, mockRenderMath);
    expect(pkg.html).toContain('class="offline-figure"');
    expect(pkg.html).toContain('data:image/png;base64,AQIDBA==');
    expect(pkg.html).toContain('class="cited-asset"');
    expect(pkg.html).toContain("Excluded from offline edition; rights designation: reference-only.");
  });

  test("AC4: inline script hash matches registry entry and CSP meta tag authorizes it", () => {
    const fixture = fixtureInput();
    const pkg = packageOfflineChapter(fixture, mockRenderMath);

    const registryEntry = INLINE_SCRIPT_REGISTRY.find((s) => s.id === "offline-detail");
    expect(registryEntry).toBeDefined();
    expect(registryEntry?.source).toBe(OFFLINE_DETAIL_SOURCE);

    const expectedHash = createHash("sha256").update(OFFLINE_DETAIL_SOURCE, "utf8").digest("base64");
    expect(pkg.scriptHash).toBe(expectedHash);
    expect(pkg.html).toContain(`script-src &#39;sha256-${expectedHash}&#39;`);
    expect(pkg.html).toContain(`<script>${OFFLINE_DETAIL_SOURCE}</script>`);

    // Strict CSP sandbox directives
    expect(pkg.html).toContain("default-src &#39;none&#39;");
    expect(pkg.html).toContain("connect-src &#39;none&#39;");
    expect(pkg.html).toContain("base-uri &#39;none&#39;");
    expect(pkg.html).toContain("form-action &#39;none&#39;");
  });

  test("AC2: cold offline chapter is completely self-contained with no external resource requests", () => {
    const fixture = fixtureInput();
    const pkg = packageOfflineChapter(fixture, mockRenderMath);

    // No external scripts or styles
    expect(pkg.html).not.toMatch(/<script[^>]+src=/i);
    expect(pkg.html).not.toMatch(/<link[^>]+(?:stylesheet|preload)/i);
    expect(pkg.html).not.toMatch(/<img[^>]+src=["'](?!data:)[^"']+["']/i);

    // Only one authorized inline script
    expect(pkg.html.match(/<script[\s>]/g)?.length).toBe(1);

    // Network connection blocking
    expect(pkg.html).toContain("connect-src &#39;none&#39;");
  });

  test("AC8: generated chapter passes accessibility contract and includes print emulation styles", () => {
    const fixture = fixtureInput();
    const pkg = packageOfflineChapter(fixture, mockRenderMath);

    // Accessibility landmarks and attributes
    expect(pkg.html).toContain("<header data-print-header>");
    expect(pkg.html).toContain("<main>");
    expect(pkg.html).toContain("<footer data-print-footer>");
    expect(pkg.html).toContain('lang="en"');
    expect(pkg.html).toContain('lang="de"');
    expect(pkg.html).toContain('role="region"');
    expect(pkg.html).toContain('tabindex="0"');

    // Print media styling inlined
    expect(pkg.html).toContain("@media print");
    expect(pkg.html).toContain("[data-screen-only]");
    expect(pkg.html).toContain(".katex-html { display: block !important; }");
  });
});
