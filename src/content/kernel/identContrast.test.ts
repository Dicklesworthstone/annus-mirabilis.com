import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { quantityHue } from "./highlight.ts";

/**
 * The identifier colour in a kernel listing is chosen by hashing the quantity id,
 * so any of 360 hues can ship. Every one of them has to clear WCAG 2.2 AA against
 * the code block's background.
 *
 * This was unreachable until am-70h7 let the listings render; axe then measured
 * 4.14 for rmsDisplacement1d, below the 4.5 threshold for normal text.
 */
const WASH = "#e8eadf"; // --wash in src/app/globals.css, not overridden by any theme
const AA_NORMAL_TEXT = 4.5;

function relativeLuminance([r, g, b]: readonly [number, number, number]): number {
  const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function hslToRgb(h: number, s: number, l: number): readonly [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const n = hex.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(n.slice(i, i + 2), 16) / 255) as unknown as readonly [
    number,
    number,
    number,
  ];
}

function contrast(a: readonly [number, number, number], b: readonly [number, number, number]) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** Parses the exact string quantityHue produces, so the test reads the real value. */
function parseHsl(value: string): { hue: number; saturation: number; lightness: number } {
  const match = /^hsl\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%\)$/.exec(value);
  assert.ok(match, `quantityHue returned an unparsed value: ${value}`);
  return {
    hue: Number(match[1]),
    saturation: Number(match[2]) / 100,
    lightness: Number(match[3]) / 100,
  };
}

describe("kernel identifier colours clear AA at every hue they can take", () => {
  test("the shipped saturation and lightness pass for all 360 hues", () => {
    const { saturation, lightness } = parseHsl(quantityHue("diffusionCoefficient"));
    const wash = hexToRgb(WASH);
    let worst = { hue: -1, ratio: Number.POSITIVE_INFINITY };
    for (let hue = 0; hue < 360; hue++) {
      const ratio = contrast(hslToRgb(hue, saturation, lightness), wash);
      if (ratio < worst.ratio) worst = { hue, ratio };
    }
    assert.ok(
      worst.ratio >= AA_NORMAL_TEXT,
      `hue ${worst.hue} is ${worst.ratio.toFixed(2)} against ${WASH}, below ${AA_NORMAL_TEXT}. ` +
        "Lower the lightness in quantityHue rather than exempting a hue.",
    );
  });

  test("the previous lightness fails, so the threshold is doing work", () => {
    // Planted negative. Without this the first test would pass for any value that
    // happened to be light enough today, and a regression would read as green.
    const wash = hexToRgb(WASH);
    const ratiosAt32 = Array.from({ length: 360 }, (_, hue) =>
      contrast(hslToRgb(hue, 0.45, 0.32), wash),
    );
    assert.ok(Math.min(...ratiosAt32) < AA_NORMAL_TEXT);
  });

  test("a real quantity id yields a parsable colour with a dotted underline", () => {
    const value = quantityHue("rmsDisplacement1d");
    assert.match(value, /^hsl\(\d+ 45% 28%\)$/);
  });
});
