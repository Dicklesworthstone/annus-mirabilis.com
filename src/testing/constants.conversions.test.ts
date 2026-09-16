import { describe, expect, test } from "bun:test";
import { convert } from "../physics/reference/constants.ts";

const FOUR_EPS = 4 * Number.EPSILON;

function assertRoundTrip(value: number, from: string, to: string): void {
  const there = convert(value, from, to);
  const back = convert(there, to, from);
  expect(Math.abs(back / value - 1)).toBeLessThan(FOUR_EPS);
}

describe("unit conversions: independently written expected values", () => {
  test("erg <-> J: 1e-7", () => {
    expect(convert(1, "erg", "J")).toBe(1e-7);
    assertRoundTrip(1, "erg", "J");
  });

  test("dyne <-> N: 1e-5", () => {
    expect(convert(1, "dyne", "N")).toBe(1e-5);
    assertRoundTrip(1, "dyne", "N");
  });

  test("poise <-> Pa s: 0.1", () => {
    expect(convert(1, "poise", "Pa s")).toBe(0.1);
    assertRoundTrip(1, "poise", "Pa s");
  });

  test("cm <-> m: 1e-2", () => {
    expect(convert(1, "cm", "m")).toBe(1e-2);
    assertRoundTrip(1, "cm", "m");
  });

  test("cm2 s-2 <-> m2 s-2: 1e-4", () => {
    expect(convert(1, "cm2 s-2", "m2 s-2")).toBe(1e-4);
    assertRoundTrip(1, "cm2 s-2", "m2 s-2");
  });

  test("statvolt <-> V: 299.792458 (conventional, per c in m/s over 1e6)", () => {
    expect(convert(1, "statvolt", "V")).toBeCloseTo(299.792458, 9);
    assertRoundTrip(1, "statvolt", "V");
  });

  test("statcoulomb (esu) <-> C: 1/(10c) = 3.3356409519815207e-10", () => {
    const value = convert(1, "statcoulomb", "C");
    expect(Math.abs(value / 3.3356409519815207e-10 - 1)).toBeLessThan(1e-12);
    assertRoundTrip(1, "statcoulomb", "C");
  });

  test("abvolt <-> V: 1e-8", () => {
    expect(convert(1, "abvolt", "V")).toBe(1e-8);
    assertRoundTrip(1, "abvolt", "V");
  });

  test("abcoulomb <-> C: 10", () => {
    expect(convert(1, "abcoulomb", "C")).toBe(10);
    assertRoundTrip(1, "abcoulomb", "C");
  });

  test("gauss <-> T: 1e-4", () => {
    expect(convert(1, "gauss", "T")).toBe(1e-4);
    assertRoundTrip(1, "gauss", "T");
  });

  test("refuses an unknown unit", () => {
    expect(() => convert(1, "furlong", "m")).toThrow(/Unknown unit/);
  });

  test("refuses conversion between incommensurable units", () => {
    expect(() => convert(1, "erg", "m")).toThrow(/different physical dimensions/);
  });
});
