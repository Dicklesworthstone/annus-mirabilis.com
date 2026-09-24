import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "../a11y/readingSettings/contrast";
import { THEME_TOKENS } from "../app/theme/tokens.ts";
import { QUANTITY_PALETTE } from "./quantityColours.ts";

/**
 * The term chips' tints (equations.css, TERMS AS TARGETS) keep every glyph at WCAG AA. The
 * percentages are read from the stylesheet itself, so a change to the CSS is checked here and the
 * two cannot drift. A tint of colour q at t% over a background b is the mix t·q + (1 − t)·b.
 */
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "equations.css"), "utf8");
const percent = (pattern: RegExp) => {
  const match = pattern.exec(css);
  if (!match?.[1]) throw new Error(`equations.css does not declare ${pattern}`);
  return Number(match[1]) / 100;
};
const lightRest = percent(/:root \{\s*--term-rest: (\d+)%;/);
const lit = percent(/--term-lit: (\d+)%;/);
const darkRest = percent(/:root\[data-theme="kramgasse-night"\] \{\s*--term-rest: (\d+)%;/);
const ring = percent(/0 0 0 0\.1em color-mix\(in srgb, var\(--qc\) (\d+)%, transparent\)/);

const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const mix = (colour: string, background: string, t: number) =>
  `#${channels(colour)
    .map((c, i) => Math.round(c * t + (channels(background)[i] ?? 0) * (1 - t)))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;

const themes = [
  { id: "annalen", key: "light", rest: lightRest },
  { id: "kramgasse-night", key: "dark", rest: darkRest },
] as const;

describe("term chips keep AA contrast in both themes", () => {
  test("the percentages were read from the stylesheet", () => {
    for (const value of [lightRest, darkRest, lit, ring]) expect(value).toBeGreaterThan(0);
  });

  for (const theme of themes) {
    const tokens = THEME_TOKENS[theme.id];
    for (const slot of QUANTITY_PALETTE)
      for (const background of [tokens.paper, tokens.wash]) {
        test(`${theme.id}: a resting ${slot.name} glyph on its own tint over ${background}`, () => {
          const tint = mix(slot[theme.key], background, theme.rest);
          expect(contrastRatio(slot[theme.key], tint)).toBeGreaterThanOrEqual(4.5);
        });
        test(`${theme.id}: a lit ${slot.name} chip, ink on its tint, ring at 3:1, over ${background}`, () => {
          expect(
            contrastRatio(tokens.ink, mix(slot[theme.key], background, lit)),
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrastRatio(mix(slot[theme.key], background, ring), background),
          ).toBeGreaterThanOrEqual(3);
        });
      }
  }
});
