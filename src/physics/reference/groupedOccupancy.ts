import {
  compareOccupancyEvidence,
  compareOccupancyModels,
  distinguishOccupancy,
  type OccupancyCheck,
  type OccupancySettings,
} from "./configurationCountermodels.ts";

export type GroupedCandidate = Readonly<{
  groups: readonly number[];
  probabilities: readonly number[];
  statistics: Readonly<Record<OccupancyCheck, number>>;
  matchesIndependent: boolean;
  impossibleCounts: readonly number[];
  relativeLogLikelihood: number | null;
}>;

/** Unordered partitions: relabeling identical points does not create a new count law. */
function* partitions(remaining: number, maximum: number): Generator<number[]> {
  if (remaining === 0) {
    yield [];
    return;
  }
  for (let size = Math.min(remaining, maximum); size >= 1; size--) {
    for (const rest of partitions(remaining - size, size)) yield [size, ...rest];
  }
}

/** Coefficient of z^k in the product of ((1-f) + f z^size) over independent groups.
 * With at most twelve groups and f in quarters, these probabilities are binary-exact. */
function countLaw(groups: readonly number[], fraction: number) {
  let probabilities = [1];
  for (const size of groups) {
    const next = Array<number>(probabilities.length + size).fill(0);
    for (const [count, probability] of probabilities.entries()) {
      next[count] = (next[count] ?? 0) + probability * (1 - fraction);
      next[count + size] = (next[count + size] ?? 0) + probability * fraction;
    }
    probabilities = next;
  }
  return probabilities;
}

/** Fix n, f and the admitted histogram. Vary only which points are forced to coincide.
 * Every group draws its own uniform position independently on each repeat placement. */
export function compareGroupedOccupancy(
  input: OccupancySettings,
  checks: readonly OccupancyCheck[],
  rawCounts?: readonly number[],
) {
  distinguishOccupancy(input, checks);
  const { fraction, independent, settings } = compareOccupancyModels(input);
  const counts =
    rawCounts === undefined ? null : compareOccupancyEvidence(settings, rawCounts).counts;
  const candidates = Array.from(partitions(settings.n, settings.n), (groups) => {
    const probabilities = countLaw(groups, fraction);
    const statistics = {
      "one-point": fraction,
      "mean-count": settings.n * fraction,
      "all-inside": fraction ** groups.length,
      "count-variance":
        groups.reduce((sum, size) => sum + size ** 2, 0) * fraction * (1 - fraction),
    };
    const impossibleCounts: number[] = [];
    let logWeight = 0;
    for (const [k, count] of (counts ?? []).entries()) {
      if (count === 0) continue;
      const probability = probabilities[k] as number;
      if (probability === 0) impossibleCounts.push(k);
      else logWeight += count * Math.log(probability);
    }
    return {
      groups,
      probabilities,
      statistics,
      matchesIndependent: checks.every(
        (check) => statistics[check] === independent.statistics[check],
      ),
      impossibleCounts,
      // The multinomial coefficient is common to all candidates for this histogram.
      logWeight: counts && !impossibleCounts.length ? logWeight : null,
    };
  });
  const possibleWeights = candidates.flatMap(({ logWeight }) =>
    logWeight === null ? [] : [logWeight],
  );
  const maximum = possibleWeights.length ? Math.max(...possibleWeights) : null;
  return candidates.map(
    ({ logWeight, ...candidate }): GroupedCandidate => ({
      ...candidate,
      relativeLogLikelihood: logWeight !== null && maximum !== null ? logWeight - maximum : null,
    }),
  );
}
