import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  companionPlacement,
  LayoutMeasureError,
  layoutTier,
  READER_LAYOUT_TOKENS,
} from "./tokens.ts";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "layout.css"), "utf8");

describe("reader layout tokens (am-read-page-anatomy-l0b)", () => {
  it("maps 320 CSS px at 16px root to a phone bottom sheet", () => {
    assert.equal(layoutTier(320, 16), "narrow");
    assert.equal(companionPlacement("narrow"), "sheet");
  });

  it("maps 1440 CSS px at 16px root to a companion column", () => {
    assert.equal(layoutTier(1440, 16), "wide");
    assert.equal(companionPlacement("wide"), "column");
  });

  it("400 percent zoom on a 1440 CSS px viewport reflows to the sheet", () => {
    assert.equal(layoutTier(1440, 16 * 4), "narrow");
    assert.equal(companionPlacement(layoutTier(1440, 64)), "sheet");
  });

  it("medium sits between the named em thresholds", () => {
    assert.equal(layoutTier(800, 16), "medium");
    assert.equal(companionPlacement("medium"), "column");
  });

  it("sticky laboratory height and scroll padding match the CSS tokens", () => {
    assert.equal(READER_LAYOUT_TOKENS.stickyLabMaxVh, 40);
    assert.match(css, /--reader-sticky-lab-max:\s*40vh/);
    assert.match(css, /--reader-scroll-padding:\s*3rem/);
    assert.match(css, /--reader-narrow-max:\s*48em/);
    assert.match(css, /--reader-wide-min:\s*64em/);
  });

  it("CSS uses container queries, not a hand-waved pixel media query, for the sheet", () => {
    assert.match(css, /@container reader \(max-width: 47\.98em\)/);
    assert.match(css, /@container reader \(min-width: 64em\)/);
    assert.match(css, /\.reader-bottom-sheet \{\s*display: block;/);
    assert.match(css, /\.reader-companion-column \{\s*display: none;/);
  });

  it("Planted Negative: a zero or nonfinite measure is refused by typed code", () => {
    assert.throws(() => layoutTier(0, 16), LayoutMeasureError);
    assert.throws(() => layoutTier(320, 0), LayoutMeasureError);
    assert.throws(() => layoutTier(Number.NaN, 16), LayoutMeasureError);
    try {
      layoutTier(-1, 16);
    } catch (err) {
      assert.equal((err as LayoutMeasureError).code, "invalid-layout-measure");
    }
  });
});
