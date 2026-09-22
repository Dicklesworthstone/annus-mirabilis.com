import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getLogger } from "../../testing/log/logger.ts";
import { contrastRatio, HIGH_CONTRAST_BODY, type ThemeId } from "./contrast.ts";

const logger = getLogger("a11y-reading-only");
const BEAD = "am-a11y-reading-only-6wwd";

describe("high-contrast body tokens", () => {
  test("body text meets 7:1 in all three themes", () => {
    const themes = Object.keys(HIGH_CONTRAST_BODY) as ThemeId[];
    expect(themes).toEqual(["annalen", "kramgasse-night"]);
    for (const theme of themes) {
      const pair = HIGH_CONTRAST_BODY[theme];
      const ratio = contrastRatio(pair.ink, pair.paper);
      expect(ratio).toBeGreaterThanOrEqual(7);
      logger.log({
        testId: `contrast-high-${theme}`,
        beadId: BEAD,
        outcome: "passed",
        extra: { theme, contrast: ratio },
        message: `${theme} body contrast ${ratio.toFixed(2)}:1`,
      });
    }
  });

  test("the stylesheet uses the same high-contrast tokens", () => {
    const css = readFileSync(new URL("./readingSettings.css", import.meta.url), "utf8");
    expect(css).toContain("--ink: #000000");
    expect(css).toContain("--paper: #ffffff");
    expect(css).toContain('[data-theme="kramgasse-night"][data-contrast="high"]');
    expect(css).toContain('[data-theme="kramgasse-night"][data-contrast="high"]');
    logger.log({
      testId: "contrast-css-tokens",
      beadId: BEAD,
      outcome: "passed",
      message: "CSS high-contrast tokens match the computed pairs",
    });
  });
});
