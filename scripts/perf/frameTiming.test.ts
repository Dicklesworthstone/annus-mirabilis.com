import { describe, expect, test } from "bun:test";
import { evaluateFrameTiming } from "./frameTiming.ts";

describe("Frame Timing Evaluation", () => {
  describe("desktop-capable (60 Hz target)", () => {
    test("passes on steady 60 Hz frame intervals (16.6 ms)", () => {
      // 100 intervals at 16.6 ms
      const intervals = Array.from({ length: 100 }, () => 16.6);
      const result = evaluateFrameTiming("desktop-capable", intervals);
      expect(result.ok).toBe(true);
      expect(result.medianMs).toBe(16.6);
      expect(result.longFraction).toBe(0);
    });

    test("passes with up to 5% long frames (> 33.4 ms)", () => {
      // 95 intervals at 16.6 ms, 5 intervals at 35 ms (5%)
      const intervals = [
        ...Array.from({ length: 95 }, () => 16.6),
        ...Array.from({ length: 5 }, () => 35.0),
      ];
      const result = evaluateFrameTiming("desktop-capable", intervals);
      expect(result.ok).toBe(true);
      expect(result.longFraction).toBe(0.05);
    });

    test("fails when tail fraction > 5% exceeds 33.4 ms", () => {
      // 90 intervals at 16.6 ms, 10 intervals at 35 ms (10%)
      const intervals = [
        ...Array.from({ length: 90 }, () => 16.6),
        ...Array.from({ length: 10 }, () => 35.0),
      ];
      const result = evaluateFrameTiming("desktop-capable", intervals);
      expect(result.ok).toBe(false);
      expect(result.longFraction).toBe(0.1);
    });

    test("fails when median exceeds 16.7 ms", () => {
      // 100 intervals at 20 ms
      const intervals = Array.from({ length: 100 }, () => 20.0);
      const result = evaluateFrameTiming("desktop-capable", intervals);
      expect(result.ok).toBe(false);
      expect(result.medianMs).toBe(20.0);
    });
  });

  describe("mobile-low-cost (30 Hz target)", () => {
    test("passes on steady 30 Hz frame intervals (33.3 ms)", () => {
      const intervals = Array.from({ length: 100 }, () => 33.3);
      const result = evaluateFrameTiming("mobile-low-cost", intervals);
      expect(result.ok).toBe(true);
      expect(result.medianMs).toBe(33.3);
      expect(result.longFraction).toBe(0);
    });

    test("passes with up to 5% frames > 50 ms", () => {
      const intervals = [
        ...Array.from({ length: 95 }, () => 33.3),
        ...Array.from({ length: 5 }, () => 55.0),
      ];
      const result = evaluateFrameTiming("mobile-low-cost", intervals);
      expect(result.ok).toBe(true);
      expect(result.longFraction).toBe(0.05);
    });

    test("fails when mobile tail fraction > 5% exceeds 50 ms", () => {
      const intervals = [
        ...Array.from({ length: 92 }, () => 33.3),
        ...Array.from({ length: 8 }, () => 55.0),
      ];
      const result = evaluateFrameTiming("mobile-low-cost", intervals);
      expect(result.ok).toBe(false);
      expect(result.longFraction).toBe(0.08);
    });

    test("fails when mobile median exceeds 33.4 ms", () => {
      const intervals = Array.from({ length: 100 }, () => 38.0);
      const result = evaluateFrameTiming("mobile-low-cost", intervals);
      expect(result.ok).toBe(false);
      expect(result.medianMs).toBe(38.0);
    });
  });
});
