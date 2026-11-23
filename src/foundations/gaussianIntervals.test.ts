import { describe, expect, test } from "bun:test";
import {
  gaussianInterval,
  INITIAL_GAUSSIAN_INTERVAL,
  readGaussianBand,
  readGaussianInterval,
} from "./gaussianIntervals.ts";

function admitted(width: number, lower: number, upper: number) {
  const result = gaussianInterval(width, lower, upper);
  expect(result.kind).toBe("accepted");
  if (result.kind !== "accepted") throw new Error(result.message);
  return result.interval;
}

describe("Gaussian intervals use one physical coordinate and preserve probability", () => {
  test("the initial one-micrometre example has independently known area and density", () => {
    expect(INITIAL_GAUSSIAN_INTERVAL.kind).toBe("accepted");
    const view = admitted(1, -1, 1);
    expect(view.inside).toBeCloseTo(0.6826894921370859, 13);
    expect(view.below).toBeCloseTo(0.15865525393145705, 13);
    expect(view.above).toBeCloseTo(0.15865525393145705, 13);
    expect(view.outside).toBeCloseTo(0.3173105078629141, 13);
    // This density is per micrometre, not the owner's SI value per metre.
    expect(view.peakDensity).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 13);
    expect(view.lowerDensity).toBeCloseTo(Math.exp(-0.5) / Math.sqrt(2 * Math.PI), 13);
    expect(view.upperDensity).toBeCloseTo(view.lowerDensity, 14);
    expect(view.diffusivity).toBeCloseTo(0.0000000000005, 25);
    expect(view.total).toBeCloseTo(1, 14);
  });

  test("changing width at fixed bounds changes the area and halves the peak", () => {
    const original = admitted(1, -1, 1);
    const wider = admitted(2, -1, 1);
    expect(wider.inside).toBeCloseTo(0.3829249225480262, 13);
    expect(wider.peakDensity).toBeCloseTo(original.peakDensity / 2, 14);
    expect(wider.inside).toBeLessThan(original.inside);
    expect(wider.outside).toBeGreaterThan(original.outside);
    expect(wider.lower).toBe(original.lower);
    expect(wider.upper).toBe(original.upper);
    expect(wider.samples.map((row) => row.position)).toEqual(
      original.samples.map((row) => row.position),
    );
  });

  test("the same number of RMS widths preserves its coverage at every admitted scale", () => {
    const probabilities = [0.6826894921370859, 0.9544997361036416, 0.9973002039367398];
    for (const width of [0.5, 0.75, 1, 1.5, 2]) {
      for (const widths of [1, 2, 3] as const) {
        const result = readGaussianBand(String(width), widths);
        expect(result.kind).toBe("accepted");
        if (result.kind !== "accepted") continue;
        const view = result.interval;
        expect(view.lower).toBe(-widths * width);
        expect(view.upper).toBe(widths * width);
        expect(view.inside).toBeCloseTo(probabilities[widths - 1] as number, 12);
        expect(view.below).toBeCloseTo(view.above, 13);
        expect(view.total).toBeCloseTo(1, 13);
      }
    }
  });

  test("a one-point interval has zero probability and a nonzero density", () => {
    const point = admitted(1, 1, 1);
    expect(point.inside).toBe(0);
    expect(point.lowerDensity).toBeGreaterThan(0);
    expect(point.lowerDensity).toBe(point.upperDensity);
    expect(point.below + point.above).toBeCloseTo(1, 14);
    expect(point.intervalSamples.every((sample) => sample.position === 1)).toBe(true);
  });

  test("remote intervals retain small positive tails rather than subtracting rounded CDFs", () => {
    const remote = admitted(0.5, 5, 6);
    // Standard-normal interval [10,12]; both endpoint CDFs round to one in binary64.
    expect(remote.inside).toBeGreaterThan(7.61e-24);
    expect(remote.inside).toBeLessThan(7.63e-24);
    expect(remote.above).toBeGreaterThan(1.77e-33);
    expect(remote.above).toBeLessThan(1.78e-33);
    const reflected = admitted(0.5, -6, -5);
    expect(reflected.inside / remote.inside).toBeCloseTo(1, 12);
    expect(reflected.below / remote.above).toBeCloseTo(1, 12);
  });

  test("an asymmetric narrow interval agrees with independent quadrature in micrometres", () => {
    const width = 1.25;
    const lower = 1.5;
    const upper = 1.5001;
    const view = admitted(width, lower, upper);
    // Midpoint quadrature of the normalized density, independently of the interval owner.
    const count = 1000;
    const dx = (upper - lower) / count;
    let integrated = 0;
    for (let index = 0; index < count; index += 1) {
      const position = lower + (index + 0.5) * dx;
      integrated +=
        (Math.exp(-0.5 * (position / width) ** 2) / (width * Math.sqrt(2 * Math.PI))) * dx;
    }
    expect(view.inside / integrated).toBeCloseTo(1, 10);
    expect(view.intervalSamples[0]?.position).toBe(lower);
    expect(view.intervalSamples[view.intervalSamples.length - 1]?.position).toBe(upper);
  });

  test("all emitted samples have density units consistent with the selected width", () => {
    for (const width of [0.5, 1, 2]) {
      const view = admitted(width, -2, 3);
      for (const sample of view.samples) {
        const expected =
          Math.exp(-0.5 * (sample.position / width) ** 2) / (width * Math.sqrt(2 * Math.PI));
        expect(sample.density / expected).toBeCloseTo(1, 12);
        expect(Object.isFrozen(sample)).toBe(true);
      }
      expect(view.samples[0]?.position).toBe(-6);
      expect(view.samples[view.samples.length - 1]?.position).toBe(6);
      expect(Object.isFrozen(view)).toBe(true);
      expect(Object.isFrozen(view.samples)).toBe(true);
      expect(Object.isFrozen(view.intervalSamples)).toBe(true);
      expect(Object.isFrozen(view.bands)).toBe(true);
      for (const band of view.bands) {
        expect(Object.isFrozen(band)).toBe(true);
        expect(Object.isFrozen(band.samples)).toBe(true);
      }
    }
  });

  test("invalid widths, reversed bounds and nonfinite inputs are refused without clamping", () => {
    for (const width of [NaN, Infinity, -Infinity, 0, -1, 0.49, 2.01]) {
      const result = gaussianInterval(width, -1, 1);
      expect(result.kind).toBe("refused");
      if (result.kind === "refused") expect(result.field).toBe("width");
    }
    for (const bound of [NaN, Infinity, -Infinity, -6.01, 6.01, 0.000000001]) {
      expect(gaussianInterval(1, bound, 1).kind).toBe("refused");
      expect(gaussianInterval(1, -1, bound).kind).toBe("refused");
    }
    const reversed = gaussianInterval(1, 2, -2);
    expect(reversed.kind).toBe("refused");
    if (reversed.kind === "refused") expect(reversed.field).toBe("interval");
  });

  test("typed input admits decimals and signed bounds while rejecting partial or underflowed text", () => {
    for (const text of ["", " ", "NaN", "Infinity", "0x1", "1 junk", "1+1", "1e-1000", "1".repeat(33)])
      expect(readGaussianInterval(text, "-1", "1").kind, text).toBe("refused");
    for (const text of ["", "2µm", "1e", "1e-1000", "0x0"]) {
      expect(readGaussianInterval("1", text, "1").kind, text).toBe("refused");
      expect(readGaussianInterval("1", "-1", text).kind, text).toBe("refused");
    }
    const signed = readGaussianInterval(" .5 ", "−1e0", "+1.0");
    expect(signed.kind).toBe("accepted");
    if (signed.kind === "accepted") expect(signed.interval.inside).toBeCloseTo(0.9544997361, 9);
    expect(readGaussianInterval("1", "-0", "+0").kind).toBe("accepted");
    expect(readGaussianBand("", 1).kind).toBe("refused");
    expect(readGaussianBand("3", 2).kind).toBe("refused");
  });
});
