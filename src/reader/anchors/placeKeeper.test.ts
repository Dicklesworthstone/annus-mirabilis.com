import { describe, expect, test } from "bun:test";
import { type AddressableRect, capturePlace, restoreDelta } from "./placeKeeper";

const VIEWPORT = 800;

describe("capturePlace: the first at-least-half-visible unit, in document order", () => {
  test("a unit fully inside the viewport is captured with its top fraction", () => {
    const units: readonly AddressableRect[] = [{ id: "s3-p1-s1", top: 200, height: 100 }];
    expect(capturePlace(units, VIEWPORT)).toEqual({ anchorId: "s3-p1-s1", relativeOffset: 0.25 });
  });

  test("a unit less than half visible at the top is skipped in favor of the next visible unit", () => {
    const units: readonly AddressableRect[] = [
      { id: "s3-p1-s1", top: -80, height: 100 }, // only 20/100 visible
      { id: "s3-p1-s2", top: 50, height: 100 },
    ];
    expect(capturePlace(units, VIEWPORT)?.anchorId).toBe("s3-p1-s2");
  });

  test("a unit exactly half visible at the bottom edge still counts", () => {
    const units: readonly AddressableRect[] = [{ id: "s3-p1-s1", top: 750, height: 100 }];
    expect(capturePlace(units, VIEWPORT)?.anchorId).toBe("s3-p1-s1");
  });

  test("ties on visibility resolve to document order (the earlier unit in the array)", () => {
    const units: readonly AddressableRect[] = [
      { id: "s3-p1-s1", top: 100, height: 200 },
      { id: "s3-p1-s2", top: 100, height: 200 },
    ];
    expect(capturePlace(units, VIEWPORT)?.anchorId).toBe("s3-p1-s1");
  });

  test("returns undefined when nothing is at least half visible", () => {
    const units: readonly AddressableRect[] = [{ id: "s3-p1-s1", top: 790, height: 100 }];
    expect(capturePlace(units, VIEWPORT)).toBeUndefined();
  });

  test("returns undefined for an empty unit list", () => {
    expect(capturePlace([], VIEWPORT)).toBeUndefined();
  });
});

describe("restoreDelta: the scroll delta that restores the captured relative fraction", () => {
  test("no delta is needed when the anchor already sits at its captured fraction", () => {
    const snapshot = { anchorId: "s3-p1-s1", relativeOffset: 0.25 };
    expect(restoreDelta(0.25 * VIEWPORT, snapshot, VIEWPORT)).toBeCloseTo(0, 9);
  });

  test("a positive delta is returned when the anchor now sits lower than its captured fraction", () => {
    const snapshot = { anchorId: "s3-p1-s1", relativeOffset: 0.1 };
    // Anchor now at 500px, but it was captured at 10% of an 800px viewport (80px).
    expect(restoreDelta(500, snapshot, VIEWPORT)).toBeCloseTo(420, 9);
  });

  test("a negative delta is returned when the anchor now sits higher than its captured fraction", () => {
    const snapshot = { anchorId: "s3-p1-s1", relativeOffset: 0.5 };
    expect(restoreDelta(100, snapshot, VIEWPORT)).toBeCloseTo(-300, 9);
  });
});
