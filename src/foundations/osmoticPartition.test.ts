import { describe, expect, test } from "bun:test";
import {
  INITIAL_OSMOTIC_PARTITION,
  OSMOTIC_DEFAULTS,
  OSMOTIC_FIELDS,
  type OsmoticResult,
  osmoticDraft,
  osmoticPartition,
  readOsmoticPartition,
} from "./osmoticPartition.ts";

function accepted(result: OsmoticResult) {
  expect(result.kind).toBe("accepted");
  if (result.kind !== "accepted") throw new TypeError(result.message);
  return result.snapshot;
}

describe("the osmotic lesson reads one BM-02 calculation", () => {
  test("the printed dilute example at 293 K uses modern SI constants", () => {
    const result = accepted(INITIAL_OSMOTIC_PARTITION);
    expect(result.numberDensityM3 / 1e15).toBeCloseTo(1, 12);
    expect((result.pressurePa ?? 0) / 1e-6).toBeCloseTo(4.04530157, 10);
    expect(result.volumeFraction).toBeCloseTo(0.000523598775598, 14);
    expect(result.constantSetId).toBe("modern-si-2019");
    expect(result.pressureReason).toBeNull();
  });

  test("count and volume change pressure reciprocally, while radius changes only occupancy", () => {
    const original = accepted(INITIAL_OSMOTIC_PARTITION);
    for (const settings of [
      { ...OSMOTIC_DEFAULTS, count: 2000 },
      { ...OSMOTIC_DEFAULTS, volume: 500000 },
    ]) {
      const next = accepted(osmoticPartition(settings));
      expect((next.pressurePa ?? 0) / (original.pressurePa ?? 1)).toBeCloseTo(2, 12);
      expect(next.numberDensityM3 / original.numberDensityM3).toBeCloseTo(2, 12);
    }
    const larger = accepted(osmoticPartition({ ...OSMOTIC_DEFAULTS, radius: 1 }));
    expect(larger.pressurePa).toBe(original.pressurePa);
    expect(larger.volumeFraction / original.volumeFraction).toBeCloseTo(8, 12);
  });

  test("temperature enters linearly without changing count, volume or radius", () => {
    const original = accepted(INITIAL_OSMOTIC_PARTITION);
    const warmer = accepted(osmoticPartition({ ...OSMOTIC_DEFAULTS, temperature: 315 }));
    expect((warmer.pressurePa ?? 0) / (original.pressurePa ?? 1)).toBeCloseTo(315 / 293, 12);
    expect(warmer.volumeFraction).toBe(original.volumeFraction);
    expect(warmer.numberDensityM3).toBe(original.numberDensityM3);
  });

  test("crowding withholds pressure while preserving valid density and a usable repair", () => {
    const crowded = accepted(osmoticPartition({ ...OSMOTIC_DEFAULTS, count: 20000 }));
    expect(crowded.volumeFraction).toBeGreaterThan(0.01);
    expect(crowded.pressurePa).toBeNull();
    expect(crowded.pressureReason).toContain("no pressure is calculated");
    expect(crowded.numberDensityM3).toBeGreaterThan(0);
    const repaired = accepted(
      osmoticPartition({ ...crowded.settings, count: crowded.maximumDiluteCount }),
    );
    expect(repaired.volumeFraction).toBeLessThanOrEqual(0.01);
    expect(repaired.pressurePa).toBeGreaterThan(0);
    const justBeyond = accepted(
      osmoticPartition({ ...crowded.settings, count: crowded.maximumDiluteCount + 1 }),
    );
    expect(justBeyond.pressurePa).toBeNull();
  });

  test("zero particles have zero pressure, which is different from an unavailable pressure", () => {
    const empty = accepted(osmoticPartition({ ...OSMOTIC_DEFAULTS, count: 0 }));
    expect(empty.pressurePa).toBe(0);
    expect(empty.volumeFraction).toBe(0);
    expect(empty.pressureReason).toBeNull();
  });

  test("fractional counts, malformed inputs and construction-limit failures are named", () => {
    expect(osmoticPartition({ ...OSMOTIC_DEFAULTS, count: 1.5 })).toMatchObject({
      kind: "refused",
      field: "count",
    });
    for (const field of OSMOTIC_FIELDS) {
      for (const value of [NaN, Infinity, -1, field.max * 2])
        expect(osmoticPartition({ ...OSMOTIC_DEFAULTS, [field.key]: value })).toMatchObject({
          kind: "refused",
          field: field.key,
        });
      for (const text of ["", "-", "1+1", "NaN", "Infinity", "0x10", "1e-999", "9".repeat(49)])
        expect(
          readOsmoticPartition({ ...osmoticDraft(OSMOTIC_DEFAULTS), [field.key]: text }),
        ).toMatchObject({ kind: "refused", field: field.key });
    }
    expect(
      accepted(readOsmoticPartition({ ...osmoticDraft(OSMOTIC_DEFAULTS), count: "1e3" })).settings
        .count,
    ).toBe(1000);
  });

  test("accepted settings are immutable and detached from the input object", () => {
    const input = { ...OSMOTIC_DEFAULTS };
    const result = accepted(osmoticPartition(input));
    input.count = 1;
    expect(result.settings.count).toBe(1000);
    expect(Object.isFrozen(result.settings)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
