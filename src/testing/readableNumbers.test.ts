import { describe, expect, test } from "bun:test";
import {
  fixed,
  numberText,
  sentenceNumber,
  toFixedReadable,
} from "../components/lab/presentation.ts";

/**
 * A lab never echoes a number in JavaScript's e-notation. toFixed writes it from 10²¹ up, and
 * String() does so there and below 10⁻⁶, and a reader can type either. On live on 2026-09-24,
 * typing 1e300 showed "1e+300" in BM-03, LQ-07, ME-01, SR-01, SR-09, SR-10 and SR-13 (fixed in
 * cdd27e59). Ordinary values keep the exact form they had.
 */
const EXPONENTIAL = /\d(?:\.\d+)?e[+-]\d/;

describe("the lab's number helpers", () => {
  test("ordinary values read exactly as toFixed and String() write them", () => {
    for (const value of [0, 1, -2.5, 30, 1500, 290.15, 0.001, 1e20]) {
      expect(toFixedReadable(value, 1)).toBe(value.toFixed(1));
      expect(numberText(value)).toBe(String(value));
    }
    expect(fixed(1500, 2)).toBe("1500");
    expect(fixed(-2.5, 2)).toBe("−2.5");
  });

  test("no extreme value is written in e-notation", () => {
    const extremes = [1e21, -1e21, 1e300, -1e300, 1.7e308, 1e-7, -3e-9, 5e-324];
    const written = extremes.flatMap((v) => [fixed(v, 3), toFixedReadable(v, 1), numberText(v)]);
    // Not vacuous: 24 strings, each checked.
    expect(written.length).toBe(24);
    expect(written.filter((w) => EXPONENTIAL.test(w))).toEqual([]);
    expect(numberText(1e300)).toBe("1 × 10³⁰⁰");
    expect(toFixedReadable(-1e300, 1)).toBe("−1 × 10³⁰⁰");
    expect(numberText(1e-7)).toBe("1 × 10⁻⁷");
  });

  test("sentenceNumber writes a status line's number as a reader would", () => {
    // LQ-09's ionization rate, which display() wrote as 260060000000.
    expect(sentenceNumber(2.6006e11)).toBe("2.6 × 10¹¹");
    expect(sentenceNumber(-2.5017e-9)).toBe("−2.5 × 10⁻⁹");
    expect(sentenceNumber(3e20)).toBe("3 × 10²⁰");
    expect(sentenceNumber(2.48)).toBe("2.48");
    expect(sentenceNumber(0.2799)).toBe("0.28");
    expect(sentenceNumber(-12.004)).toBe("−12");
    expect(sentenceNumber(9999)).toBe("10000");
    expect(sentenceNumber(10000)).toBe("1 × 10⁴");
    expect(sentenceNumber(0)).toBe("0");
    expect(() => sentenceNumber(Number.NaN)).toThrow();
  });
});
