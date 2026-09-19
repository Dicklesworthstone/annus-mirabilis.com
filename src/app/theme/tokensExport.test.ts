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
      expect(cssValue(block, "plot-darkfield")).toBe(tokens.plotDarkfield);
    });
  }

  test("the CSS declares exactly the three themes THEME_IDS names, no more and no fewer", () => {
    const declared = [...CSS.matchAll(/:root\[data-theme="([a-z-]+)"\]/g)].map((m) => m[1]);
    expect(new Set(declared)).toEqual(new Set(THEME_IDS));
  });

  test("the three font-family tokens name exactly Newsreader, Plus Jakarta Sans, and JetBrains Mono", () => {
    expect(CSS).toContain('--font-serif: "Newsreader"');
    expect(CSS).toContain('--font-sans: "Plus Jakarta Sans"');
    expect(CSS).toContain('--font-mono: "JetBrains Mono"');
  });
});
