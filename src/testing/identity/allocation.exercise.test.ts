import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { parseU64, type U64String, U64ValidationError } from "../../experiments/identity/u64.ts";
import {
  type AllocationRecord,
  createStreamKey,
  StreamAllocationRegistry,
  streamAllocationRegistry,
} from "../../experiments/streams/allocation.ts";
import { createPhiloxStream } from "../../physics/reference/philox.ts";

/**
 * Derives a canonical 64-bit seed from exerciseId and partIndex
 * using the first 64 bits of SHA-256 (Specification requirement 7).
 */
function deriveExerciseSeed(exerciseId: string, partIndex: number): U64String {
  const hash = createHash("sha256").update(`${exerciseId}/${partIndex}`).digest();
  const seedBig = hash.readBigUInt64BE(0);
  return parseU64(seedBig.toString());
}

describe("Exercise Sample Points Stream Allocation (exercise.sample-points.v1)", () => {
  const alloc = streamAllocationRegistry.getAllocation("exercise.sample-points.v1");

  it("registers with production kernel ID 0x19050006 and tile=v formula", () => {
    expect(alloc.streamKernelId).toBe(0x19050006);
    expect(alloc.block).toBe("production");
    expect(alloc.tileFormula).toBe("tile=v");
    expect(alloc.indexRule).toBe("draws");
    expect(alloc.maxDrawsPerStream).toBe(64);
  });

  it("draws points on separate tiles per variable and counts draws per candidate", () => {
    const exerciseId = "ex-brownian-viscosity";
    const seed = deriveExerciseSeed(exerciseId, 0);

    // Part with 3 variables (e.g. T, eta, r) -> tiles 0, 1, 2
    const numVariables = 3;
    const candidatesCount = 8;

    const generatePoints = (s: U64String) => {
      const points: number[][] = [];
      // Initialize Philox streams for each variable tile
      const streams = Array.from({ length: numVariables }, (_, v) => {
        const streamKey = createStreamKey("exercise.sample-points.v1", s, v);
        return createPhiloxStream(streamKey, "0");
      });

      for (let j = 0; j < candidatesCount; j++) {
        const candidatePoint = streams.map((stream) => stream.nextF64());
        points.push(candidatePoint);
      }

      // Check stream index reached candidatesCount
      for (const stream of streams) {
        expect(Number(stream.index)).toBe(candidatesCount);
      }

      return points;
    };

    const run1 = generatePoints(seed);
    const run2 = generatePoints(seed);

    // Assert bitwise identical replay
    expect(run1).toEqual(run2);

    // Run with different partIndex -> different seed -> different point set
    const seedPart1 = deriveExerciseSeed(exerciseId, 1);
    expect(seedPart1).not.toBe(seed);
    const runPart1 = generatePoints(seedPart1);
    expect(runPart1).not.toEqual(run1);
  });

  it("enforces declared variable ceiling (256) and draw ceiling (64)", () => {
    // 256 variables max: tile 0..255 valid, 256 throws
    expect(alloc.computeTile(0)).toBe(0);
    expect(alloc.computeTile(255)).toBe(255);
    expect(() => alloc.computeTile(256)).toThrow(RangeError);
    expect(() => alloc.computeTile(-1)).toThrow(RangeError);

    // Candidate ceiling: 64 draws max
    const seed = deriveExerciseSeed("ex-ceiling", 0);
    const key = createStreamKey("exercise.sample-points.v1", seed, 0);
    const stream = createPhiloxStream(key, "0");

    for (let i = 0; i < 64; i++) {
      stream.nextF64();
    }
    expect(Number(stream.index)).toBe(64);
  });

  it("rejects test-fixture allocation using production exercise ID and vice versa", () => {
    const customRegistry = new StreamAllocationRegistry();

    // Fixture registering exercise.sample-points.v1 against reserved test-fixture ID
    const fixtureWithReservedId: AllocationRecord = {
      allocationId: "exercise.sample-points.v1-bad-block",
      streamKernelId: 0x1905f002, // reserved block
      streamVersion: 1,
      block: "production", // claims production block
      tileFormula: "tile=v",
      indexRule: "draws",
      maxDrawsPerStream: 64,
      computeTile: (v: number) => v,
    };
    expect(() => customRegistry.registerAllocation(fixtureWithReservedId)).toThrow();

    // src/testing allocation naming the production exercise ID
    const testCallerUsingProductionId: AllocationRecord = {
      allocationId: "src-testing.exercise-mock.v1",
      streamKernelId: 0x19050006, // production ID
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=mock-v",
      indexRule: "draws",
      maxDrawsPerStream: 64,
      computeTile: (v: number) => v,
    };
    expect(() =>
      customRegistry.registerAllocation(testCallerUsingProductionId, {
        callerIsTest: true,
      }),
    ).toThrow();
  });

  it("rejects planted allocation sharing exercise ID and tile=v with different draw pattern", () => {
    const customRegistry = new StreamAllocationRegistry();

    const plantedExerciseDuplicate: AllocationRecord = {
      allocationId: "planted.exercise.duplicate.v1",
      streamKernelId: 0x19050006,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=v",
      indexRule: "draws",
      drawsPerStep: 2, // different draw pattern
      maxDrawsPerStream: 128,
      computeTile: (v: number) => v,
    };

    expect(() => customRegistry.registerAllocation(plantedExerciseDuplicate)).toThrow();
    try {
      customRegistry.registerAllocation(plantedExerciseDuplicate);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      expect(msg).toContain("Allocation collision");
      expect(msg).toContain("planted.exercise.duplicate.v1");
      expect(msg).toContain("exercise.sample-points.v1");
    }
  });

  it("accepts canonical U64String seed and rejects JSON numbers", () => {
    const validSeed = "9007199254740993";
    const key = createStreamKey("exercise.sample-points.v1", validSeed, 0);
    expect(key.seed).toBe("9007199254740993" as U64String);

    // Passing JSON number directly to seed parse must fail
    const parsedJsonNumber = JSON.parse("9007199254740993");
    expect(() => parseU64(parsedJsonNumber)).toThrow(U64ValidationError);
  });
});

describe("test-fixture block admission by id segment, not substring (am-o44v)", () => {
  const fixtureRecord = (allocationId: string): AllocationRecord => ({
    allocationId,
    // Inside TEST_FIXTURE_RANGE [0x1905f000, 0x1905ffff]. My first draft used
    // 0x7f000001, which the RANGE check refuses before the id guard is ever
    // reached - a fixture that cannot arrive at the state it is meant to test.
    streamKernelId: 0x1905f001,
    streamVersion: 1,
    block: "test-fixture",
    tileFormula: "tile=v",
    indexRule: "draws",
    maxDrawsPerStream: 64,
    computeTile: (v: number) => v,
  });

  // The guard read id.includes("test") || id.includes("fixture") ||
  // id.includes("seeded"), which matched anywhere inside the id. The
  // test-fixture kernel range is a determinism boundary: a production stream
  // admitted into it collides with fixture streams and stops meaning what its
  // identity says.

  it("every test-fixture id the corpus actually uses is still admitted", () => {
    // Real ids, read off the corpus rather than invented. "src-testing..."
    // is why the marker set carries "testing" as well as "test": an exact set
    // without it would have refused a genuine registration, which is how a
    // substring-to-equality tightening breaks a gate.
    // Same markers in the same segment positions as the four real ids, with a
    // version suffix that does not collide: three of the four are already in
    // the shared registry, and re-registering them throws "already registered"
    // before the guard under test is reached.
    for (const allocationId of [
      "exercise.property-test.v9",
      "runtime-fixture.v9",
      "src-testing.exercise-mock.v9",
      "statistical-policy.seeded.v9",
    ]) {
      const registry = new StreamAllocationRegistry();
      expect(() => registry.registerAllocation(fixtureRecord(allocationId))).not.toThrow();
    }
  });

  it("an id that merely contains the letters is refused", () => {
    // "latest" contains "test"; so do contest, protest and attestation.
    for (const allocationId of [
      "bm-01.latest.v1",
      "latest-ensemble.v1",
      "contest.run.v1",
      "bm-07.attestation.v1",
    ]) {
      const registry = new StreamAllocationRegistry();
      expect(() => registry.registerAllocation(fixtureRecord(allocationId))).toThrow(
        /cannot register in test-fixture block/,
      );
    }
  });

  it("callerIsTest still admits a fixture registration whatever the id says", () => {
    // The authoritative signal is untouched: a caller in src/testing registers
    // in the fixture block even with an id carrying no marker at all.
    const registry = new StreamAllocationRegistry();
    expect(() =>
      registry.registerAllocation(fixtureRecord("bm-01.latest.v1"), { callerIsTest: true }),
    ).not.toThrow();
  });
});
