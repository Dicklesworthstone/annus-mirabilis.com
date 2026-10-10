/**
 * THE RESTORE BOUND KEEPS A NEGATIVE OFFSET (am-read-anchors-navigation-a6o).
 *
 * `holdAt` turns a wanted restore offset into `scroll-margin-top`, and the bound it applied was
 * `Math.min(Math.max(wanted, 0), innerHeight * 0.8)`. The lower clamp discarded every offset that
 * put the anchor ABOVE the viewport top -- the ordinary case where a reader leaves a page having
 * scrolled a little past the sentence they were on. The restore then landed the anchor AT the top,
 * and the miss was exactly the magnitude that had been clamped away.
 *
 * It was `scripts/e2e/faceSwitchPlace.e2e.test.ts` criterion 6 that caught it, reporting a wanted
 * -72.9px arriving at 0.1px: a 73.0px drift against the 8 CSS px the criterion allows, while the
 * Detail-change variant beside it passed at 2.0px for the single reason that its wanted offset was
 * +16.1px.
 *
 * WHY THIS FILE EXISTS RATHER THAN RELYING ON THAT CRITERION. On the next build the same criterion
 * passed with a wanted offset of +16.1px, where the broken and repaired bounds return the identical
 * value -- so it would have gone green either way, and a green there is not evidence about the sign.
 * Whether the captured offset is negative depends on where the sentence sits in a particular build,
 * which is not a property any test should depend on. The sign question belongs to arithmetic, so it
 * is asked of arithmetic.
 *
 * The companion fact lives in `placeKeeper.test.ts:57`, which asserts `restoreDelta(100, snapshot,
 * VIEWPORT)` is -300: the owner's own test says the value can be negative. Only its application
 * could not express one.
 */
import { describe, expect, test } from "bun:test";
import { holdMargin } from "./FaceSwitchAnchor.tsx";

const VIEWPORT = 900;
/** The magnitude cap the original bound already applied, kept and merely mirrored. */
const LIMIT = VIEWPORT * 0.8;

describe("holdMargin", () => {
  test("a negative offset survives, which is the whole defect", () => {
    // The exact measurement from the failing criterion, so this test names the case it came from.
    expect(holdMargin(-72.9, VIEWPORT)).toBeCloseTo(-72.9, 10);
    // And the historical bound, asserted here as a NEGATIVE so the repair cannot silently revert:
    // `Math.max(-72.9, 0)` is 0, which is what landed the anchor at the viewport top.
    expect(Math.min(Math.max(-72.9, 0), LIMIT)).toBe(0);
  });

  test("a positive offset is unchanged, so the repair is not a behaviour change there", () => {
    // This is why the e2e criterion passed on the next build and proves nothing about the sign:
    // under both bounds a positive offset comes through identically.
    for (const wanted of [0, 0.1, 16.1, 100, LIMIT - 1]) {
      expect(holdMargin(wanted, VIEWPORT)).toBeCloseTo(wanted, 10);
      expect(holdMargin(wanted, VIEWPORT)).toBeCloseTo(Math.min(Math.max(wanted, 0), LIMIT), 10);
    }
  });

  test("the magnitude cap is kept in BOTH directions, so a wild value is still refused", () => {
    // A value beyond 80% of the viewport is not a place a reader left. The original bound refused
    // that upward; a symmetric bound must refuse it downward too, or the repair would trade one
    // defect for an unbounded margin.
    expect(holdMargin(5_000, VIEWPORT)).toBe(LIMIT);
    expect(holdMargin(-5_000, VIEWPORT)).toBe(-LIMIT);
    expect(holdMargin(Number.POSITIVE_INFINITY, VIEWPORT)).toBe(LIMIT);
    expect(holdMargin(Number.NEGATIVE_INFINITY, VIEWPORT)).toBe(-LIMIT);
  });

  test("the cap scales with the viewport rather than a hard-coded pixel count", () => {
    expect(holdMargin(-5_000, 400)).toBe(-320);
    expect(holdMargin(-5_000, 1_200)).toBe(-960);
    // A degenerate viewport collapses the bound to zero rather than producing NaN, so a restore on a
    // zero-height viewport sets no margin instead of an invalid one. Compared with `===` rather
    // than `toBe`, deliberately: the value is NEGATIVE zero, because Math.max(-72.9, -0) is -0, and
    // toBe uses Object.is, which separates -0 from 0. Nothing downstream does: `-0 === 0` is true,
    // and `scrollMarginTop = "-0px"` is the same zero margin to every engine. The distinction is
    // real in JavaScript and immaterial here, so the test says which it means.
    expect(holdMargin(-72.9, 0) === 0).toBe(true);
    expect(Number.isNaN(holdMargin(-72.9, 0))).toBe(false);
  });
});
