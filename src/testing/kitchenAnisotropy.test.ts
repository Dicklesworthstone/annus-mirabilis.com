import { describe, expect, test } from "bun:test";
import { analyzeKitchen, KITCHEN_OPTIONS } from "../experiments/bm07/kitchen/analyze.ts";
import { parseKitchenCsv } from "../experiments/bm07/kitchen/csv.ts";
import { kitchenFixture } from "./kitchen/fixture.mjs";

/**
 * am-bm-07-kitchen-mode-mays, criterion 24: two axis scales differing by more than 2% are reported
 * with the (1 + p²)/2 factor and its effect on D̂ and N̂, at the bead's two values. The warning
 * once printed the binary float "1.0940500000000002" and named no effect on N.
 */
const warningAt = (x: string) => {
  const r = analyzeKitchen(
    parseKitchenCsv(
      kitchenFixture({
        metadata: { pixels_per_um_x: x, pixels_per_um_y: "10", pixel_aspect_ratio: "" },
      }),
    ),
    KITCHEN_OPTIONS,
  );
  return {
    warning: r.warnings.find((w) => w.includes("pooled diffusivity")) ?? "",
    withheld: r.intervalReasons.some((w) => w.includes("Confirm the pixel aspect ratio")),
  };
};

describe("kitchen anisotropy warning", () => {
  test("p = 1.09: factor 1.094050, D +9.405%, N −8.60%, interval withheld", () => {
    const { warning, withheld } = warningAt("10.9");
    expect(warning).toContain("1.0900 times the y scale");
    expect(warning).toContain("by 1.094050,");
    expect(warning).toContain("D by +9.405%");
    expect(warning).toContain("N by −8.60%");
    expect(withheld).toBe(true);
  });

  test("p = 1.3333: factor 1.388844, N −28.00%", () => {
    const { warning } = warningAt("13.333");
    expect(warning).toContain("by 1.388844,");
    expect(warning).toContain("N by −28.00%");
  });

  test("the warning carries no raw binary float", () => {
    for (const x of ["10.9", "13.333", "7.7"]) {
      const { warning } = warningAt(x);
      expect(warning.length).toBeGreaterThan(0);
      expect(warning).not.toMatch(/\d\.\d{9,}/);
    }
  });
});
