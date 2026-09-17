import { describe, expect, test } from "bun:test";
import { contrastRatio } from "../../a11y/readingSettings/contrast";
import { THEME_IDS, THEME_TOKENS } from "./tokens";

const NORMAL_TEXT_MIN = 4.5;
const UI_BOUNDARY_MIN = 3;

describe("contrast: every declared text pair meets WCAG AA (4.5:1)", () => {
  for (const id of THEME_IDS) {
    const tokens = THEME_TOKENS[id];
    test(`${id}: ink on paper`, () => {
      expect(contrastRatio(tokens.ink, tokens.paper)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    });
    test(`${id}: muted on paper`, () => {
      expect(contrastRatio(tokens.muted, tokens.paper)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    });
    test(`${id}: accent on paper`, () => {
      expect(contrastRatio(tokens.accent, tokens.paper)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    });
  }
});

describe("contrast: the focus ring meets the stricter UI non-text minimum (3:1)", () => {
  for (const id of THEME_IDS) {
    const tokens = THEME_TOKENS[id];
    test(`${id}: focusRing on paper`, () => {
      expect(contrastRatio(tokens.focusRing, tokens.paper)).toBeGreaterThanOrEqual(UI_BOUNDARY_MIN);
    });
  }
});

describe("contrast: a seeded violation fails, proving the test actually checks something", () => {
  test("a low-contrast pair fails the normal-text minimum", () => {
    expect(contrastRatio("#eee7d7", "#eee7d7")).toBeLessThan(NORMAL_TEXT_MIN);
  });
  test("a low-contrast pair fails the UI-boundary minimum", () => {
    expect(contrastRatio("#c8c2b4", "#eee7d7")).toBeLessThan(UI_BOUNDARY_MIN);
  });
});

describe("contrast: Annalen's reference values match the kept placeholder implementation exactly", () => {
  const annalen = THEME_TOKENS.annalen;
  test("paper, ink, muted, rule, and accent are docs/design/placeholder/style.css's own values", () => {
    expect(annalen.paper).toBe("#eee7d7");
    expect(annalen.ink).toBe("#1a1916");
    expect(annalen.muted).toBe("#5c554a");
    expect(annalen.rule).toBe("#cbc1ac");
    expect(annalen.accent).toBe("#ae2119");
  });
});
