import { describe, expect, it } from "bun:test";
import { U64_MAX_BIGINT, type U64String } from "../../experiments/identity/u64.ts";
import {
  type AllocationRecord,
  bm01Tile,
  bm05Tile,
  createStreamKey,
  PRODUCTION_RANGE,
  StreamAllocationRegistry,
  streamAllocationRegistry,
  TEST_FIXTURE_RANGE,
  UNALLOCATED_GAP,
} from "../../experiments/streams/allocation.ts";

describe("Stream Allocation Registry and Tile Mapping Invariants", () => {
  it("verifies built-in allocations have stable, unique kernel IDs and valid blocks", () => {
    const allocations = streamAllocationRegistry.listAllocations();
    expect(allocations.length).toBeGreaterThan(5);

    const seenIds = new Set<string>();

    for (const alloc of allocations) {
      expect(seenIds.has(alloc.allocationId)).toBe(false);
      seenIds.add(alloc.allocationId);

      expect(alloc.streamVersion).toBe(1);
      expect(alloc.indexRule).toBe("draws");

      if (alloc.block === "production") {
        expect(alloc.streamKernelId).toBeGreaterThanOrEqual(PRODUCTION_RANGE.start);
        expect(alloc.streamKernelId).toBeLessThanOrEqual(PRODUCTION_RANGE.end);
      } else {
        expect(alloc.streamKernelId).toBeGreaterThanOrEqual(TEST_FIXTURE_RANGE.start);
        expect(alloc.streamKernelId).toBeLessThanOrEqual(TEST_FIXTURE_RANGE.end);
      }

      // Must never be in unallocated gap
      expect(
        alloc.streamKernelId >= UNALLOCATED_GAP.start &&
          alloc.streamKernelId <= UNALLOCATED_GAP.end,
      ).toBe(false);
    }
  });

  it("proves bm-01.latent.v1 tile formula is a bijection onto 0..3M-1 and extension preserves tiles", () => {
    const M = 10000;
    const seenTiles = new Set<number>();

    // Test bijection for M = 10000 tracers across 3 axes
    for (let i = 0; i < M; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const tile = bm01Tile(i, axis);
        expect(tile).toBe(3 * i + axis);
        expect(tile).toBeGreaterThanOrEqual(0);
        expect(tile).toBeLessThanOrEqual(29999);
        expect(seenTiles.has(tile)).toBe(false);
        seenTiles.add(tile);
      }
    }

    expect(seenTiles.size).toBe(30000);

    // Growing M from 18 to 400 keeps tiles 0..53 identical
    for (let i = 0; i < 18; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const tile18 = 3 * i + axis;
        const tile400 = bm01Tile(i, axis);
        expect(tile400).toBe(tile18);
        expect(tile400).toBeLessThan(54);
      }
    }
  });

  it("verifies bm-05.walk.v1 tile mapping and draw limits", () => {
    const alloc = streamAllocationRegistry.getAllocation("bm-05.walk.v1");
    expect(alloc.streamKernelId).toBe(0x19050001);
    expect(alloc.tileFormula).toBe("tile=j");

    for (let j = 0; j < 100; j++) {
      expect(bm05Tile(j)).toBe(j);
    }

    expect(() => bm05Tile(-1)).toThrow(RangeError);
    expect(() => bm05Tile(10000)).toThrow(RangeError);
  });

  it("rejects planted duplicate allocation sharing both streamKernelId and tileFormula with distinct draw pattern", () => {
    const customRegistry = new StreamAllocationRegistry();

    // Plant an allocation that reuses 0x19050001 and 'tile=3*i+axis' with a different allocationId
    const plantedDuplicate: AllocationRecord = {
      allocationId: "planted.duplicate.v1",
      streamKernelId: 0x19050001,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=3*i+axis",
      indexRule: "draws",
      drawsPerStep: 4, // different draw pattern
      maxDrawsPerStream: 100000,
      computeTile: (i: number, axis: number) => 3 * i + axis,
    };

    expect(() => customRegistry.registerAllocation(plantedDuplicate)).toThrow();
    try {
      customRegistry.registerAllocation(plantedDuplicate);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      expect(msg).toContain("Allocation collision");
      expect(msg).toContain("planted.duplicate.v1");
      expect(msg).toContain("bm-01.latent.v1");
    }

    // But if it declares its own distinct tile formula, it registers successfully
    const plantedWithDistinctFormula: AllocationRecord = {
      allocationId: "planted.distinct-formula.v1",
      streamKernelId: 0x19050001,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=4*i+axis",
      indexRule: "draws",
      drawsPerStep: 4,
      maxDrawsPerStream: 100000,
      computeTile: (i: number, axis: number) => 4 * i + axis,
    };

    expect(() => customRegistry.registerAllocation(plantedWithDistinctFormula)).not.toThrow();
    expect(customRegistry.hasAllocation("planted.distinct-formula.v1")).toBe(true);
  });

  it("rejects allocations with invalid kernel IDs or wrapping draw counts", () => {
    const customRegistry = new StreamAllocationRegistry();

    // Production allocation in test-fixture range
    const invalidBlockAlloc: AllocationRecord = {
      allocationId: "invalid.block.v1",
      streamKernelId: 0x1905f000,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=x",
      indexRule: "draws",
      maxDrawsPerStream: 100,
      computeTile: () => 0,
    };
    expect(() => customRegistry.registerAllocation(invalidBlockAlloc)).toThrow();

    // Allocation in unallocated gap
    const gapAlloc: AllocationRecord = {
      allocationId: "gap.alloc.v1",
      streamKernelId: 0x19052000,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=x",
      indexRule: "draws",
      maxDrawsPerStream: 100,
      computeTile: () => 0,
    };
    expect(() => customRegistry.registerAllocation(gapAlloc)).toThrow();

    // Max draws that could wrap at 2^64
    const wrapAlloc: AllocationRecord = {
      allocationId: "wrap.alloc.v1",
      streamKernelId: 0x19050001,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=wrap",
      indexRule: "draws",
      maxDrawsPerStream: U64_MAX_BIGINT,
      computeTile: () => 0,
    };
    expect(() => customRegistry.registerAllocation(wrapAlloc)).toThrow();
  });

  it("constructs branded StreamKey instances with validated canonical seeds", () => {
    const key1 = createStreamKey("bm-01.latent.v1", "9007199254740993", 10, 1);
    expect(key1.allocationId).toBe("bm-01.latent.v1");
    expect(key1.seed).toBe("9007199254740993" as U64String);
    expect(key1.kernel).toBe(0x19050001);
    expect(key1.tile).toBe(31);

    const key2 = createStreamKey("bm-01.latent.v1", 9007199254740992n, 10, 1);
    expect(key2.seed).toBe("9007199254740992" as U64String);
    expect(key2.tile).toBe(31);

    expect(key1.seed).not.toBe(key2.seed);
  });
});
