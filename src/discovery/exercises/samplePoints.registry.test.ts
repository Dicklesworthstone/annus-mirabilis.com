import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  createStreamKey,
  PRODUCTION_RANGE,
  streamAllocationRegistry,
} from "../../experiments/streams/allocation.ts";
import { createPhiloxStream } from "../../physics/reference/philox.ts";
import { deriveExerciseSeed } from "./answer.ts";
import {
  EXERCISE_ALLOCATION_ID,
  EXERCISE_STREAM,
  mapUnitToDomain,
  philoxPoints,
} from "./samplePoints.ts";

/**
 * am-disc-exercise-checker-i4h2: "Each part draws 16 Halton points and 8 Philox points derived from
 * the SHA-256 of <exerciseId>/<partIndex>, with the registered exercise stream kernel id; two runs of
 * the same exercise produce identical point sets, and two different exercises produce different
 * ones." The Halton half is samplePoints.test.ts's. This file holds the Philox half: the kernel is
 * the registry's, the seed is the SHA-256 the criterion names, and the points follow from both.
 */

const DOMAINS = { D: { min: 1e-14, max: 1e-10, scale: "log" as const }, t: { min: 0.1, max: 100 } };

describe("the registered exercise stream", () => {
  test("the sampler's kernel is the registry's exercise allocation, in the production range", () => {
    const allocation = streamAllocationRegistry.getAllocation(EXERCISE_ALLOCATION_ID);
    expect(EXERCISE_STREAM.kernel).toBe(allocation.streamKernelId);
    expect(EXERCISE_STREAM.kernel).toBeGreaterThanOrEqual(PRODUCTION_RANGE.start);
    expect(EXERCISE_STREAM.kernel).toBeLessThanOrEqual(PRODUCTION_RANGE.end);
    // The kernel it drew from until 2026-09-24, outside every registered range.
    expect(EXERCISE_STREAM.kernel).not.toBe(0x45585243);
  });

  test("the points are the registered streams' own draws, one stream per variable", () => {
    // Rebuilt here from the registry's key, not from the sampler's constant, so a sampler that
    // exported the registered kernel but drew from another would fail.
    const seed = "20260924";
    const names = Object.keys(DOMAINS).sort();
    const streams = names.map((_, variable) => {
      const key = createStreamKey(EXERCISE_ALLOCATION_ID, seed, variable);
      return createPhiloxStream({ seed: key.seed, kernel: key.kernel, tile: key.tile });
    });
    const points = philoxPoints(DOMAINS, 8, seed);
    for (const point of points)
      names.forEach((name, j) => {
        const u = streams[j]?.nextF64() ?? Number.NaN;
        expect(point[name]).toBe(mapUnitToDomain(u, DOMAINS[name as keyof typeof DOMAINS]));
      });
  });

  test("more points than the allocation's draws per stream are refused, not drawn", () => {
    expect(philoxPoints(DOMAINS, EXERCISE_STREAM.maxDraws, "1")).toHaveLength(
      EXERCISE_STREAM.maxDraws,
    );
    expect(() => philoxPoints(DOMAINS, EXERCISE_STREAM.maxDraws + 1, "1")).toThrow(RangeError);
  });
});

describe("the seed is the SHA-256 of the exercise's identity", () => {
  test("the first eight bytes of the digest, big endian, as a decimal u64", async () => {
    const identity = "bm-displacement-scale-rewrite/0";
    const independent = createHash("sha256")
      .update(identity)
      .digest()
      .readBigUInt64BE(0)
      .toString();
    expect(await deriveExerciseSeed(identity)).toBe(independent);
  });

  test("the same exercise draws the same points twice; two exercises draw different ones", async () => {
    const a = await deriveExerciseSeed("bm-displacement-scale-rewrite/0");
    const again = await deriveExerciseSeed("bm-displacement-scale-rewrite/0");
    const b = await deriveExerciseSeed("sr-moving-clock-reading/0");
    expect(again).toBe(a);
    expect(b).not.toBe(a);
    expect(philoxPoints(DOMAINS, 8, again)).toEqual(philoxPoints(DOMAINS, 8, a));
    expect(philoxPoints(DOMAINS, 8, b)).not.toEqual(philoxPoints(DOMAINS, 8, a));
  });
});
