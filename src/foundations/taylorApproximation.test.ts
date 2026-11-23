import { describe, expect, test } from "bun:test";
import { binomialPartialSumsGamma, gammaMinusOneCancellationFree } from "./calculus.ts";
import {
  compareTaylorApproximation,
  MINIMUM_TAYLOR_SPEED,
  readTaylorApproximation,
  TAYLOR_TERM_COUNTS,
} from "./taylorApproximation.ts";

function accepted(speed: number, count: number) {
  const result = compareTaylorApproximation(speed, count);
  expect(result.kind).toBe("accepted");
  if (result.kind !== "accepted") throw new Error(result.message);
  return result.comparison;
}

/** Independent positive-series recurrence, not the rationalized polynomial used by the owner. */
function sumOmittedTerms(x: number, retained: number): number {
  let term = 1;
  let total = 0;
  for (let n = 1; n <= 5000; n += 1) {
    term *= ((2 * n - 1) / (2 * n)) * x;
    if (n > retained) {
      total += term;
      if (term < total * 1e-16) return total;
    }
  }
  throw new Error("The independent reference did not converge in its declared domain.");
}

describe("Taylor truncation keeps the full value and the small omitted remainder distinct", () => {
  test("the moderate-speed example preserves every authored term and the paper's first-term loss", () => {
    const comparison = accepted(0.6, 1);
    expect(comparison.exact).toBeCloseTo(0.25, 14);
    expect(comparison.terms.map((row) => row.count)).toEqual([1, 2, 3, 4]);
    const sums = [0.18, 0.2286, 0.24318, 0.2477727];
    for (const [index, row] of comparison.terms.entries()) {
      expect(row.sum).toBeCloseTo(sums[index]!, 14);
      expect(row.sum + row.remainder).toBeCloseTo(0.25, 14);
    }
    expect(comparison.selected.relativeRemainder).toBeCloseTo(0.28, 14);
    expect(accepted(0.6, 4).selected.relativeRemainder).toBeCloseTo(0.0089092, 14);
  });

  test("small nonzero speeds retain positive remainders after full-minus-partial becomes zero", () => {
    const comparison = accepted(1e-10, 4);
    expect(comparison.exact / 5e-21).toBeCloseTo(1, 14);
    // A naive implementation prints this subtraction as the truncation error: exactly zero.
    expect(comparison.exact - comparison.selected.sum).toBe(0);
    const firstOmittedCoefficients = [3 / 8, 5 / 16, 35 / 128, 63 / 256];
    for (const [index, row] of comparison.terms.entries()) {
      const leading = firstOmittedCoefficients[index]! * comparison.x ** (row.count + 1);
      expect(row.remainder).toBeGreaterThan(0);
      expect(row.remainder / leading).toBeCloseTo(1, 14);
      expect(row.relativeRemainder).toBeGreaterThan(0);
    }
  });

  test("the actual remainder agrees with an independent tail recurrence, including the admitted low-speed boundary", () => {
    for (const speed of [MINIMUM_TAYLOR_SPEED, 1e-10, 0.0001, 0.01, 0.2, 0.6, 0.9]) {
      const comparison = accepted(speed, 4);
      let previousRemainder = comparison.exact;
      for (const row of comparison.terms) {
        const independent = sumOmittedTerms(comparison.x, row.count);
        expect(row.remainder / independent).toBeCloseTo(1, 12);
        expect(row.remainder).toBeLessThan(previousRemainder);
        expect(row.sum).toBeGreaterThan(0);
        previousRemainder = row.remainder;
      }
    }
  });

  test("positive tails obey independent first-omitted-term bounds and remain large near light speed", () => {
    const coefficients = [3 / 8, 5 / 16, 35 / 128, 63 / 256];
    for (const speed of [0.01, 0.3, 0.6, 0.99, 1 - Number.EPSILON / 2]) {
      const comparison = accepted(speed, 4);
      for (const [index, row] of comparison.terms.entries()) {
        const first = coefficients[index]! * comparison.x ** (row.count + 1);
        expect(row.remainder / first).toBeGreaterThanOrEqual(1 - 4 * Number.EPSILON);
        expect(row.remainder / (first / (1 - comparison.x))).toBeLessThanOrEqual(
          1 + 4 * Number.EPSILON,
        );
        expect(Number.isFinite(row.remainder)).toBe(true);
        expect(row.relativeRemainder).toBeLessThan(1);
      }
    }
    expect(accepted(0.99, 4).selected.relativeRemainder).toBeGreaterThan(0.75);
  });

  test("rest is an exact zero with no relative error, and sampled comparisons use the chosen truncation", () => {
    const rest = accepted(0, 2);
    expect(rest.exact).toBe(0);
    for (const row of rest.terms) {
      expect(row.sum).toBe(0);
      expect(row.remainder).toBe(0);
      expect(row.relativeRemainder).toBeNull();
    }
    const one = accepted(0.6, 1);
    const four = accepted(0.6, 4);
    expect(one.samples.map((row) => row.speed)).toEqual(four.samples.map((row) => row.speed));
    for (const [index, sample] of four.samples.entries()) {
      expect(sample.exact).toBe(one.samples[index]!.exact);
      if (sample.speed !== 0) {
        expect(sample.approximation).toBeGreaterThanOrEqual(one.samples[index]!.approximation);
        expect(sample.relativeRemainder).toBeLessThan(one.samples[index]!.relativeRemainder!);
      }
    }
  });

  test("the canonical full-expression owner keeps low values and refuses nonfinite inputs", () => {
    expect(binomialPartialSumsGamma(1e-20).exact / 5e-21).toBeCloseTo(1, 14);
    for (const invalid of [NaN, Infinity, -Infinity, -1, 1])
      expect(() => binomialPartialSumsGamma(invalid)).toThrow(RangeError);
    for (const invalid of [NaN, Infinity, -Infinity, -1, 1])
      expect(() => gammaMinusOneCancellationFree(invalid)).toThrow(RangeError);
    expect(gammaMinusOneCancellationFree(-0.6)).toBe(gammaMinusOneCancellationFree(0.6));
  });

  test("invalid drafts never turn into rest or an inertial light-speed calculation", () => {
    for (const speed of [NaN, Infinity, -Infinity, -0.1, 1, 2, 1e-31])
      expect(compareTaylorApproximation(speed, 1).kind).toBe("refused");
    for (const count of [NaN, Infinity, 0, -1, 1.5, 5])
      expect(compareTaylorApproximation(0.6, count).kind).toBe("refused");
    for (const input of ["", " ", "-1", "1", "NaN", "0x10", "0.6junk", "1/2", "1e-500", "1".repeat(65)])
      expect(readTaylorApproximation(input, 1).kind, input).toBe("refused");
    for (const input of ["0", "0e-500", " .6 ", "+0.6", "1e-4", "1e-30"])
      expect(readTaylorApproximation(input, 1).kind, input).toBe("accepted");
  });

  test("accepted tables and selected values are one immutable comparison", () => {
    for (const count of TAYLOR_TERM_COUNTS) {
      const comparison = accepted(0.6, count);
      expect(Object.isFrozen(comparison)).toBe(true);
      expect(Object.isFrozen(comparison.terms)).toBe(true);
      expect(Object.isFrozen(comparison.samples)).toBe(true);
      expect(comparison.selected).toBe(comparison.terms[count - 1]);
      for (const row of [...comparison.terms, ...comparison.samples])
        expect(Object.isFrozen(row)).toBe(true);
    }
  });
});

describe("Taylor curves belong to the same accepted scientific comparison", () => {
  test("bounded samples stay below light speed and retain finite scales at rest and tiny speeds", () => {
    for (const speed of [0, MINIMUM_TAYLOR_SPEED, 1e-10, 0.0001, 0.6, 0.99, 1 - Number.EPSILON / 2]) {
      const comparison = accepted(speed, 4);
      const { curve } = comparison;
      expect(curve.points.length).toBeGreaterThan(2);
      expect(curve.points.length).toBeLessThanOrEqual(256);
      expect(curve.speedLimit).toBe(speed === 0 ? 0.6 : speed);
      expect(curve.valueLimit).toBeGreaterThan(0);
      expect(Number.isFinite(curve.valueLimit)).toBe(true);
      expect(curve.points[0]?.speed).toBe(0);
      expect(curve.points[0]?.exact).toBe(0);
      let previousSpeed = 0;
      let previousExact = 0;
      for (const point of curve.points) {
        expect(point.speed).toBeGreaterThanOrEqual(previousSpeed);
        expect(point.speed).toBeLessThan(1);
        expect(point.exact).toBeGreaterThanOrEqual(previousExact);
        expect(Number.isFinite(point.exact / curve.valueLimit)).toBe(true);
        expect(point.exact).toBeLessThanOrEqual(curve.valueLimit * (1 + 8 * Number.EPSILON));
        expect(point.approximation).toBeLessThanOrEqual(point.exact * (1 + 8 * Number.EPSILON));
        const canonical = binomialPartialSumsGamma(point.speed * point.speed);
        expect(point.exact).toBe(canonical.exact);
        expect(point.approximation).toBe(canonical.partialSums[3]);
        previousSpeed = point.speed;
        previousExact = point.exact;
      }
      const last = curve.points[curve.points.length - 1];
      expect(last?.speed).toBe(curve.speedLimit);
      expect(last?.exact).toBe(curve.valueLimit);
      if (speed !== 0) {
        expect(last?.exact).toBe(comparison.exact);
        expect(last?.approximation).toBe(comparison.selected.sum);
      } else {
        expect(comparison.selected.sum).toBe(0);
        expect(curve.valueLimit).toBeCloseTo(0.25, 14);
      }
      expect(Object.isFrozen(curve)).toBe(true);
      expect(Object.isFrozen(curve.points)).toBe(true);
      expect(curve.points.every(Object.isFrozen)).toBe(true);
    }
  });

  test("changing truncation preserves sample speeds and the full curve", () => {
    const one = accepted(0.6, 1);
    const four = accepted(0.6, 4);
    expect(one.curve.speedLimit).toBe(four.curve.speedLimit);
    expect(one.curve.valueLimit).toBe(four.curve.valueLimit);
    expect(one.curve.points.map((point) => [point.speed, point.exact])).toEqual(
      four.curve.points.map((point) => [point.speed, point.exact]),
    );
    expect(four.curve.points.some((point, index) =>
      point.approximation > (one.curve.points[index]?.approximation ?? Infinity),
    )).toBe(true);
  });
});
