import { describe, expect, test } from "bun:test";
import { enumerateSignedSteps } from "./stepEnumeration.ts";
import {
  type CountedWalk,
  type CountedWalkRule,
  countFairWalks,
  INITIAL_COUNTED_WALK,
  MAX_COUNTED_STEPS,
  readCountedWalk,
} from "./randomWalkCounts.ts";

function accepted(steps: number, rule: CountedWalkRule = "independent"): CountedWalk {
  const result = countFairWalks(steps, rule);
  expect(result.kind).toBe("accepted");
  if (result.kind !== "accepted") throw new Error(result.message);
  return result.walk;
}

describe("exact random-walk counts without enumerating exponentially many paths", () => {
  test("the four initial paths have three ends with unequal chances", () => {
    const walk = accepted(2);
    expect(walk).toEqual(INITIAL_COUNTED_WALK);
    expect(walk.outcomes).toEqual([
      { displacement: -2, paths: "1", probability: 0.25 },
      { displacement: 0, paths: "2", probability: 0.5 },
      { displacement: 2, paths: "1", probability: 0.25 },
    ]);
    expect(walk.mean).toBe(0);
    expect(walk.meanSquare).toBe(2);
    expect(walk.meanDistance).toBe(1);
    expect(walk.rms).toBe(Math.SQRT2);
  });

  test("every admitted distribution matches an independent integer convolution", () => {
    let coefficients = [1n];
    for (let steps = 0; steps <= MAX_COUNTED_STEPS; steps += 1) {
      const walk = accepted(steps);
      expect(walk.outcomes.map((row) => BigInt(row.paths))).toEqual(coefficients);
      expect(BigInt(walk.totalPaths)).toBe(1n << BigInt(steps));
      expect(walk.outcomes.length).toBe(steps + 1);
      expect(walk.mean).toBe(0);
      expect(walk.meanSquare).toBe(steps);
      expect(walk.rms).toBe(Math.sqrt(steps));
      expect(walk.outcomes.reduce((sum, row) => sum + row.probability, 0)).toBeCloseTo(1, 14);
      expect(walk.returnProbability > 0).toBe(steps % 2 === 0);
      expect(walk.outcomes.map((row) => row.paths)).toEqual(
        [...walk.outcomes].reverse().map((row) => row.paths),
      );
      coefficients = Array.from(
        { length: coefficients.length + 1 },
        (_, index) => (coefficients[index - 1] ?? 0n) + (coefficients[index] ?? 0n),
      );
    }
    const largest = accepted(MAX_COUNTED_STEPS);
    expect(largest.totalPaths).toBe("18446744073709551616");
    expect(BigInt(largest.outcomes[32]?.paths ?? "0")).toBeGreaterThan(
      BigInt(Number.MAX_SAFE_INTEGER),
    );
    expect(Object.isFrozen(largest)).toBe(true);
    expect(Object.isFrozen(largest.outcomes)).toBe(true);
    expect(largest.outcomes.every(Object.isFrozen)).toBe(true);
  });

  test("compact counts agree with the existing complete path enumerator", () => {
    for (let steps = 2; steps <= 8; steps += 1) {
      const reference = enumerateSignedSteps(steps);
      const walk = accepted(steps);
      for (const outcome of walk.outcomes) {
        const paths = reference.rows.filter((row) => row.displacement === outcome.displacement);
        expect(outcome.paths).toBe(String(paths.length));
        expect(outcome.probability).toBe(paths.length / reference.denominator);
      }
      expect(walk.mean).toBe(reference.mean);
      expect(walk.meanSquare).toBe(reference.meanSquare);
      expect(walk.meanDistance).toBe(reference.meanAbsolute);
    }
  });

  test("a fair first direction repeated does not have independent-step spread", () => {
    for (const steps of [1, 2, 8, 16, 64]) {
      const repeated = accepted(steps, "same-direction");
      expect(repeated.totalPaths).toBe("2");
      expect(repeated.outcomes).toEqual([
        { displacement: -steps, paths: "1", probability: 0.5 },
        { displacement: steps, paths: "1", probability: 0.5 },
      ]);
      expect(repeated.mean).toBe(0);
      expect(repeated.meanSquare).toBe(steps * steps);
      expect(repeated.rms).toBe(steps);
      expect(repeated.meanDistance).toBe(steps);
      expect(repeated.returnProbability).toBe(0);
      expect(repeated.allOneWayProbability).toBe(1);
    }
    expect(accepted(8).rms / accepted(2).rms).toBe(2);
    expect(accepted(8, "same-direction").rms / accepted(2, "same-direction").rms).toBe(4);
    expect(accepted(8).allOneWayProbability).toBe(2 / 256);
  });

  test("zero steps is one stationary path for either rule", () => {
    for (const rule of ["independent", "same-direction"] as const) {
      const walk = accepted(0, rule);
      expect(walk.totalPaths).toBe("1");
      expect(walk.outcomes).toEqual([{ displacement: 0, paths: "1", probability: 1 }]);
      expect(walk.mean).toBe(0);
      expect(walk.meanSquare).toBe(0);
      expect(walk.rms).toBe(0);
      expect(walk.returnProbability).toBe(1);
      expect(walk.allOneWayProbability).toBe(0);
    }
  });

  test("invalid counts, rules and drafts cannot allocate a distribution", () => {
    for (const steps of [NaN, Infinity, -Infinity, -1, 0.5, 65, 1e100])
      expect(countFairWalks(steps, "independent").kind).toBe("refused");
    expect(countFairWalks(4, "unknown" as CountedWalkRule).kind).toBe("refused");
    for (const text of ["", " ", "-1", "1.5", "1e2", "3junk", "0x10", "NaN", "1".repeat(17)])
      expect(readCountedWalk(text, "independent").kind, text).toBe("refused");
    for (const text of ["0", " 8 ", "0016", "64"])
      expect(readCountedWalk(text, "independent").kind, text).toBe("accepted");
  });
});
