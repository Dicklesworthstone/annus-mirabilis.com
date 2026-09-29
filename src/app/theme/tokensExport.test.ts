import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { THEME_IDS, THEME_TOKENS } from "./tokens";

const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "themes.css"), "utf-8");

function cssBlockFor(themeId: string): string {
  const selector =
    themeId === "annalen"
      ? ':root,\\s*:root\\[data-theme="annalen"\\]'
      : `:root\\[data-theme="${themeId}"\\]`;
  const pattern = new RegExp(`${selector}\\s*\\{([^}]*)\\}`);
  const match = CSS.match(pattern);
  if (!match?.[1]) throw new Error(`No CSS block found for theme '${themeId}'.`);
  return match[1];
}

function cssValue(block: string, property: string): string {
  const match = block.match(new RegExp(`--${property}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`No '--${property}' declaration in the CSS block.`);
  return match[1].trim();
}

describe("tokensExport: CSS and TypeScript tokens stay in sync", () => {
  for (const id of THEME_IDS) {
    test(`${id}: every CSS custom property matches THEME_TOKENS exactly`, () => {
      const block = cssBlockFor(id);
      const tokens = THEME_TOKENS[id];
      expect(cssValue(block, "paper")).toBe(tokens.paper);
      expect(cssValue(block, "ink")).toBe(tokens.ink);
      expect(cssValue(block, "muted")).toBe(tokens.muted);
      expect(cssValue(block, "rule")).toBe(tokens.rule);
      expect(cssValue(block, "accent")).toBe(tokens.accent);
      expect(cssValue(block, "focus-ring")).toBe(tokens.focusRing);
      expect(cssValue(block, "wash")).toBe(tokens.wash);
      expect(cssValue(block, "plot")).toBe(tokens.plot);
      expect(cssValue(block, "plot-darkfield")).toBe(tokens.plotDarkfield);
    });
  }

  // Without JavaScript no data-theme is set, and the dark theme comes from this media block, whose
  // comment says it repeats Kramgasse Night and to "change both together". Nothing checked it: a
  // --plot missing from it left every test green and a no-JavaScript dark reader with the light
  // theme's chart colour at 1.77:1.
  test("the no-JavaScript dark block declares exactly what Kramgasse Night declares", () => {
    /*
      THE PREFIX IS TOLERATED, THE COMPARISON IS NOT (dispatch 464). bd352d20 made the dark theme a
      SCREEN theme, because a reader whose device is dark was printing near-white ink on white paper,
      so this block is now `@media screen and (prefers-color-scheme: dark)`. The locator hard-coded
      the unprefixed text and threw "No prefers-color-scheme dark block", which reads as the two
      palettes having diverged when they had not: both lists are ten declarations and identical.

      Only the way the block is FOUND changes. What is asserted below is untouched and still exact:
      the block must exist, it must contain :root:not([data-theme]), and its declarations must equal
      Kramgasse Night's set for set. A missing --plot here once left a no-JavaScript dark reader with
      the light theme's chart colour at 1.77:1, which is what this test exists to catch, and it
      still fails on exactly that.
    */
    const media = CSS.match(
      /@media (?:screen and )?\(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme\]\)\s*\{([^}]*)\}/,
    );
    if (!media?.[1])
      throw new Error("No prefers-color-scheme dark block for :root:not([data-theme]).");
    const declarations = (block: string) =>
      Object.fromEntries(
        [...block.matchAll(/(--[\w-]+|color-scheme):\s*([^;]+);/g)].map((m) => [
          m[1],
          m[2]?.trim(),
        ]),
      );
    const night = declarations(cssBlockFor("kramgasse-night"));
    expect(Object.keys(night).length).toBeGreaterThan(5);
    expect(declarations(media[1])).toEqual(night);
  });

  test("the CSS declares exactly the three themes THEME_IDS names, no more and no fewer", () => {
    const declared = [...CSS.matchAll(/:root\[data-theme="([a-z-]+)"\]/g)].map((m) => m[1]);
    expect(new Set(declared)).toEqual(new Set(THEME_IDS));
  });

  test("the three font-family tokens name exactly Newsreader, Plus Jakarta Sans, and JetBrains Mono", () => {
    // Whitespace collapsed first: a stack longer than Biome's 100 columns is wrapped onto
    // continuation lines after the colon, and the claim here is about the first family.
    const flat = CSS.replace(/\s+/g, " ");
    expect(flat).toContain('--font-serif: "Newsreader"');
    expect(flat).toContain('--font-sans: "Plus Jakarta Sans"');
    expect(flat).toContain('--font-mono: "JetBrains Mono"');
  });
});
