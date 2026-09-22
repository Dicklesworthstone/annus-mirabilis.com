/**
 * Design tokens for the three themes (am-design-themes-typography-288q).
 * Values are verified against real WCAG contrast math in contrast.test.ts,
 * which imports contrastRatio from src/a11y/readingSettings/contrast.ts
 * rather than reimplementing it (that module already owns the ratio
 * formula and the ThemeId union, reused here as-is).
 *
 * `rule` is a decorative divider color (a thin section rule), exempt from
 * WCAG 1.4.11 non-text contrast, which applies only to required UI
 * components. `focusRing` IS a required UI component boundary and is
 * verified at the stricter 3:1 minimum; every theme below sets it equal
 * to `ink`, which already clears the 4.5:1 text minimum and therefore
 * clears 3:1 for free, rather than inventing a second color that might not.
 */

import { contrastRatio, type ThemeId } from "../../a11y/readingSettings/contrast";

export type { ThemeId };

export interface ThemeTokens {
  readonly paper: string;
  readonly ink: string;
  readonly muted: string;
  readonly rule: string;
  readonly accent: string;
  readonly focusRing: string;
  /**
   * The panel tint used behind notices, tables and inset blocks.
   * It existed only in globals.css's :root and was never given a per-theme
   * value, so every `background: var(--wash)` rule painted Annalen's light
   * beige in the dark themes too: near-white --ink on #e5ded0 is 1.07:1 in
   * Kramgasse Night and 1.16:1 in Slate, which is unreadable body copy, not a
   * cosmetic slip. The dark values below are derived to reproduce Annalen's
   * OWN relationships rather than invented: Annalen reads ink 13.14, muted
   * 5.50, and wash-vs-paper 1.086.
   */
  readonly wash: string;
  readonly plotDarkfield: string;
}

export const THEME_IDS: readonly ThemeId[] = Object.freeze(["annalen", "kramgasse-night"]);

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}

export const DEFAULT_THEME: ThemeId = "annalen";

/**
 * `"follow-system"` is a fourth STORED value, never a theme itself: it maps
 * a dark system preference to kramgasse-night and a light one to annalen.
 * It is validated separately from THEME_IDS wherever the pre-paint script
 * or the toggle need to accept it.
 */
export const FOLLOW_SYSTEM_VALUE = "follow-system";

/**
 * Annalen's values are the placeholder's own reference implementation
 * (docs/design/placeholder/style.css), which the project owner asked to
 * keep; they may change only with a recorded reason and a contrast rerun.
 */
export const THEME_TOKENS: Readonly<Record<ThemeId, ThemeTokens>> = Object.freeze({
  annalen: Object.freeze({
    paper: "#eee7d7",
    ink: "#1a1916",
    muted: "#5c554a",
    rule: "#cbc1ac",
    accent: "#ae2119",
    focusRing: "#1a1916",
    wash: "#e5ded0",
    plotDarkfield: "#0f172a",
  }),
  "kramgasse-night": Object.freeze({
    paper: "#1c2128",
    ink: "#e8e6e1",
    muted: "#9aa0a8",
    rule: "#33393f",
    accent: "#e0a458",
    focusRing: "#e8e6e1",
    // ink 11.62, muted 5.50 (Annalen's muted figure exactly), wash-vs-paper 1.116
    wash: "#232a32",
    plotDarkfield: "#0d1117",
  }),
});

/** Font-family tokens: exactly the four families named in AGENTS.md, no others. */
export const FONT_TOKENS = Object.freeze({
  serif: '"Newsreader", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  sans: '"Plus Jakarta Sans", "Segoe UI", Helvetica, Arial, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
});

/**
 * Layout tokens for am-read-page-anatomy-l0b (tier thresholds, measures,
 * maximum sticky heights, scroll padding). Declared here because this bead
 * owns "layout tokens (tier thresholds, measures...)" per its Requirements;
 * page-anatomy consumes them without redeclaring.
 */
export const LAYOUT_TOKENS = Object.freeze({
  narrowMaxEm: 48,
  wideMinEm: 64,
  measureCh: 65,
  stickyLabMaxVh: 40,
  scrollPaddingRem: 3,
});

export const CONTRAST_THRESHOLDS = Object.freeze({
  normalText: 4.5,
  largeText: 3.0,
  uiBoundary: 3.0,
});

export interface ContrastAuditViolation {
  readonly theme: ThemeId;
  readonly pairName: string;
  readonly foreground: string;
  readonly background: string;
  readonly ratio: number;
  readonly requiredRatio: number;
}

export interface ContrastAuditResult {
  readonly passes: boolean;
  readonly checkedCount: number;
  readonly violations: readonly ContrastAuditViolation[];
}

/**
 * Computes contrast ratios for all declared normal-text, inverted-text,
 * and UI component boundary pairs in each theme against WCAG AA standards.
 * Fails if any pair in any theme falls below its required threshold.
 */
export function auditThemeTokensContrast(
  tokensByTheme: Readonly<Record<ThemeId, ThemeTokens>> = THEME_TOKENS,
): ContrastAuditResult {
  const violations: ContrastAuditViolation[] = [];
  let checkedCount = 0;

  for (const themeId of THEME_IDS) {
    const tokens = tokensByTheme[themeId];
    if (!tokens) continue;

    const declaredPairs = [
      {
        name: "ink on paper",
        fg: tokens.ink,
        bg: tokens.paper,
        req: CONTRAST_THRESHOLDS.normalText,
      },
      {
        name: "muted on paper",
        fg: tokens.muted,
        bg: tokens.paper,
        req: CONTRAST_THRESHOLDS.normalText,
      },
      {
        name: "accent on paper",
        fg: tokens.accent,
        bg: tokens.paper,
        req: CONTRAST_THRESHOLDS.normalText,
      },
      {
        name: "paper on ink",
        fg: tokens.paper,
        bg: tokens.ink,
        req: CONTRAST_THRESHOLDS.normalText,
      },
      {
        name: "paper on accent",
        fg: tokens.paper,
        bg: tokens.accent,
        req: CONTRAST_THRESHOLDS.normalText,
      },
      {
        name: "focusRing on paper",
        fg: tokens.focusRing,
        bg: tokens.paper,
        req: CONTRAST_THRESHOLDS.uiBoundary,
      },
      { name: "ink on wash", fg: tokens.ink, bg: tokens.wash, req: CONTRAST_THRESHOLDS.normalText },
      {
        name: "muted on wash",
        fg: tokens.muted,
        bg: tokens.wash,
        req: CONTRAST_THRESHOLDS.normalText,
      },
    ];

    for (const pair of declaredPairs) {
      checkedCount++;
      const ratio = contrastRatio(pair.fg, pair.bg);
      if (ratio < pair.req) {
        violations.push({
          theme: themeId,
          pairName: pair.name,
          foreground: pair.fg,
          background: pair.bg,
          ratio,
          requiredRatio: pair.req,
        });
      }
    }
  }

  return {
    passes: violations.length === 0,
    checkedCount,
    violations,
  };
}
