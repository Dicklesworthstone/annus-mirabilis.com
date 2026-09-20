/**
 * Logical Stream Allocation Registry and StreamKey Management.
 * Specification: am-rt-u64-identities-7ce
 * Mirroring: docs/FRANKENSIM_BINDING.md §6 (decision c) and docs/STREAM_ALLOCATION.md
 *
 * Enforces:
 * - Production kernel range 0x19050000..0x19050fff
 * - Test-fixture kernel range 0x1905f000..0x1905ffff
 * - Rejection of unallocated gap 0x19051000..0x1905efff
 * - Distinct allocations for distinct draw patterns (no two allocations may share both kernel ID and tile formula)
 * - Index counts draws, not steps
 * - Branded StreamKey constructible only through this registry
 * - Tile formula injectivity and u32 boundary verification
 * - Typed expected-later allocations list
 */

import { toU64String, type U64, U64_MAX_BIGINT, type U64String } from "../identity/u64.ts";

declare const StreamKeyBrand: unique symbol;

/**
 * Branded stream key representation constructible only through this registry.
 */
export type StreamKey = Readonly<{
  seed: U64String;
  kernel: number;
  tile: number;
  allocationId: string;
  readonly [StreamKeyBrand]: true;
}>;

export type KernelBlock = "production" | "test-fixture";

export interface AllocationRecord {
  readonly allocationId: string;
  readonly streamKernelId: number;
  readonly streamVersion: number;
  readonly block: KernelBlock;
  readonly tileFormula: string;
  readonly indexRule: "draws";
  readonly description?: string;
  readonly consumers?: readonly string[];
  readonly computeTile: (...args: number[]) => number;
  readonly drawsPerStep?: number;
  readonly maxDrawsPerStream: bigint | number;
  readonly declaredLimits?: Record<string, number>;
}

export interface ExpectedLaterAllocation {
  readonly beadId: string;
  readonly modeId: string;
  readonly reason: string;
}

export const PRODUCTION_RANGE = Object.freeze({
  start: 0x19050000,
  end: 0x19050fff,
});

export const TEST_FIXTURE_RANGE = Object.freeze({
  start: 0x1905f000,
  end: 0x1905ffff,
});

export const UNALLOCATED_GAP = Object.freeze({
  start: 0x19051000,
  end: 0x1905efff,
});

export const U32_MAX = 4294967295;

/**
 * Typed list of expected later allocations mirroring docs/STREAM_ALLOCATION.md.
 */
export const expectedLaterAllocations: readonly ExpectedLaterAllocation[] = Object.freeze([
  {
    beadId: "am-later-deep-underdamped-ide4",
    modeId: "bm-01:underdamped",
    reason:
      "Samples an Ornstein–Uhlenbeck position-and-velocity pair per particle per coordinate with an exact discretization; draw pattern differs from bm-01.latent.v1 single Gaussian position step per axis.",
  },
]);

/**
 * Markers by which an allocation id declares itself a test fixture (am-o44v).
 *
 * Derived from the ids the corpus actually carries, not invented:
 * `exercise.property-test.v1`, `runtime-fixture.v1`,
 * `src-testing.exercise-mock.v1`, `statistical-policy.seeded.v1`. "testing" is
 * in the set because one of those four inflects it that way; leaving it out
 * would have refused a genuine registration, which is the failure mode of
 * tightening a substring test into an exact one without checking the real
 * input shapes.
 */
const TEST_FIXTURE_MARKERS: ReadonlySet<string> = new Set([
  "test",
  "testing",
  "fixture",
  "seeded",
]);

/**
 * Whether an allocation id declares the test-fixture block, by SEGMENT.
 *
 * This replaced `id.includes("test") || id.includes("fixture") ||
 * id.includes("seeded")`. Those matched anywhere inside the id, so an
 * allocation whose id merely contained the letters - "latest" contains "test" -
 * was admitted into the reserved test-fixture kernel-ID range. That range is a
 * determinism boundary: a production stream registered inside it collides with
 * fixture streams and stops meaning what its identity says.
 *
 * `options.callerIsTest` remains the authoritative signal and is still checked
 * first; this only decides whether an id DECLARES the block.
 */
function declaresTestFixture(allocationId: string): boolean {
  return allocationId
    .toLowerCase()
    .split(/[.\-_]/)
    .some((segment) => TEST_FIXTURE_MARKERS.has(segment));
}

export class StreamAllocationRegistry {
  private readonly allocations = new Map<string, AllocationRecord>();

  constructor() {
    this.registerBuiltins();
  }

  /**
   * Registers a new stream allocation with strict boundary, collision, and range checks.
   */
  registerAllocation(record: AllocationRecord, options?: { callerIsTest?: boolean }): void {
    if (this.allocations.has(record.allocationId)) {
      throw new Error(`Allocation "${record.allocationId}" is already registered.`);
    }

    const { streamKernelId, block } = record;

    // Range checks
    if (block === "production") {
      if (streamKernelId < PRODUCTION_RANGE.start || streamKernelId > PRODUCTION_RANGE.end) {
        throw new Error(
          `Production allocation "${record.allocationId}" must use kernel ID in production range [0x${PRODUCTION_RANGE.start.toString(16)}, 0x${PRODUCTION_RANGE.end.toString(16)}], received 0x${streamKernelId.toString(16)}.`,
        );
      }
      if (options?.callerIsTest) {
        throw new Error(
          `Test allocation in src/testing/ cannot register with production stream kernel ID 0x${streamKernelId.toString(16)} (allocation "${record.allocationId}"). Must use reserved test-fixture block.`,
        );
      }
    } else if (block === "test-fixture") {
      if (streamKernelId < TEST_FIXTURE_RANGE.start || streamKernelId > TEST_FIXTURE_RANGE.end) {
        throw new Error(
          `Test-fixture allocation "${record.allocationId}" must use kernel ID in test-fixture range [0x${TEST_FIXTURE_RANGE.start.toString(16)}, 0x${TEST_FIXTURE_RANGE.end.toString(16)}], received 0x${streamKernelId.toString(16)}.`,
        );
      }
      if (!options?.callerIsTest && !declaresTestFixture(record.allocationId)) {
        throw new Error(
          `Production allocation "${record.allocationId}" cannot register in test-fixture block with kernel ID 0x${streamKernelId.toString(16)}.`,
        );
      }
    } else {
      throw new Error(`Unknown block "${block}" for allocation "${record.allocationId}".`);
    }

    // Gap check
    if (streamKernelId >= UNALLOCATED_GAP.start && streamKernelId <= UNALLOCATED_GAP.end) {
      throw new Error(
        `Kernel ID 0x${streamKernelId.toString(16)} lies in unallocated gap [0x${UNALLOCATED_GAP.start.toString(16)}, 0x${UNALLOCATED_GAP.end.toString(16)}].`,
      );
    }

    // Collision check: No two allocations may share both streamKernelId and tileFormula
    for (const existing of this.allocations.values()) {
      if (
        existing.streamKernelId === record.streamKernelId &&
        existing.tileFormula === record.tileFormula
      ) {
        throw new Error(
          `Allocation collision: "${record.allocationId}" and "${existing.allocationId}" share both streamKernelId 0x${record.streamKernelId.toString(16)} and tileFormula "${record.tileFormula}". Distinct draw patterns must use distinct tile formulas.`,
        );
      }
    }

    // Max draw check
    if (BigInt(record.maxDrawsPerStream) >= U64_MAX_BIGINT) {
      throw new Error(
        `Allocation "${record.allocationId}" declared maximum draws (${record.maxDrawsPerStream}) could wrap at 2^64.`,
      );
    }

    this.allocations.set(record.allocationId, Object.freeze(record));
  }

  getAllocation(allocationId: string): AllocationRecord {
    const record = this.allocations.get(allocationId);
    if (!record) {
      throw new Error(`Stream allocation "${allocationId}" is not registered.`);
    }
    return record;
  }

  hasAllocation(allocationId: string): boolean {
    return this.allocations.has(allocationId);
  }

  listAllocations(): readonly AllocationRecord[] {
    return Array.from(this.allocations.values());
  }

  /**
   * Constructs a validated, branded StreamKey for the given registered allocation and seed.
   */
  createStreamKey(
    allocationId: string,
    seed: string | bigint | U64 | U64String,
    ...tileArgs: number[]
  ): StreamKey {
    const record = this.getAllocation(allocationId);
    const canonicalSeed = toU64String(seed);

    const tile = record.computeTile(...tileArgs);
    if (!Number.isInteger(tile) || tile < 0 || tile > U32_MAX) {
      throw new RangeError(
        `Computed tile ${tile} for allocation "${allocationId}" is outside valid u32 range [0, ${U32_MAX}].`,
      );
    }

    return Object.freeze({
      seed: canonicalSeed,
      kernel: record.streamKernelId,
      tile,
      allocationId: record.allocationId,
    }) as unknown as StreamKey;
  }

  private registerBuiltins(): void {
    // 0x19050001: brownian-latent
    this.registerAllocation({
      allocationId: "bm-01.latent.v1",
      streamKernelId: 0x19050001,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=3*i+axis",
      indexRule: "draws",
      drawsPerStep: 2,
      maxDrawsPerStream: 20000000,
      declaredLimits: { maximumTracers: 10000, axes: 3 },
      computeTile: (i: number, axis: number) => {
        if (
          !Number.isInteger(i) ||
          i < 0 ||
          i >= 10000 ||
          !Number.isInteger(axis) ||
          axis < 0 ||
          axis >= 3
        ) {
          throw new RangeError("Tracer or axis lies outside registered allocation limits.");
        }
        return 3 * i + axis;
      },
    });

    this.registerAllocation({
      allocationId: "bm-05.walk.v1",
      streamKernelId: 0x19050001,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=j",
      indexRule: "draws",
      drawsPerStep: 2,
      maxDrawsPerStream: 20000,
      declaredLimits: { maximumWalkers: 10000, maximumSteps: 10000 },
      computeTile: (j: number) => {
        if (!Number.isInteger(j) || j < 0 || j >= 10000) {
          throw new RangeError("Walker lies outside registered allocation limits.");
        }
        return j;
      },
    });

    this.registerAllocation({
      allocationId: "bm-08.latent.v1",
      streamKernelId: 0x19050001,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=(i<<2)|channel",
      indexRule: "draws",
      drawsPerStep: 4,
      maxDrawsPerStream: 20000000,
      declaredLimits: { maximumTracers: 10000, channels: 4 },
      computeTile: (i: number, channel: number) => {
        if (
          !Number.isInteger(i) ||
          i < 0 ||
          i >= 10000 ||
          !Number.isInteger(channel) ||
          channel < 0 ||
          channel >= 4
        ) {
          throw new RangeError("Tracer or channel lies outside registered allocation limits.");
        }
        return (i << 2) | channel;
      },
    });

    // 0x19050002: brownian-localization-noise
    this.registerAllocation({
      allocationId: "bm-08.localization.v1",
      streamKernelId: 0x19050002,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=particle",
      indexRule: "draws",
      drawsPerStep: 2,
      maxDrawsPerStream: 20000000,
      declaredLimits: { maximumParticles: 10000 },
      computeTile: (particle: number) => {
        if (!Number.isInteger(particle) || particle < 0 || particle >= 10000) {
          throw new RangeError("Particle index lies outside registered allocation limits.");
        }
        return particle;
      },
    });

    // 0x19050003: synthetic-inference-latent
    this.registerAllocation({
      allocationId: "bm-07.synthetic-latent.v1",
      streamKernelId: 0x19050003,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=(p<<16)|s",
      indexRule: "draws",
      drawsPerStep: 2,
      maxDrawsPerStream: 20000000,
      declaredLimits: { maxParticles: 65536, maxSubsteps: 65536 },
      computeTile: (p: number, s: number) => {
        if (
          !Number.isInteger(p) ||
          p < 0 ||
          p >= 65536 ||
          !Number.isInteger(s) ||
          s < 0 ||
          s >= 65536
        ) {
          throw new RangeError("Particle or substep index lies outside registered limits.");
        }
        return (p << 16) | s;
      },
    });

    // 0x19050004: synthetic-inference-noise
    this.registerAllocation({
      allocationId: "bm-07.synthetic-noise.v1",
      streamKernelId: 0x19050004,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=(p<<16)|s",
      indexRule: "draws",
      drawsPerStep: 2,
      maxDrawsPerStream: 20000000,
      declaredLimits: { maxParticles: 65536, maxSubsteps: 65536 },
      computeTile: (p: number, s: number) => {
        if (
          !Number.isInteger(p) ||
          p < 0 ||
          p >= 65536 ||
          !Number.isInteger(s) ||
          s < 0 ||
          s >= 65536
        ) {
          throw new RangeError("Particle or substep index lies outside registered limits.");
        }
        return (p << 16) | s;
      },
    });

    // 0x19050005: lq-05-configuration
    this.registerAllocation({
      allocationId: "lq-05.configuration.v1",
      streamKernelId: 0x19050005,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=trial",
      indexRule: "draws",
      maxDrawsPerStream: 1000000,
      declaredLimits: { maxTrials: 1000000 },
      computeTile: (trial: number) => {
        if (!Number.isInteger(trial) || trial < 0 || trial >= 1000000) {
          throw new RangeError("Trial index lies outside registered limits.");
        }
        return trial;
      },
    });

    this.registerAllocation({
      allocationId: "lq-05.locked.v1",
      streamKernelId: 0x19050005,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=trial|0x80000000",
      indexRule: "draws",
      maxDrawsPerStream: 1000000,
      declaredLimits: { maxTrials: 1000000 },
      computeTile: (trial: number) => {
        if (!Number.isInteger(trial) || trial < 0 || trial >= 1000000) {
          throw new RangeError("Trial index lies outside registered limits.");
        }
        return (trial | 0x80000000) >>> 0;
      },
    });

    // 0x19050006: exercise-sample-points
    this.registerAllocation({
      allocationId: "exercise.sample-points.v1",
      streamKernelId: 0x19050006,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=v",
      indexRule: "draws",
      drawsPerStep: 1,
      maxDrawsPerStream: 64,
      declaredLimits: { maxVariables: 256, maxDrawsPerStream: 64 },
      computeTile: (v: number) => {
        if (!Number.isInteger(v) || v < 0 || v >= 256) {
          throw new RangeError("Variable index v must be in 0..255 for exercise.sample-points.v1");
        }
        return v;
      },
    });

    // 0x19050007: synthetic-inference-generator-parameter
    this.registerAllocation({
      allocationId: "bm-07.generator-parameter.v1",
      streamKernelId: 0x19050007,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=0",
      indexRule: "draws",
      maxDrawsPerStream: 10,
      computeTile: () => 0,
    });

    // 0x19050008: brownian-stationary-feature
    this.registerAllocation({
      allocationId: "bm-08.stationary-feature.v1",
      streamKernelId: 0x19050008,
      streamVersion: 1,
      block: "production",
      tileFormula: "tile=clickIndex",
      indexRule: "draws",
      drawsPerStep: 2,
      maxDrawsPerStream: 100000,
      declaredLimits: { maximumClicks: 10000 },
      computeTile: (clickIndex: number) => {
        if (!Number.isInteger(clickIndex) || clickIndex < 0 || clickIndex >= 10000) {
          throw new RangeError("Click index lies outside registered limits.");
        }
        return clickIndex;
      },
    });

    // Test-fixture block allocations
    // 0x1905f000: statistical-policy-seeded
    this.registerAllocation({
      allocationId: "statistical-policy.seeded.v1",
      streamKernelId: 0x1905f000,
      streamVersion: 1,
      block: "test-fixture",
      tileFormula: "tile=suiteSalt",
      indexRule: "draws",
      maxDrawsPerStream: 10000000,
      computeTile: (suiteSalt: number) => {
        if (!Number.isInteger(suiteSalt) || suiteSalt < 0 || suiteSalt > U32_MAX) {
          throw new RangeError("suiteSalt must be a valid u32 integer.");
        }
        return suiteSalt;
      },
    });

    // 0x1905f001: runtime-fixture
    this.registerAllocation({
      allocationId: "runtime-fixture.v1",
      streamKernelId: 0x1905f001,
      streamVersion: 1,
      block: "test-fixture",
      tileFormula: "tile=allocation-defined",
      indexRule: "draws",
      maxDrawsPerStream: 10000000,
      computeTile: (tile: number) => {
        if (!Number.isInteger(tile) || tile < 0 || tile > U32_MAX) {
          throw new RangeError("Tile must be a valid u32 integer.");
        }
        return tile;
      },
    });

    // 0x1905f002: exercise-property-test
    this.registerAllocation({
      allocationId: "exercise.property-test.v1",
      streamKernelId: 0x1905f002,
      streamVersion: 1,
      block: "test-fixture",
      tileFormula: "tile=v",
      indexRule: "draws",
      maxDrawsPerStream: 10000,
      declaredLimits: { maxVariables: 256 },
      computeTile: (v: number) => {
        if (!Number.isInteger(v) || v < 0 || v >= 256) {
          throw new RangeError("Variable index v must be in 0..255 for exercise.property-test.v1");
        }
        return v;
      },
    });
  }
}

/** Global stream allocation registry singleton. */
export const streamAllocationRegistry = new StreamAllocationRegistry();

/** Convenience constructor for validated StreamKey instances. */
export function createStreamKey(
  allocationId: string,
  seed: string | bigint | U64 | U64String,
  ...tileArgs: number[]
): StreamKey {
  return streamAllocationRegistry.createStreamKey(allocationId, seed, ...tileArgs);
}

// ---------------------------------------------------------------------------
// Backwards compatibility bindings for existing references
// ---------------------------------------------------------------------------

export const BM01_ALLOCATION = Object.freeze({
  allocationId: "bm-01.latent.v1",
  streamKernelId: 0x19050001,
  streamVersion: 1,
  axes: 3,
  drawsPerStep: 2,
  maximumTracers: 10000,
});

export function bm01Tile(tracer: number, axis: number): number {
  return streamAllocationRegistry.getAllocation("bm-01.latent.v1").computeTile(tracer, axis);
}

export const BM05_ALLOCATION = Object.freeze({
  allocationId: "bm-05.walk.v1",
  streamKernelId: 0x19050001,
  streamVersion: 1,
  maximumWalkers: 10000,
  maximumSteps: 10000,
});

export function bm05Tile(walker: number): number {
  return streamAllocationRegistry.getAllocation("bm-05.walk.v1").computeTile(walker);
}
