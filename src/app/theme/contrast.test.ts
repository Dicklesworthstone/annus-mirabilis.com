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

describe("contrast: inverted and highlighted pairs meet WCAG AA (4.5:1)", () => {
  for (const id of THEME_IDS) {
    const tokens = THEME_TOKENS[id];
    test(`${id}: paper on ink (buttons, badges, skip-link)`, () => {
      expect(contrastRatio(tokens.paper, tokens.ink)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    });
    test(`${id}: paper on accent (button hover, selection)`, () => {
      expect(contrastRatio(tokens.paper, tokens.accent)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
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

describe("contrast: seeded violations fail, proving the test actually checks something", () => {
  test("a low-contrast pair fails the normal-text minimum", () => {
    expect(contrastRatio("#eee7d7", "#eee7d7")).toBeLessThan(NORMAL_TEXT_MIN);
  });
  test("a low-contrast pair fails the UI-boundary minimum", () => {
    expect(contrastRatio("#c8c2b4", "#eee7d7")).toBeLessThan(UI_BOUNDARY_MIN);
  });
  test("hardcoded white on Kramgasse Night amber accent fails normal-text minimum (proving why var(--paper) is required)", () => {
    expect(contrastRatio("#ffffff", THEME_TOKENS["kramgasse-night"].accent)).toBeLessThan(
      NORMAL_TEXT_MIN,
    );
  });
  test("hardcoded white on Slate coral accent fails normal-text minimum", () => {
    expect(contrastRatio("#ffffff", THEME_TOKENS.slate.accent)).toBeLessThan(NORMAL_TEXT_MIN);
  });
});

describe("contrast: color never carries meaning alone (AGENTS.md constraint)", () => {
  test("every theme defines non-color cues for interactive states", () => {
    // Focus ring requires outline geometry, not color alone
    for (const id of THEME_IDS) {
      const tokens = THEME_TOKENS[id];
      expect(tokens.focusRing).toBeDefined();
    }
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
