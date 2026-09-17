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

import type { ThemeId } from "../../a11y/readingSettings/contrast";

export type { ThemeId };

export interface ThemeTokens {
  readonly paper: string;
  readonly ink: string;
  readonly muted: string;
  readonly rule: string;
  readonly accent: string;
  readonly focusRing: string;
}

export const THEME_IDS: readonly ThemeId[] = Object.freeze(["annalen", "kramgasse-night", "slate"]);

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
  }),
  "kramgasse-night": Object.freeze({
    paper: "#1c2128",
    ink: "#e8e6e1",
    muted: "#9aa0a8",
    rule: "#33393f",
    accent: "#e0a458",
    focusRing: "#e8e6e1",
  }),
  slate: Object.freeze({
    paper: "#14181a",
    ink: "#f0efe7",
    muted: "#a9b6ac",
    rule: "#2c3630",
    accent: "#e2726a",
    focusRing: "#f0efe7",
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
