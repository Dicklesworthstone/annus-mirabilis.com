import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

describe("computed styles layout verification (am-vw1o)", () => {
  test("BrownianFirstEncounter action buttons compute to >=44px touch targets with semantic styles", async () => {
    const globalsCss = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
    const encounterSource = readFileSync(
      join(ROOT, "src/reader/entrances/BrownianFirstEncounter.tsx"),
      "utf8",
    );

    // Verify source code uses semantic button classes instead of inert utility classes
    assert.ok(
      encounterSource.includes('data-instrument-id="bm-01"') &&
        encounterSource.includes('className="button"'),
      "BM-01 link must carry semantic .button class",
    );
    assert.ok(
      encounterSource.includes('className="button secondary"'),
      "Secondary action link must carry semantic .button.secondary classes",
    );
    assert.ok(
      !encounterSource.includes("hover:bg-primary/90 transition-colors text-center flex-1"),
      "Inert Tailwind utility classes must be removed from BM-01 action links",
    );

    // Verify in a real headless browser with the project's actual stylesheet
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>${globalsCss}</style>
</head>
<body>
  <div class="button-group">
    <a href="/lab/bm-01" data-instrument-id="bm-01" class="button">Open BM-01 Lab →</a>
    <a href="/papers/brownian-motion/s5/#s5-p1" class="button secondary">Go to §5 Passage →</a>
  </div>
</body>
</html>
      `;
      await page.setContent(html);

      const primary = page.locator('[data-instrument-id="bm-01"]');
      const secondary = page.locator(".button.secondary");

      const primaryStyles = await primary.evaluate((el) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          minHeight: cs.minHeight,
          height: rect.height,
          width: rect.width,
          cursor: cs.cursor,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
        };
      });

      const secondaryStyles = await secondary.evaluate((el) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          minHeight: cs.minHeight,
          height: rect.height,
          cursor: cs.cursor,
          backgroundColor: cs.backgroundColor,
          borderColor: cs.borderColor,
        };
      });

      // Assert touch-target compliance (>= 44px)
      assert.equal(primaryStyles.minHeight, "44px", "Primary button must have min-height: 44px");
      assert.ok(primaryStyles.height >= 44, "Primary button rendered height must be at least 44px");
      assert.equal(primaryStyles.cursor, "pointer", "Primary button cursor must be pointer");
      assert.equal(
        primaryStyles.backgroundColor,
        "rgb(36, 42, 41)",
        "Primary button background must match --ink design token",
      );
      assert.equal(
        primaryStyles.color,
        "rgb(255, 253, 247)",
        "Primary button text color must match --panel design token",
      );

      // Assert secondary button styles
      assert.equal(
        secondaryStyles.minHeight,
        "44px",
        "Secondary button must have min-height: 44px",
      );
      assert.ok(
        secondaryStyles.height >= 44,
        "Secondary button rendered height must be at least 44px",
      );
      assert.equal(
        secondaryStyles.backgroundColor,
        "rgba(0, 0, 0, 0)",
        "Secondary button background must be transparent",
      );
      assert.equal(
        secondaryStyles.borderColor,
        "rgb(145, 153, 141)",
        "Secondary button border color must match muted line token",
      );
    } finally {
      await browser.close();
    }
  });
});
