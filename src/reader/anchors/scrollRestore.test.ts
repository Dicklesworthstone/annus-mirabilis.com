import { describe, expect, test } from "bun:test";
import {
  parseScrollRestoreRecord,
  restoreRelativeDelta,
  setManualScrollRestoration,
  withinRestoreTolerance,
} from "./scrollRestore.ts";

describe("history.scrollRestoration is manual", () => {
  test("the route sets manual restoration rather than trusting the browser's pixel restore", () => {
    const historyLike = { scrollRestoration: "auto" };
    setManualScrollRestoration(historyLike);
    expect(historyLike.scrollRestoration).toBe("manual");
  });
});

describe("scroll restore records refuse pixel offsets", () => {
  test("a well-formed relative record is accepted", () => {
    expect(
      parseScrollRestoreRecord({ face: "german", anchor: "s4-p2-s1", relativeOffset: 0.25 }),
    ).toEqual({ face: "german", anchor: "s4-p2-s1", relativeOffset: 0.25 });
  });

  test("PLANTED: a payload that stores pixels is refused, not applied", () => {
    expect(
      parseScrollRestoreRecord({
        face: "german",
        anchor: "s4-p2-s1",
        relativeOffset: 0.25,
        scrollY: 480,
      }),
    ).toBeNull();
    expect(parseScrollRestoreRecord({ face: "german", anchor: "s4-p2-s1", topPx: 480 })).toBeNull();
  });
});

describe("PLANTED: relative restore survives a Detail/zoom change; pixel restore does not", () => {
  test("after layout heights double, the relative fraction still lands within 8 CSS px", () => {
    const viewport = 800;
    const capturedTop = 200;
    const relativeOffset = capturedTop / viewport;
    const afterDetailChangeTop = capturedTop * 2;
    const delta = restoreRelativeDelta(afterDetailChangeTop, relativeOffset, viewport);
    const restoredTop = afterDetailChangeTop - delta;
    expect(withinRestoreTolerance(restoredTop, relativeOffset * viewport)).toBe(true);

    const pixelRestoreTop = 200;
    expect(withinRestoreTolerance(pixelRestoreTop, relativeOffset * viewport)).toBe(true);
    expect(withinRestoreTolerance(pixelRestoreTop, afterDetailChangeTop)).toBe(false);
  });
});
