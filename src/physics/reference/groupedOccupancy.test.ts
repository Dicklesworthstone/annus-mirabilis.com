import { expect, test } from "bun:test";
import {
  compareOccupancyEvidence,
  compareOccupancyModels,
  OCCUPANCY_CHECKS,
} from "./configurationCountermodels.ts";
import { compareGroupedOccupancy } from "./groupedOccupancy.ts";

test("group predictions agree with exhaustive independent placements into four cells", () => {
  for (let n = 1; n <= 6; n++) {
    for (let quarters = 0; quarters <= 4; quarters++) {
      const settings = { n, quarters };
      const candidates = compareGroupedOccupancy(settings, ["mean-count"]);
      for (const group of candidates) {
        const frequencies = Array<number>(n + 1).fill(0);
        const placements = 4 ** group.groups.length;
        for (let trial = 0; trial < placements; trial++) {
          let cell = trial;
          let count = 0;
          for (const size of group.groups) {
            if (cell % 4 < quarters) count += size;
            cell = Math.floor(cell / 4);
          }
          frequencies[count] = (frequencies[count] ?? 0) + 1;
        }
        expect(group.probabilities).toEqual(frequencies.map((frequency) => frequency / placements));
        expect(group.matchesIndependent).toBe(true);
        const mean = frequencies.reduce(
          (sum, frequency, k) => sum + (k * frequency) / placements,
          0,
        );
        const variance = frequencies.reduce(
          (sum, frequency, k) => sum + ((k - mean) ** 2 * frequency) / placements,
          0,
        );
        expect(group.statistics["count-variance"]).toBe(variance);
        expect(group.statistics["all-inside"]).toBe(group.probabilities[n] as number);
      }
      const extremes = compareOccupancyModels(settings);
      expect(candidates[0]?.probabilities).toEqual(extremes.locked.probabilities);
      expect(candidates.at(-1)?.probabilities).toEqual(extremes.independent.probabilities);
    }
  }
});

test("checks distinguish a predicted statistic, while observations constrain the whole count law", () => {
  const settings = { n: 4, quarters: 2 };
  const candidates = compareGroupedOccupancy(settings, ["all-inside"], [1, 0, 2, 0, 1]);
  expect(candidates).toHaveLength(5);
  const pairs = candidates.find((item) => item.groups.join() === "2,2");
  expect(pairs?.probabilities).toEqual([0.25, 0, 0.5, 0, 0.25]);
  expect(pairs?.relativeLogLikelihood).toBe(0);
  expect(candidates.filter((item) => item.matchesIndependent)).toHaveLength(1);
  expect(candidates[0]?.impossibleCounts).toEqual([2]);
  expect(candidates.at(-1)?.relativeLogLikelihood).toBeLessThan(0);
  const counts = [8, 0, 0, 0, 8];
  const previous = compareOccupancyEvidence(settings, counts);
  const extended = compareGroupedOccupancy(settings, [], counts);
  expect(
    (extended.at(-1)?.relativeLogLikelihood ?? NaN) - (extended[0]?.relativeLogLikelihood ?? NaN),
  ).toBeCloseTo(previous.logLikelihoodRatio as number, 12);
});

test("degenerate regions, incompatible records and the published bounds are explicit", () => {
  const candidates = compareGroupedOccupancy({ n: 12, quarters: 0 }, OCCUPANCY_CHECKS);
  expect(candidates).toHaveLength(77);
  expect(new Set(candidates.map((item) => item.groups.join())).size).toBe(77);
  expect(
    candidates.every((item) => item.matchesIndependent && item.relativeLogLikelihood === null),
  ).toBe(true);
  const impossible = compareGroupedOccupancy({ n: 2, quarters: 4 }, [], [1, 0, 0]);
  expect(
    impossible.every(
      (item) => item.relativeLogLikelihood === null && item.impossibleCounts.includes(0),
    ),
  ).toBe(true);
  expect(() => compareGroupedOccupancy({ n: 13, quarters: 2 }, [])).toThrow();
  expect(() => compareGroupedOccupancy({ n: 2, quarters: 1 }, [], [0, 0, 0])).toThrow();
});
