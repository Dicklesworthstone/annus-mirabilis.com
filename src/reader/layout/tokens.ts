/**
 * Named layout tokens for the reader anatomy (am-read-page-anatomy-l0b).
 * Breakpoints are in em so browser zoom reflows the tier.
 */

export const READER_LAYOUT_TOKENS = Object.freeze({
  /** Below this, one column + bottom sheet. 48em = 768px at 16px. */
  narrowMaxEm: 48,
  /** At or above this, main + companion + outline. 64em = 1024px at 16px. */
  wideMinEm: 64,
  /** Sticky laboratory maximum height as a viewport fraction. */
  stickyLabMaxVh: 40,
  scrollPaddingRem: 3,
  measureCh: 65,
});

export type LayoutTier = "narrow" | "medium" | "wide";
export type CompanionPlacement = "column" | "sheet";

export class LayoutMeasureError extends Error {
  readonly code = "invalid-layout-measure" as const;
  constructor(message: string) {
    super(message);
    this.name = "LayoutMeasureError";
  }
}

export function layoutTier(widthPx: number, rootFontPx: number): LayoutTier {
  if (
    !(widthPx > 0) ||
    !(rootFontPx > 0) ||
    !Number.isFinite(widthPx) ||
    !Number.isFinite(rootFontPx)
  ) {
    throw new LayoutMeasureError(
      "Layout tier needs a positive finite viewport width and root font size.",
    );
  }
  const em = widthPx / rootFontPx;
  if (em < READER_LAYOUT_TOKENS.narrowMaxEm) return "narrow";
  if (em < READER_LAYOUT_TOKENS.wideMinEm) return "medium";
  return "wide";
}

export function companionPlacement(tier: LayoutTier): CompanionPlacement {
  return tier === "narrow" ? "sheet" : "column";
}
