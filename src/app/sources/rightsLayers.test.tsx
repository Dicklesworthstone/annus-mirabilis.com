import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import Sources from "./page";
import { SourcesError } from "./refusals.ts";
import {
  licenseDecision,
  noticeSections,
  REPOSITORY,
  rightsLayers,
  runtimeLibraries,
} from "./rightsLayers.ts";

/**
 * /sources/ states each rights layer's own status, read from the records (am-design-sources-about-zumd,
 * dispatch 150). The rendered page is checked against NOTICE.md, package.json and docs/DECISIONS.md
 * themselves, so a record that changes changes what these tests expect.
 */
const ROOT = process.cwd();
const NOTICE = readFileSync(join(ROOT, "NOTICE.md"), "utf8");
const html = renderToStaticMarkup(<Sources />);
const start = html.indexOf('id="sources-layers"');
const section = html
  .slice(start, html.indexOf("</section>", start))
  .replace(/<[^>]+>/g, " ")
  // React writes a straight apostrophe as &#x27;; NOTICE.md's words use straight ones.
  .replace(/&#x27;/g, "'")
  .replace(/&rsquo;/g, "’")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

describe("/sources/ rights, layer by layer", () => {
  test("every layer NOTICE.md records is on the page, with the words its record gives", () => {
    const layers = rightsLayers(NOTICE);
    // Guard: a parser that found nothing would pass the loop below vacuously.
    expect(layers.length).toBeGreaterThan(8);
    for (const layer of layers) {
      expect(html).toContain(`id="layer-${layer.id}"`);
      // Every layer but the libraries (computed from package.json below) states something recorded.
      if (layer.id !== "libraries") expect(layer.statements.length).toBeGreaterThan(0);
      for (const statement of layer.statements) {
        const words = statement.replace(/^[^:]+: /, "");
        expect({ layer: layer.id, found: section.includes(words) }).toEqual({
          layer: layer.id,
          found: true,
        });
      }
    }
    // The layers that carry a license say which one, from NOTICE.md's own License line.
    for (const heading of ["English translation", "Explanatory prose", "Code"]) {
      const license = noticeSections(NOTICE)
        .find((s) => s.heading === heading)
        ?.bullets.find((b) => b.key === "License")?.text;
      expect(license).toBeDefined();
      expect(section).toContain(license as string);
    }
  });

  test("the libraries are package.json's dependencies, each with its own package's license", () => {
    const libraries = runtimeLibraries(ROOT);
    expect(libraries.length).toBeGreaterThan(0);
    for (const { name, license } of libraries) {
      expect(license).toBeDefined();
      expect(section).toContain(`${name} (${license})`);
    }
  });

  test("the third-party notices are reachable from the page, and the file exists", () => {
    expect(html).toContain(`href="${REPOSITORY}/blob/main/THIRD_PARTY_NOTICES.md"`);
    expect(existsSync(join(ROOT, "THIRD_PARTY_NOTICES.md"))).toBe(true);
    expect(html).toContain(`href="${REPOSITORY}/blob/main/NOTICE.md"`);
  });

  test("the scans' terms are counted from their receipts", () => {
    const entries = html.split('<li class="sources-entry">').length - 1;
    expect(entries).toBeGreaterThan(0);
    expect(section).toMatch(/From their receipts: .+\(\w+ of the \w+ scans\)\./);
  });

  test("the license status is the decision record's: its date, and whether the owner ratified it", () => {
    const decision = licenseDecision(readFileSync(join(ROOT, "docs", "DECISIONS.md"), "utf8"));
    expect(decision.date).toBe("2026-09-16");
    expect(section).toContain("decided on 16 September 2026");
    expect(section.includes("has not yet ratified it")).toBe(!decision.ownerRatified);
  });
});

describe("the records the section reads", () => {
  const entry = (status: string) =>
    `## D-2026-09-16-license-and-rider\n\n- **Status:** ${status}\n- **Date:** 2026-09-16.\n\n## D-next\n`;

  test("a decision the owner has not ratified reads as not ratified, and one he has as ratified", () => {
    expect(
      licenseDecision(
        entry("DECIDED 2026-09-16 under delegated authority, **not** owner-ratified."),
      ).ownerRatified,
    ).toBe(false);
    expect(
      licenseDecision(entry("DECIDED 2026-09-16, owner-ratified on 2026-10-01.")).ownerRatified,
    ).toBe(true);
  });

  test('a missing decision entry refuses with "license-decision-missing"', () => {
    expect(() => licenseDecision("## D-something-else\n")).toThrow(SourcesError);
    try {
      licenseDecision("## D-something-else\n");
    } catch (error) {
      expect((error as SourcesError).code).toBe("license-decision-missing");
    }
  });

  test('a NOTICE.md without one of the layers refuses with "notice-layer-missing"', () => {
    const withoutFonts = NOTICE.replace(/^## Fonts$/m, "## Typefaces");
    expect(withoutFonts).not.toBe(NOTICE);
    try {
      rightsLayers(withoutFonts);
      throw new Error("expected a refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(SourcesError);
      expect((error as SourcesError).code).toBe("notice-layer-missing");
    }
  });
});
