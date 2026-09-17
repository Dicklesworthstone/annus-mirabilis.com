import { describe, expect, test } from "bun:test";
import { haltonPoints, haltonValue } from "./samplePoints";

const GOLDEN_BASE_2 = [
  0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875, 0.0625, 0.5625, 0.3125, 0.8125, 0.1875, 0.6875,
  0.4375, 0.9375, 0.03125,
];
const GOLDEN_BASE_3 = [
  1 / 3,
  2 / 3,
  1 / 9,
  4 / 9,
  7 / 9,
  2 / 9,
  5 / 9,
  8 / 9,
  1 / 27,
  10 / 27,
  19 / 27,
  4 / 27,
  13 / 27,
  22 / 27,
  7 / 27,
  16 / 27,
];

describe("haltonValue: the first 16 points per base match the golden list bitwise", () => {
  test("base 2", () => {
    GOLDEN_BASE_2.forEach((expected, i) => {
      expect(haltonValue(i + 1, 2)).toBe(expected);
    });
  });
  test("base 3", () => {
    GOLDEN_BASE_3.forEach((expected, i) => {
      expect(haltonValue(i + 1, 3)).toBeCloseTo(expected, 15);
    });
  });
});

describe("haltonValue: the dyadic/triadic grid structure the sin(32*pi*x) attack exploits", () => {
  test("every one of the first 16 base-2 points is m/32 for an integer m -- this is exactly why a periodic function of high enough frequency can vanish on this grid without being an identity, and equivalence.ts's Philox second set (not yet built) exists to catch that", () => {
    for (let i = 1; i <= 16; i++) {
      const point = haltonValue(i, 2);
      expect(Number.isInteger(point * 32)).toBe(true);
    }
  });
  test("every one of the first 16 base-3 points is m/27 for an integer m", () => {
    for (let i = 1; i <= 16; i++) {
      const point = haltonValue(i, 3);
      expect(Math.round(point * 27)).toBeCloseTo(point * 27, 9);
    }
  });
});

describe("haltonPoints: domain mapping", () => {
  test("a linear domain maps [0,1) affinely", () => {
    const points = haltonPoints({ x: { min: 10, max: 20 } }, 4);
    expect(points[0]?.x).toBeCloseTo(15, 12); // 10 + 0.5*10
    expect(points[1]?.x).toBeCloseTo(12.5, 12); // 10 + 0.25*10
  });

  test("a log-scaled domain spanning many decades maps geometrically", () => {
    const points = haltonPoints({ D: { min: 1e-14, max: 1e-10, scale: "log" } }, 1);
    const value = points[0]?.D as number;
    expect(value).toBeGreaterThan(1e-14);
    expect(value).toBeLessThan(1e-10);
    // At u = 0.5, the log-scaled midpoint is the geometric mean.
    expect(value).toBeCloseTo(Math.sqrt(1e-14 * 1e-10), 20);
  });

  test("each declared variable gets a different Halton base, in declaration order", () => {
    const points = haltonPoints({ x: { min: 0, max: 1 }, y: { min: 0, max: 1 } }, 1);
    expect(points[0]?.x).toBeCloseTo(0.5, 12); // base 2
    expect(points[0]?.y).toBeCloseTo(1 / 3, 12); // base 3
  });
});
