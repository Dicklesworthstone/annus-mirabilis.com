/**
 * Design tokens for the two themes (am-design-themes-typography-288q).
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
   * value, so every `background: var(--wash)` rule painted Annalen's paper
   * tone in the dark themes too, which is unreadable body copy rather than a
   * cosmetic slip. Both themes now carry the same four relationships, so a
   * token added to one has an unambiguous counterpart in the other.
   *
   * The figures this comment used to quote were wrong, which is worth
   * recording because they were quoted onward as if measured: it claimed
   * "Annalen reads ink 13.14, muted 5.50". Recomputed with contrastRatio
   * against the palette that was actually in the file, Annalen read ink
   * 14.271 and muted 5.974. Only wash-vs-paper 1.086 was right. The new dark
   * theme is derived against the RECOMPUTED light ratios, not the quoted ones.
   */
  readonly wash: string;
  /**
   * The chart colour: plotted lines, bars and the labels drawn in them. It was set once, in
   * globals.css's :root, to the light theme's #254f49, and the dark theme never redefined it, so in
   * Kramgasse Night every chart line and label in it sat at 1.77:1 on the paper (measured 2026-09-23
   * across 93 uses in 24 files). The dark value is solved like muted, rule and wash: #254f49's hue
   * and saturation held, lightness moved until it reads against the dark paper as the light one does
   * against the light paper (8.855 against 8.849).
   */
  readonly plot: string;
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
 * ANNALEN IS MEASURED FROM THE PLATES. The values were the placeholder's own
 * reference implementation (docs/design/placeholder/style.css), kept on the
 * owner's instruction under a stated change procedure: "they may change only
 * with a recorded reason and a contrast rerun". This is that change. The
 * recorded reason is the owner's, 2026-09-22: the design is abysmal, and
 * #eee7d7 is a warm cream near #F4F1EA, which is the first of the three looks
 * AI design collapses into regardless of subject. The contrast rerun is
 * contrast.test.ts, which pins every value below.
 *
 * HOW THEY WERE MEASURED, so the next person can re-derive rather than trust.
 * artifacts/page-images holds 200 dpi renders of the 1905 printing. Over all
 * 100 PNGs, cropped to the central 80% so the scanner's dark page edge cannot
 * pose as ink, per-page histograms give:
 *
 *   paper = the dominant tone   median 251   (min 242, p25 250, p75 252, max 255)
 *   ink   = the 0.5th percentile median  63   (min  11, p25  51, p75  72, max  95)
 *
 * Spot check at full resolution, artifacts/page-images/ap-17-549/page-02.png,
 * central crop 802x1277: heavy type at 40x40+200+760 runs min 40, p05 88;
 * blank stock at 40x40+680+160 is a flat 255.
 *
 * THE PLATES CARRY NO HUE AND CANNOT SUPPLY ONE. Measured at full resolution
 * on all 100, by two methods that share no code path: maximum HSL saturation is
 * exactly 0 on every file, and max|R-G| and max|G-B| are both exactly 0 on every
 * file. Every pixel of every plate is exactly achromatic.
 *
 * A CORRECTION TO THE COMMIT THAT LANDED THIS, because the claim is in the
 * pushed message and cannot be edited there. That message also said "all 100
 * encode as PNG type Grayscale". THAT IS FALSE. Reading the IHDR colour-type
 * byte at offset 25 of each file: 100 of 100 are type 2, truecolour RGB, and not
 * one is type 0. The error came from citing `magick -format "%[type]"`, which
 * reports ImageMagick's classification of the PIXEL CONTENT and prints
 * "Grayscale" for a type-2 file whose pixels all happen to be grey. A tool's
 * derived attribute was read as a property of the file format.
 *
 * The distinction matters here rather than being pedantry: "the format says
 * grey" and "every pixel happens to be grey" are different facts, and only the
 * second is true. The conclusion rests entirely on the second, which is why it
 * survives the correction - but a false leg propped under a true conclusion is
 * the thing that gets quoted onward, exactly as the 13.14 figure was.
 *
 * So: these are RGB-encoded files containing perfectly achromatic data. They
 * were greyscaled before this project received them. A warm cream is not a
 * thing these scans disagree with; it is a thing they cannot speak to at all,
 * and any hue in the light theme would be invented and then described as
 * derived. paper and ink are therefore neutral,
 * and the scan has clipped some pages to 255, so 251 is the scanner's
 * rendering of the stock rather than the stock itself. That is the honest
 * limit of what a clipped greyscale scan can establish.
 *
 * muted, rule and wash are NOT sampled. The intermediate tones on a scan are
 * dominated by paper-side noise rather than by a designed mid-tone, so they are
 * solved to reproduce the ratios Annalen already had: muted 5.974, rule 1.449,
 * wash 1.086. accent is editorial (AGENTS.md reserves red for emphasis and the
 * move step), not plate-derived, and is unchanged.
 */
export const THEME_TOKENS: Readonly<Record<ThemeId, ThemeTokens>> = Object.freeze({
  annalen: Object.freeze({
    // ink 10.177, muted 5.985, rule 1.447, wash 1.082, accent 6.695
    paper: "#fbfbfb",
    ink: "#3f3f3f",
    muted: "#616161",
    rule: "#d3d3d3",
    accent: "#ae2119",
    focusRing: "#3f3f3f",
    wash: "#f2f2f2",
    plot: "#254f49",
    plotDarkfield: "#0f172a",
  }),
  "kramgasse-night": Object.freeze({
    // muted 5.978, rule 1.450, wash 1.086 -- the light theme's own figures,
    // solved by holding each token's hue and saturation and moving only its
    // lightness, so the lamplight character survives the re-derivation.
    //
    // INK IS THE ONE RELATIONSHIP THAT IS NOT CARRIED OVER, and the reason is
    // arithmetic rather than taste. Matching the light theme's ink would put
    // this ink at 10.18 against this paper, where the amber accent sits at
    // 7.414 against the same paper -- so their mutual contrast would be exactly
    // 10.18 / 7.414 = 1.373, under the 1.5 accent-distinctness floor asserted
    // below. Hue cannot repair that: the quotient depends only on the two
    // ratios. The alternatives are to darken the amber to 6.79 or lower, which
    // spends the palette's one bold colour to fix a neutral, or to leave ink at
    // 12.976 where the quotient is 1.750. It is left. I tried the other way
    // first and this file's own gate refused it.
    paper: "#1c2128",
    ink: "#e8e6e1",
    muted: "#979ea6",
    rule: "#363c42",
    accent: "#e0a458",
    focusRing: "#e8e6e1",
    wash: "#21282f",
    plot: "#8fcbc2",
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
