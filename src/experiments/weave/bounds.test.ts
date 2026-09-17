import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import { dkwBound, dkwBoundWithOffset } from "./bounds.ts";

function rel(a: number, b: number, tol = 1e-3): boolean {
  return withinTolerance(a, b, { relative: tol }).ok;
}

describe("dkwBound against independent arithmetic (am-read-result-weave-jex)", () => {
  test("alpha=1e-3, n=400 -> 0.0975", () => {
    expect(rel(dkwBound(1e-3, 400), 0.0975)).toBe(true);
  });
  test("alpha=1e-4, n=400 -> 0.1113", () => {
    expect(rel(dkwBound(1e-4, 400), 0.1113)).toBe(true);
  });
  test("alpha=1e-3, n=100 -> 0.1949", () => {
    expect(rel(dkwBound(1e-3, 100), 0.1949)).toBe(true);
  });
  test("alpha=1e-4, n=100 -> 0.2225", () => {
    expect(rel(dkwBound(1e-4, 100), 0.2225)).toBe(true);
  });
  test("alpha=1e-3, n=2000 -> 0.0436 (BM-05's base, before the shape-term offset)", () => {
    expect(rel(dkwBound(1e-3, 2000), 0.0436)).toBe(true);
  });

  test("sqrt(ln(2/alpha)/2) is 1.358 at alpha=0.05 and 1.628 at alpha=0.01 (the 1.36/1.63 Kolmogorov coefficients)", () => {
    const coeff = (alpha: number) => Math.sqrt(Math.log(2 / alpha) / 2);
    expect(rel(coeff(0.05), 1.358, 1e-2)).toBe(true);
    expect(rel(coeff(0.01), 1.628, 1e-2)).toBe(true);
    // And the bound itself reproduces the familiar 1.36/sqrt(n) and 1.63/sqrt(n) forms.
    expect(rel(dkwBound(0.05, 400), 1.358 / Math.sqrt(400), 1e-2)).toBe(true);
    expect(rel(dkwBound(0.01, 400), 1.628 / Math.sqrt(400), 1e-2)).toBe(true);
  });

  test("an offset output adds exactly", () => {
    const base = dkwBound(1e-3, 400);
    expect(dkwBoundWithOffset(1e-3, 400, 0)).toBe(base);
    expect(dkwBoundWithOffset(1e-3, 400, 0.01)).toBeCloseTo(base + 0.01, 12);
    expect(dkwBoundWithOffset(1e-3, 400, -0.005)).toBeCloseTo(base - 0.005, 12);
  });

  test("rejects out-of-range alpha and nonpositive n", () => {
    expect(() => dkwBound(0, 400)).toThrow(RangeError);
    expect(() => dkwBound(1, 400)).toThrow(RangeError);
    expect(() => dkwBound(1.5, 400)).toThrow(RangeError);
    expect(() => dkwBound(0.05, 0)).toThrow(RangeError);
    expect(() => dkwBound(0.05, -10)).toThrow(RangeError);
  });
});
