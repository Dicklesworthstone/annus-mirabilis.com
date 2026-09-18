import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const HERE = dirname(fileURLToPath(import.meta.url));
const THEMES_CSS = readFileSync(join(HERE, "themes.css"), "utf8");
const GLOBALS_CSS = readFileSync(join(HERE, "../globals.css"), "utf8");

describe("contrast: color never carries meaning alone (AGENTS.md constraint)", () => {
  test("focus-visible rules define outline geometry (width, style, offset), not hue alone", () => {
    expect(THEMES_CSS).toContain("outline: 2px solid var(--focus-ring)");
    expect(THEMES_CSS).toContain("outline-offset: 2px");
  });

  test("forced-colors mode defines CanvasText outline for high-contrast visibility", () => {
    expect(THEMES_CSS).toContain("@media (forced-colors: active)");
    expect(THEMES_CSS).toContain("outline: 2px solid CanvasText");
  });

  test("links define structural underline and hover thickness changes, not hue alone", () => {
    expect(GLOBALS_CSS).toContain("text-underline-offset: 0.2em");
    expect(GLOBALS_CSS).toContain("text-decoration-thickness: 2px");
  });

  test("theme toggle selected state uses font-weight: bold and native radio checked state, not hue alone", () => {
    expect(THEMES_CSS).toContain(".theme-toggle label:has(input:checked)");
    expect(THEMES_CSS).toContain("font-weight: bold");
  });

  test("disabled buttons define cursor: not-allowed and reduced opacity, not hue alone", () => {
    expect(GLOBALS_CSS).toContain("button:disabled");
    expect(GLOBALS_CSS).toContain("cursor: not-allowed");
    expect(GLOBALS_CSS).toContain("opacity: 0.55");
  });

  test("planted negative: a rule that distinguishes state only by hue fails the non-color meaning gate", () => {
    function auditRuleNonColor(cssSnippet: string): { passes: boolean; defect?: string } {
      const hasColorChange = /color:\s*[^;]+;|background(-color)?:\s*[^;]+;/i.test(cssSnippet);
      const hasStructuralCue =
        /font-weight:\s*bold|outline:|text-decoration|cursor:\s*not-allowed|opacity:|border-width:|transform:/i.test(
          cssSnippet,
        );
      if (hasColorChange && !hasStructuralCue) {
        return {
          passes: false,
          defect: "State distinguishes change by color alone without structural cue",
        };
      }
      return { passes: true };
    }

    // A defective rule that only changes hue
    const badHueOnlyRule = ".active-tab { color: #ae2119; }";
    expect(auditRuleNonColor(badHueOnlyRule).passes).toBe(false);

    // A compliant rule that changes weight or underline
    const goodRule =
      ".theme-toggle label:has(input:checked) { border-color: var(--accent); font-weight: bold; }";
    expect(auditRuleNonColor(goodRule).passes).toBe(true);
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
