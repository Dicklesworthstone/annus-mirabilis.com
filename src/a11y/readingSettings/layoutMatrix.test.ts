import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getLogger } from "../../testing/log/logger.ts";
import {
  LAYOUT_VIEWPORTS,
  layoutCombinations,
  pageContentMaxWidthPx,
  pageOverflows,
} from "./layoutMatrix.ts";
import { MEASURE_VALUES, PARAGRAPH_SPACING_VALUES, TYPE_SCALE_VALUES } from "./schema.ts";

const logger = getLogger("a11y-reading-only");
const BEAD = "am-a11y-reading-only-6wwd";

describe("72 tested reading layouts", () => {
  test("the matrix is 3 × 4 × 2 at 320, 768, and 1440 CSS px", () => {
    const cases = layoutCombinations();
    expect(LAYOUT_VIEWPORTS).toEqual([320, 768, 1440]);
    expect(MEASURE_VALUES).toHaveLength(3);
    expect(TYPE_SCALE_VALUES).toHaveLength(4);
    expect(PARAGRAPH_SPACING_VALUES).toHaveLength(2);
    expect(cases).toHaveLength(72);
    logger.log({
      testId: "layout-matrix-count",
      beadId: BEAD,
      outcome: "passed",
      extra: { viewport: "320,768,1440" },
      message: "72 combinations",
    });
  });

  test("no combination overflows the viewport, including 150 percent type at 320 px", () => {
    for (const layout of layoutCombinations()) {
      const width = pageContentMaxWidthPx(layout.viewport, layout.measure, layout.typeScale);
      expect(width).toBeLessThanOrEqual(layout.viewport);
      expect(pageOverflows(layout.viewport, layout.measure, layout.typeScale)).toBe(false);
    }
    const extreme = pageContentMaxWidthPx(320, "wide", "150");
    expect(extreme).toBe(320);
    logger.log({
      testId: "layout-matrix-no-overflow",
      beadId: BEAD,
      outcome: "passed",
      extra: { viewport: 320, measure: "wide", typeScale: "150", overflowPx: 0 },
      message: "wide 150 percent at 320 px is capped to the viewport",
    });
  });

  test("CSS caps measure at the viewport and uses shrinkable grid tracks for the companion column", () => {
    const readingCss = readFileSync(new URL("./readingSettings.css", import.meta.url), "utf8");
    const layoutCss = readFileSync(
      new URL("../../reader/layout/layout.css", import.meta.url),
      "utf8",
    );
    // THE MEASURE MUST BE FONT-RELATIVE, or the two settings do each other's job.
    //
    // ch scales with the type, so a ch-based max-width holds characters per line constant while
    // the reader enlarges text. rem does not. Measured on the Brownian reading face at 1280x900,
    // default measure, before this was fixed: CPL ran 81, 72, 62, 50 across the four type sizes,
    // so enlarging type silently shortened the line. After: 55, 55, 55, 55.
    //
    // Asserted on the DECLARATIONS rather than on a rendered page, because this file is the one
    // place the three values are written and a unit test cannot lay out text. The rendered proof
    // is the CPL matrix recorded in the commit that introduced this.
    for (const measure of MEASURE_VALUES) {
      const rule = new RegExp(
        `html\\[data-measure="${measure}"\\]\\s*\\{[^}]*--reader-measure:\\s*([\\d.]+)(ch|rem|px|em)`,
      );
      const found = readingCss.match(rule);
      expect(found, `no --reader-measure declared for ${measure}`).not.toBeNull();
      expect(found?.[2], `${measure} measure must be font-relative (ch), not ${found?.[2]}`).toBe(
        "ch",
      );
    }

    expect(readingCss).toContain("max-width: min(var(--reader-measure), 100%)");
    expect(layoutCss).toContain("max-width: min(var(--reader-measure), 100%)");
    expect(layoutCss).toContain(
      "grid-template-columns: minmax(0, 12rem) minmax(0, var(--reader-measure)) minmax(0, 1fr)",
    );
    expect(layoutCss).toContain(
      "grid-template-columns: minmax(0, var(--reader-measure)) minmax(0, 1fr)",
    );
    expect(readingCss).not.toMatch(/\[data-explanation\][^{]*\{\s*display:\s*none/);
    expect(readingCss).not.toMatch(/\[data-static-worked-case\][^{]*\{\s*display:\s*none/);
    expect(readingCss).not.toMatch(/\[data-worked-example\][^{]*\{\s*display:\s*none/);
    logger.log({
      testId: "layout-css-overflow-contract",
      beadId: BEAD,
      outcome: "passed",
      message: "measure capped; companion tracks shrink; content not display:none",
    });
  });
});
