import { describe, expect, test } from "bun:test";
import { deltaE2000, hexDeltaE2000, hexToLab } from "./ciede2000";

describe("hexToLab: sanity checks against known Lab landmarks", () => {
  test("white maps to L*=100, a*=0, b*=0", () => {
    const lab = hexToLab("#ffffff");
    expect(lab.l).toBeCloseTo(100, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });

  test("black maps to L*=0, a*=0, b*=0", () => {
    const lab = hexToLab("#000000");
    expect(lab.l).toBeCloseTo(0, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });
});

describe("deltaE2000: required mathematical properties", () => {
  test("identical colors have zero distance", () => {
    expect(hexDeltaE2000("#ae2119", "#ae2119")).toBeCloseTo(0, 9);
  });

  test("distance is symmetric", () => {
    const a = hexDeltaE2000("#ae2119", "#1a1916");
    const b = hexDeltaE2000("#1a1916", "#ae2119");
    expect(a).toBeCloseTo(b, 9);
  });

  test("black to white is a large, near-maximal distance", () => {
    expect(hexDeltaE2000("#000000", "#ffffff")).toBeGreaterThan(90);
  });

  test("a tiny perturbation gives a small distance, a large hue shift gives a large one", () => {
    const tiny = hexDeltaE2000("#ae2119", "#ae211a");
    const large = hexDeltaE2000("#ae2119", "#1976ae"); // red-ish to blue-ish
    expect(tiny).toBeLessThan(1);
    expect(large).toBeGreaterThan(tiny);
    expect(large).toBeGreaterThan(20);
  });

  test("two visually similar reds are closer than a red and a green", () => {
    const redToRed = hexDeltaE2000("#ae2119", "#c23428");
    const redToGreen = hexDeltaE2000("#ae2119", "#1f8a3c");
    expect(redToRed).toBeLessThan(redToGreen);
  });

  test("deltaE2000 on identical Lab triples is exactly zero, never NaN from a degenerate chroma", () => {
    const gray = { l: 50, a: 0, b: 0 };
    expect(deltaE2000(gray, gray)).toBe(0);
    expect(Number.isNaN(deltaE2000(gray, { l: 60, a: 0, b: 0 }))).toBe(false);
  });
});
