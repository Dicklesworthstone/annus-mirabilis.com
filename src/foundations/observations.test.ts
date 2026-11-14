import { describe, expect, test } from "bun:test";
import {
  DEFAULT_HISTOGRAM_BOUNDARIES,
  DEFAULT_HISTOGRAM_OBSERVATIONS,
  INITIAL_HISTOGRAM,
  INITIAL_OBSERVATION_SUMMARY,
  projectHistogram,
  readHistogram,
  readObservations,
} from "./observations.ts";

function observations(text: string) {
  const result = readObservations(text);
  if (result.kind === "invalid") throw new Error(result.reason);
  return result.summary;
}

function histogram(values: string, boundaries: string) {
  const result = readHistogram(values, boundaries);
  if (result.kind === "invalid") throw new Error(result.reason);
  return result.histogram;
}

describe("entered observations distinguish distance from zero and spread around the mean", () => {
  test("the printed balanced example has zero mean and nonzero spread", () => {
    const result = observations("−3, -1, 1, 3");
    expect(result).toEqual(INITIAL_OBSERVATION_SUMMARY);
    expect(result.mean).toBe(0);
    expect(result.meanAbsolute).toBe(2);
    expect(result.meanSquare).toBe(5);
    expect(result.variance).toBe(5);
    expect(result.rms).toBeCloseTo(Math.sqrt(5), 12);
    expect(result.standardDeviation).toBe(result.rms);
  });

  test("translating the sample preserves variance, while RMS gains the squared mean", () => {
    const shifted = observations("0, 2, 4, 6");
    expect(shifted.mean).toBe(3);
    expect(shifted.variance).toBe(INITIAL_OBSERVATION_SUMMARY.variance);
    expect(shifted.meanSquare).toBe(14);
    expect(shifted.rms).toBeCloseTo(Math.sqrt(14), 12);
    expect(shifted.standardDeviation).toBeCloseTo(Math.sqrt(5), 12);
    expect(shifted.rms).not.toBe(shifted.standardDeviation);
    expect(shifted.rows.map((row) => row.squaredDeviation)).toEqual([9, 1, 1, 9]);
    expect(shifted.meanSquare).toBe(shifted.variance + shifted.squaredMean);
  });

  test("identical nonzero observations and a single observation have zero variance", () => {
    for (const text of ["3, 3, 3, 3", "3"]) {
      const result = observations(text);
      expect(result.mean).toBe(3);
      expect(result.rms).toBe(3);
      expect(result.variance).toBe(0);
      expect(result.standardDeviation).toBe(0);
    }
  });

  test("scaling changes squared quantities quadratically and lengths linearly", () => {
    const initial = observations("-2, 1, 4");
    const scaled = observations("6, -3, -12");
    expect(scaled.mean).toBe(-3 * initial.mean);
    expect(scaled.meanSquare).toBeCloseTo(9 * initial.meanSquare, 12);
    expect(scaled.variance).toBeCloseTo(9 * initial.variance, 12);
    expect(scaled.meanAbsolute).toBeCloseTo(3 * initial.meanAbsolute, 12);
    expect(scaled.rms).toBeCloseTo(3 * initial.rms, 12);
  });

  test("centred differences retain a tiny spread about a large nonzero mean", () => {
    const result = observations("999.999998, 999.999999, 1000");
    expect(result.variance).toBeGreaterThan(0);
    expect(result.variance / ((2 / 3) * 0.000001 ** 2)).toBeCloseTo(1, 6);
    expect(result.rms).toBeGreaterThan(999);
    expect(result.standardDeviation).toBeLessThan(0.000001);
  });

  test("decimal and exponent notation are parsed, with signed zero normalized", () => {
    const result = observations("-0\n+.5 1e-3, −2.5");
    expect(result.values).toEqual([0, 0.5, 0.001, -2.5]);
    expect(Object.is(result.values[0], -0)).toBe(false);
  });

  test("empty, malformed, nonfinite, overflowing and underflowing inputs are refused", () => {
    for (const text of [
      "",
      " ",
      "1,,2",
      ",1",
      "1,",
      "1, ,2",
      "NaN",
      "Infinity",
      "1e309",
      "1/2",
      "2 µm",
      "1001",
      "-1001",
      "1e-7",
      "1e-400",
      "0x10",
      "1 ".repeat(33),
      "1".repeat(4097),
    ]) {
      const result = readObservations(text);
      expect(result.kind, text).toBe("invalid");
      if (result.kind === "invalid") {
        expect(result.field).toBe("observations");
        expect(result.reason.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("histogram width, density, and probability are distinct owned quantities", () => {
  test("initial bins count every observation once and retain the printed 0.3 share", () => {
    const result = histogram(DEFAULT_HISTOGRAM_OBSERVATIONS, DEFAULT_HISTOGRAM_BOUNDARIES);
    expect(result).toEqual(INITIAL_HISTOGRAM);
    expect(result.bins.map((bin) => bin.count)).toEqual([3, 3, 2, 2]);
    expect(result.bins[0]?.probability).toBe(0.3);
    expect(result.bins[0]?.density).toBe(0.15);
    expect(result.bins.reduce((total, bin) => total + bin.count, 0)).toBe(result.count);
    expect(result.totalProbability).toBe(1);
  });

  test("unequal widths make the tallest bar differ from the largest probability", () => {
    const result = histogram(DEFAULT_HISTOGRAM_OBSERVATIONS, "0, 2, 3, 8");
    expect(result.bins.map((bin) => bin.count)).toEqual([3, 1, 6]);
    expect(result.bins.map((bin) => bin.width)).toEqual([2, 1, 5]);
    expect(result.tallestBin).toBe(0);
    expect(result.largestShareBin).toBe(2);
    for (const bin of result.bins) expect(bin.area).toBeCloseTo(bin.probability, 12);
  });

  test("interior boundaries count to the right and the final endpoint is included", () => {
    const result = histogram("0, .1, .2, .3", "0, .1, .2, .3");
    expect(result.bins.map((bin) => bin.count)).toEqual([1, 1, 2]);
    expect(result.bins.map((bin) => bin.includesUpper)).toEqual([false, false, true]);
    expect(result.totalProbability).toBe(1);
  });

  test("empty bins stay empty and a narrow density can exceed one", () => {
    const result = histogram("0.05, .05", "0, .1, .2");
    expect(result.bins[0]?.density).toBe(10);
    expect(result.bins[0]?.probability).toBe(1);
    expect(result.bins[1]?.count).toBe(0);
    expect(result.bins[1]?.density).toBe(0);
    expect(result.bins[1]?.area).toBe(0);
  });

  test("changing length units rescales widths and densities while preserving every area", () => {
    const result = histogram(DEFAULT_HISTOGRAM_OBSERVATIONS, "0, 2, 3, 8");
    const projected = projectHistogram(result, "metre");
    expect(projected.symbol).toBe("m");
    for (const bin of projected.bins) {
      const original = result.bins[bin.index];
      if (!original) throw new Error("Expected the corresponding original bin");
      expect(bin.width).toBe(original.width * 0.000001);
      expect(bin.density).toBeCloseTo(original.density * 1_000_000, 8);
      expect(bin.count).toBe(original.count);
      expect(bin.probability).toBe(original.probability);
      expect(bin.area).toBeCloseTo(original.area, 12);
    }
    expect(projectHistogram(result, "micrometre").bins).toEqual(result.bins);
  });

  test("the minimum decimal bin width survives endpoint subtraction roundoff", () => {
    expect(readHistogram("1, 1.000001", "1, 1.000001").kind).toBe("accepted");
    expect(readHistogram("0, 0.000001", "0, 0.000001").kind).toBe("accepted");
  });

  test("unordered, duplicate, tiny, uncovered and malformed boundaries are refused", () => {
    for (const boundaries of [
      "",
      "0",
      "0, 2, 1",
      "0, 1, 1, 2",
      "0, .0000001, 2",
      "1, 2",
      "-1, 0",
      "0, Infinity",
      "0,,2",
      Array.from({ length: 14 }, (_, i) => i).join(","),
    ]) {
      const result = readHistogram("0, 1, 2", boundaries);
      expect(result.kind, boundaries).toBe("invalid");
      if (result.kind === "invalid") expect(result.field).toBe("boundaries");
    }
    const badObservation = readHistogram("NaN", "0, 1");
    expect(badObservation.kind).toBe("invalid");
    if (badObservation.kind === "invalid") expect(badObservation.field).toBe("observations");
  });
});
