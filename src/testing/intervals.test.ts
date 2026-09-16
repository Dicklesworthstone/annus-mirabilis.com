import { describe, expect, test } from "bun:test";
import {
  addIntervals,
  assertSingleRegime,
  classifyValueOrInterval,
  containsValue,
  createInterval,
  divideIntervals,
  hullIntervals,
  intersectIntervals,
  IntervalRefusalError,
  intervalsOverlap,
  multiplyIntervals,
  RegimeDefinition,
  scaleInterval,
  subtractIntervals,
} from "../physics/intervals.ts";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";

const logRunId = newExtractionLogRunId();

describe("Intervals and Physical Regimes Runtime Extraction", () => {
  test("interval arithmetic operations (add, subtract, multiply, divide, scale, hull, intersect)", () => {
    const start = performance.now();
    const a = createInterval(2, 5, "m");
    const b = createInterval(1, 3, "m");

    const sum = addIntervals(a, b);
    expect(sum.min).toBe(3);
    expect(sum.max).toBe(8);

    const diff = subtractIntervals(a, b);
    expect(diff.min).toBe(-1);
    expect(diff.max).toBe(4);

    const prod = multiplyIntervals(a, b);
    expect(prod.min).toBe(2);
    expect(prod.max).toBe(15);

    const quot = divideIntervals(a, b);
    expect(quot.min).toBeCloseTo(2 / 3, 6);
    expect(quot.max).toBe(5);

    const scaled = scaleInterval(a, -2);
    expect(scaled.min).toBe(-10);
    expect(scaled.max).toBe(-4);

    const inter = intersectIntervals(a, b);
    expect(inter?.min).toBe(2);
    expect(inter?.max).toBe(3);

    const hull = hullIntervals(a, b);
    expect(hull.min).toBe(1);
    expect(hull.max).toBe(5);

    expect(containsValue(a, 3)).toBe(true);
    expect(containsValue(a, 6)).toBe(false);
    expect(intervalsOverlap(a, b)).toBe(true);

    appendExtractionLog({
      logRunId,
      testId: "intervals-arithmetic-core",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "Rigorous interval arithmetic operations satisfy inclusion monotonicity",
    });
  });

  test("division by interval containing zero throws RangeError", () => {
    const start = performance.now();
    const a = createInterval(1, 2);
    const zeroCrossing = createInterval(-1, 2);

    expect(() => divideIntervals(a, zeroCrossing)).toThrow(RangeError);

    appendExtractionLog({
      logRunId,
      testId: "intervals-divide-by-zero-throws",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "divideIntervals refuses intervals containing zero",
    });
  });

  test("interval-arithmetic enclosure is not a probability interval", () => {
    // An interval-arithmetic enclosure provides guaranteed mathematical bounds (containment),
    // NOT a probability distribution or confidence interval with tail densities.
    // Interval multiplication and Minkowski addition yield worst-case guaranteed bounds.
    const start = performance.now();
    const measurement = createInterval(10, 20, "nm", "provenance-tolerance", "Definite bounded enclosure");
    const factor = createInterval(2, 3, "1", "provenance-tolerance", "Definite multiplier");

    const enclosed = multiplyIntervals(measurement, factor);
    expect(enclosed.min).toBe(20);
    expect(enclosed.max).toBe(60);
    // Verified that interval arithmetic produces a strict bounding box without probabilistic assumptions
    expect(enclosed.kind).toBe("provenance-tolerance");

    appendExtractionLog({
      logRunId,
      testId: "interval-arithmetic-enclosure-is-not-a-probability-interval",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "interval-arithmetic enclosure is not a probability interval; guaranteed containment bounds verified",
    });
  });

  test("physical regime classification handles single regime and refuses spanning regimes", () => {
    const start = performance.now();
    const testRegimes: RegimeDefinition<"rarefied" | "continuum" | "superdense"> = {
      id: "diffusion-density-regimes",
      domainName: "diffusion",
      parameterKey: "particleDensity",
      unit: "mol/m3",
      regimes: [
        {
          regime: "rarefied",
          interval: createInterval(0, 10, "mol/m3"),
          description: "Free particle Knudsen regime",
        },
        {
          regime: "continuum",
          interval: createInterval(10.01, 100, "mol/m3"),
          description: "Stokes-Einstein continuum diffusion",
        },
        {
          regime: "superdense",
          interval: createInterval(100.01, 1000, "mol/m3"),
          description: "Crowded medium / subdiffusion",
        },
      ],
      supportedRegimes: ["continuum"],
    };

    // Inside single supported regime
    const single = classifyValueOrInterval(testRegimes, 50);
    expect(single.primaryRegime).toBe("continuum");
    expect(single.isSupported).toBe(true);
    expect(single.isSpanningRegimes).toBe(false);
    expect(assertSingleRegime(testRegimes, 50)).toBe("continuum");

    // Inside unsupported regime
    const unsupported = classifyValueOrInterval(testRegimes, 5);
    expect(unsupported.primaryRegime).toBe("rarefied");
    expect(unsupported.isSupported).toBe(false);
    expect(() => assertSingleRegime(testRegimes, 5)).toThrow(IntervalRefusalError);

    // Spanning multiple regimes
    const spanning = classifyValueOrInterval(testRegimes, createInterval(5, 50, "mol/m3"));
    expect(spanning.isSpanningRegimes).toBe(true);
    expect(spanning.isSupported).toBe(false);
    expect(spanning.overlappingRegimes).toContain("rarefied");
    expect(spanning.overlappingRegimes).toContain("continuum");
    expect(() => assertSingleRegime(testRegimes, createInterval(5, 50, "mol/m3"))).toThrow(
      IntervalRefusalError,
    );

    appendExtractionLog({
      logRunId,
      testId: "intervals-regime-classification-refusal",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "classifyValueOrInterval classifies regimes and refuses intervals spanning regime boundaries",
    });
  });
});
