import { describe, expect, test } from "bun:test";
import { evaluateLayoutShift, type LayoutShiftEntry } from "./layoutShift.ts";

describe("Layout Shift Evaluation", () => {
  test("excludes entries where hadRecentInput is true", () => {
    const entries: LayoutShiftEntry[] = [
      { startTime: 100, value: 0.05, hadRecentInput: false },
      { startTime: 200, value: 0.5, hadRecentInput: true }, // User interaction shift: ignored
      { startTime: 300, value: 0.02, hadRecentInput: false },
    ];

    const result = evaluateLayoutShift(entries);
    expect(result.maxSessionWindowScore).toBe(0.07);
    expect(result.overBudget).toBe(false);
  });

  test("closes window on gap of exactly 1 s (1000 ms)", () => {
    const entries: LayoutShiftEntry[] = [
      { startTime: 1000, value: 0.04, hadRecentInput: false },
      // Gap of exactly 1000 ms (2000 - 1000 = 1000): should break into new window!
      { startTime: 2000, value: 0.06, hadRecentInput: false },
    ];

    const result = evaluateLayoutShift(entries);
    expect(result.sessionWindowsCount).toBe(2);
    // Window 1: 0.04, Window 2: 0.06. Max = 0.06 (NOT 0.10)
    expect(result.maxSessionWindowScore).toBe(0.06);
    expect(result.overBudget).toBe(false);
  });

  test("closes window on 5 s duration cap", () => {
    // Continuous shifts every 800 ms (gap < 1000 ms), spanning 6000 ms
    const entries: LayoutShiftEntry[] = [
      { startTime: 0, value: 0.02, hadRecentInput: false },
      { startTime: 800, value: 0.02, hadRecentInput: false },
      { startTime: 1600, value: 0.02, hadRecentInput: false },
      { startTime: 2400, value: 0.02, hadRecentInput: false },
      { startTime: 3200, value: 0.02, hadRecentInput: false },
      { startTime: 4000, value: 0.02, hadRecentInput: false },
      { startTime: 4800, value: 0.02, hadRecentInput: false }, // window duration = 4800 <= 5000: score = 0.14
      // Next entry at 5600: window duration from start (0) is 5600 > 5000: caps and breaks!
      { startTime: 5600, value: 0.03, hadRecentInput: false },
    ];

    const result = evaluateLayoutShift(entries);
    expect(result.sessionWindowsCount).toBe(2);
    // Window 1 score: 7 * 0.02 = 0.14
    // Window 2 score: 0.03
    expect(result.maxSessionWindowScore).toBe(0.14);
    expect(result.overBudget).toBe(true); // 0.14 > 0.1
  });

  test("fails on planted over-budget input (> 0.1)", () => {
    const entries: LayoutShiftEntry[] = [{ startTime: 500, value: 0.12, hadRecentInput: false }];

    const result = evaluateLayoutShift(entries);
    expect(result.maxSessionWindowScore).toBe(0.12);
    expect(result.overBudget).toBe(true);
  });
});
