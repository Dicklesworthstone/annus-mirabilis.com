import { describe, expect, test } from "bun:test";
import { rampArea, stripSum } from "./bridgeFigures.ts";
import {
  INITIAL_RAMP_PARTITION,
  INTEGRATION_STRIP_LIMIT,
  partitionRamp,
  readRampPartition,
  REFERENCE_RAMP_PARTITION,
} from "./integrationStrips.ts";

describe("integration strips preserve the lesson's density and bracket its area", () => {
  test("the initial comparison keeps both original worked examples", () => {
    expect(REFERENCE_RAMP_PARTITION.count).toBe(4);
    expect(REFERENCE_RAMP_PARTITION.leftTotal).toBe(stripSum(4));
    expect(INITIAL_RAMP_PARTITION.count).toBe(8);
    expect(INITIAL_RAMP_PARTITION.leftTotal).toBe(stripSum(8));
    expect(INITIAL_RAMP_PARTITION.exactArea).toBe(rampArea());
  });

  test("every permitted count has the independently derived lower and upper sums", () => {
    for (let count = 1; count <= INTEGRATION_STRIP_LIMIT; count += 1) {
      const result = partitionRamp(count);
      expect(result.kind).toBe("accepted");
      if (result.kind !== "accepted") continue;
      const partition = result.partition;
      // For this linear density, the missed and excess triangles each have area 1/count.
      expect(partition.leftTotal).toBeCloseTo(1 - 1 / count, 12);
      expect(partition.rightTotal).toBeCloseTo(1 + 1 / count, 12);
      expect(partition.midpointTotal).toBeCloseTo(1, 12);
      expect(partition.bracketWidth).toBeCloseTo(2 / count, 12);
      expect(partition.leftTotal).toBeCloseTo(stripSum(count), 12);
      expect(partition.exactArea).toBe(rampArea());
      expect(partition.leftTotal).toBeLessThan(partition.exactArea);
      expect(partition.rightTotal).toBeGreaterThan(partition.exactArea);
      expect(partition.strips.length).toBe(count);
    }
  });

  test("each displayed rectangle owns the sample and area used in its sum", () => {
    const result = partitionRamp(7);
    expect(result.kind).toBe("accepted");
    if (result.kind !== "accepted") return;
    const partition = result.partition;
    for (const rule of ["left", "midpoint", "right"] as const) {
      const area = partition.strips.reduce((total, strip) => {
        const sample = strip.samples[rule];
        expect(sample.position).toBeGreaterThanOrEqual(strip.left);
        expect(sample.position).toBeLessThanOrEqual(strip.right);
        expect(sample.area).toBe(sample.height * strip.width);
        expect(Object.isFrozen(sample)).toBe(true);
        expect(Object.isFrozen(strip.samples)).toBe(true);
        expect(Object.isFrozen(strip)).toBe(true);
        return total + sample.area;
      }, 0);
      const expected =
        rule === "left"
          ? partition.leftTotal
          : rule === "right"
            ? partition.rightTotal
            : partition.midpointTotal;
      expect(area).toBe(expected);
    }
    expect(Object.isFrozen(partition)).toBe(true);
    expect(Object.isFrozen(partition.strips)).toBe(true);
  });

  test("invalid work sizes and malformed typed counts are refused before allocation", () => {
    for (const count of [NaN, Infinity, -Infinity, -1, 0, 0.5, 129, 1e100])
      expect(partitionRamp(count).kind).toBe("refused");
    for (const text of ["", " ", "0", "-1", "1.5", "1e2", "4junk", "NaN", "0x10", "1".repeat(17)]) {
      const result = readRampPartition(text);
      expect(result.kind, text).toBe("refused");
      if (result.kind === "refused") expect(result.message).toContain("whole number");
    }
    for (const text of ["1", " 8 ", "0016", "128"])
      expect(readRampPartition(text).kind, text).toBe("accepted");
  });
});
