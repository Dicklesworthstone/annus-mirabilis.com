/**
 * The 72 tested reading layouts: 3 measures × 4 type scales × 2 spacings
 * at 320, 768, and 1440 CSS px (am-a11y-reading-only-6wwd).
 * Page content is capped at the viewport, so a wide measure at 150% on a
 * 320 px screen fills the viewport instead of overflowing it.
 */

import {
  MEASURE_VALUES,
  type MeasureValue,
  PARAGRAPH_SPACING_VALUES,
  type ParagraphSpacingValue,
  TYPE_SCALE_VALUES,
  type TypeScaleValue,
} from "./schema.ts";

export const LAYOUT_VIEWPORTS = [320, 768, 1440] as const;

export type LayoutCase = Readonly<{
  viewport: (typeof LAYOUT_VIEWPORTS)[number];
  measure: MeasureValue;
  typeScale: TypeScaleValue;
  paragraphSpacing: ParagraphSpacingValue;
}>;

const MEASURE_REM: Readonly<Record<MeasureValue, number>> = {
  narrow: 32,
  default: 40,
  wide: 48,
};

/** CSS `rem` is the root font size (not the reading type scale). */
const ROOT_PX = 16;

export function layoutCombinations(): readonly LayoutCase[] {
  const cases: LayoutCase[] = [];
  for (const viewport of LAYOUT_VIEWPORTS) {
    for (const measure of MEASURE_VALUES) {
      for (const typeScale of TYPE_SCALE_VALUES) {
        for (const paragraphSpacing of PARAGRAPH_SPACING_VALUES) {
          cases.push({ viewport, measure, typeScale, paragraphSpacing });
        }
      }
    }
  }
  return Object.freeze(cases);
}

/** Preferred measure width in CSS pixels before the viewport cap. */
export function uncappedMeasurePx(measure: MeasureValue, _typeScale: TypeScaleValue): number {
  return MEASURE_REM[measure] * ROOT_PX;
}

/** Page-level content width: never exceeds the viewport. */
export function pageContentMaxWidthPx(
  viewport: number,
  measure: MeasureValue,
  typeScale: TypeScaleValue,
): number {
  return Math.min(uncappedMeasurePx(measure, typeScale), viewport);
}

export function pageOverflows(
  viewport: number,
  measure: MeasureValue,
  typeScale: TypeScaleValue,
): boolean {
  return pageContentMaxWidthPx(viewport, measure, typeScale) > viewport;
}
