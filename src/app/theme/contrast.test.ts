import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "../../a11y/readingSettings/contrast";
import { COLOR_STYLES } from "../../equations/colorPalette";
import { READER_LAYOUT_TOKENS } from "../../reader/layout/tokens";
import { auditThemeTokensContrast, LAYOUT_TOKENS, THEME_IDS, THEME_TOKENS } from "./tokens";

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

describe("contrast: forbidden low-contrast pairs documented with exact ratios to prevent regression", () => {
  test("identical colors yield exactly 1.0 (asserted forbidden for normal text < 4.5)", () => {
    const ratio = contrastRatio("#eee7d7", "#eee7d7");
    expect(ratio).toBe(1);
    expect(ratio).toBeLessThan(NORMAL_TEXT_MIN);
  });
  test("border on paper yields 1.44:1 (asserted forbidden for UI boundary < 3.0)", () => {
    const ratio = contrastRatio("#c8c2b4", "#eee7d7");
    expect(ratio).toBeCloseTo(1.44, 2);
    expect(ratio).toBeLessThan(UI_BOUNDARY_MIN);
  });
  test("hardcoded white on Kramgasse Night amber accent yields 2.18:1 (asserted forbidden for normal text < 4.5, proving why var(--paper) is required)", () => {
    const ratio = contrastRatio("#ffffff", THEME_TOKENS["kramgasse-night"].accent);
    expect(ratio).toBeCloseTo(2.18, 2);
    expect(ratio).toBeLessThan(NORMAL_TEXT_MIN);
  });
  test("hardcoded white on Slate coral accent yields 3.07:1 (asserted forbidden for normal text < 4.5)", () => {
    const ratio = contrastRatio("#ffffff", THEME_TOKENS.slate.accent);
    expect(ratio).toBeCloseTo(3.07, 2);
    expect(ratio).toBeLessThan(NORMAL_TEXT_MIN);
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

  test("every equation color style defines a textual badge label and structural decoration, never hue alone", () => {
    for (const style of Object.values(COLOR_STYLES)) {
      expect(style.badgeLabel.length).toBeGreaterThan(0);
      expect(style.underlineClass).toContain("underline");
      expect(style.activeRing).toContain("ring");
    }
  });

  test("planted negative: an equation palette missing non-color cues fails the non-hue gate", () => {
    function auditPaletteNonColor(style: {
      badgeLabel?: string;
      underlineClass?: string;
      activeRing?: string;
    }): { passes: boolean; defect?: string } {
      if (!style.badgeLabel || style.badgeLabel.trim().length === 0) {
        return { passes: false, defect: "Missing textual badge label" };
      }
      if (!style.underlineClass?.includes("underline")) {
        return { passes: false, defect: "Missing structural underline decoration" };
      }
      if (!style.activeRing?.includes("ring")) {
        return { passes: false, defect: "Missing focus/active ring outline" };
      }
      return { passes: true };
    }

    const badPalette = { badgeLabel: "", underlineClass: "text-red-500", activeRing: "bg-red-100" };
    expect(auditPaletteNonColor(badPalette).passes).toBe(false);

    const goodPalette = COLOR_STYLES.crimson;
    expect(auditPaletteNonColor(goodPalette).passes).toBe(true);
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

describe("auditThemeTokensContrast: automated token contrast check (AC 3)", () => {
  test("auditThemeTokensContrast passes for all declared pairs across all three themes", () => {
    const result = auditThemeTokensContrast(THEME_TOKENS);
    expect(result.passes).toBe(true);
    expect(result.checkedCount).toBe(18); // 6 declared pairs * 3 themes
    expect(result.violations).toHaveLength(0);
  });

  test("planted negative: seeded text contrast violation (< 4.5:1) in any theme is detected", () => {
    const mutatedTokens = {
      ...THEME_TOKENS,
      annalen: {
        ...THEME_TOKENS.annalen,
        muted: "#999999", // contrast against #eee7d7 is ~2.22 (< 4.5)
      },
    };
    const result = auditThemeTokensContrast(mutatedTokens);
    expect(result.passes).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    const violation = result.violations.find(
      (v) => v.theme === "annalen" && v.pairName === "muted on paper",
    );
    expect(violation).toBeDefined();
    expect(violation?.ratio).toBeLessThan(4.5);
    expect(violation?.requiredRatio).toBe(4.5);
  });

  test("planted negative: seeded UI boundary contrast violation (< 3.0:1) is detected", () => {
    const mutatedTokens = {
      ...THEME_TOKENS,
      slate: {
        ...THEME_TOKENS.slate,
        focusRing: "#1e2426", // contrast against #14181a is ~1.14 (< 3.0)
      },
    };
    const result = auditThemeTokensContrast(mutatedTokens);
    expect(result.passes).toBe(false);
    const violation = result.violations.find(
      (v) => v.theme === "slate" && v.pairName === "focusRing on paper",
    );
    expect(violation).toBeDefined();
    expect(violation?.ratio).toBeLessThan(3.0);
    expect(violation?.requiredRatio).toBe(3.0);
  });
});

describe("layout tokens: cross-bead contract alignment (am-read-page-anatomy-l0b)", () => {
  test("LAYOUT_TOKENS defines positive finite values for all 5 required layout tokens", () => {
    expect(LAYOUT_TOKENS.narrowMaxEm).toBeGreaterThan(0);
    expect(LAYOUT_TOKENS.wideMinEm).toBeGreaterThan(LAYOUT_TOKENS.narrowMaxEm);
    expect(LAYOUT_TOKENS.measureCh).toBeGreaterThan(0);
    expect(LAYOUT_TOKENS.stickyLabMaxVh).toBeGreaterThan(0);
    expect(LAYOUT_TOKENS.scrollPaddingRem).toBeGreaterThan(0);
  });

  test("LAYOUT_TOKENS matches READER_LAYOUT_TOKENS exactly across all properties", () => {
    expect(LAYOUT_TOKENS.narrowMaxEm).toBe(READER_LAYOUT_TOKENS.narrowMaxEm);
    expect(LAYOUT_TOKENS.wideMinEm).toBe(READER_LAYOUT_TOKENS.wideMinEm);
    expect(LAYOUT_TOKENS.measureCh).toBe(READER_LAYOUT_TOKENS.measureCh);
    expect(LAYOUT_TOKENS.stickyLabMaxVh).toBe(READER_LAYOUT_TOKENS.stickyLabMaxVh);
    expect(LAYOUT_TOKENS.scrollPaddingRem).toBe(READER_LAYOUT_TOKENS.scrollPaddingRem);
  });

  test("planted negative: divergent layout tokens fail cross-bead contract check", () => {
    function auditLayoutTokenParity(
      source: Record<string, number>,
      consumer: Record<string, number>,
    ): { valid: boolean; differences: string[] } {
      const diffs: string[] = [];
      for (const key of Object.keys(source)) {
        if (source[key] !== consumer[key]) {
          diffs.push(`${key}: source=${source[key]} consumer=${consumer[key]}`);
        }
      }
      return { valid: diffs.length === 0, differences: diffs };
    }

    // Honest check: real tokens match
    expect(auditLayoutTokenParity(LAYOUT_TOKENS, READER_LAYOUT_TOKENS).valid).toBe(true);

    // Planted negative: altered threshold is flagged
    const badConsumer = { ...READER_LAYOUT_TOKENS, narrowMaxEm: 50 };
    const result = auditLayoutTokenParity(LAYOUT_TOKENS, badConsumer);
    expect(result.valid).toBe(false);
    expect(result.differences).toContain("narrowMaxEm: source=48 consumer=50");
  });
});

