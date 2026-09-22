/**
 * High-contrast body-text tokens for the three themes (am-a11y-reading-only-6wwd).
 * Target: at least 7:1. Semantic color is never the only cue.
 */

export type ThemeId = "annalen" | "kramgasse-night";

export type ContrastPair = Readonly<{
  ink: string;
  paper: string;
}>;

export const HIGH_CONTRAST_BODY: Readonly<Record<ThemeId, ContrastPair>> = Object.freeze({
  annalen: { ink: "#000000", paper: "#ffffff" },
  "kramgasse-night": { ink: "#ffffff", paper: "#000000" },
});

function srgbChannel(byte: number): number {
  const s = byte / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  if (value.length !== 6) throw new Error(`Expected #rrggbb, got "${hex}".`);
  const n = Number.parseInt(value, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
