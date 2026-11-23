/**
 * Exact path counts for a bounded teaching walk. These are all possible fair-coin paths,
 * not a sampled Brownian trajectory or empirical observations. Grouping by the number of
 * rightward steps takes O(n) rows instead of materializing 2^n paths. Integer counts and
 * moment numerators remain exact even when the number of paths exceeds 2^53.
 */
export const MAX_COUNTED_STEPS = 64;
export type CountedWalkRule = "independent" | "same-direction";

export type CountedWalkOutcome = Readonly<{
  displacement: number;
  paths: string;
  probability: number;
}>;

export type CountedWalk = Readonly<{
  steps: number;
  rule: CountedWalkRule;
  totalPaths: string;
  outcomes: readonly CountedWalkOutcome[];
  mean: number;
  meanSquare: number;
  rms: number;
  meanDistance: number;
  returnProbability: number;
  allOneWayProbability: number;
}>;

export type CountedWalkResult =
  | Readonly<{ kind: "accepted"; walk: CountedWalk }>
  | Readonly<{ kind: "refused"; message: string }>;

function buildCountedWalk(steps: number, rule: CountedWalkRule): CountedWalk {
  const counts: { displacement: number; paths: bigint }[] = [];
  if (steps === 0) {
    counts.push({ displacement: 0, paths: 1n });
  } else if (rule === "same-direction") {
    counts.push({ displacement: -steps, paths: 1n }, { displacement: steps, paths: 1n });
  } else {
    let paths = 1n;
    for (let right = 0; right <= steps; right += 1) {
      counts.push({ displacement: 2 * right - steps, paths });
      if (right < steps) paths = (paths * BigInt(steps - right)) / BigInt(right + 1);
    }
  }
  const total = counts.reduce((sum, row) => sum + row.paths, 0n);
  const denominator = Number(total);
  const moment = (value: (displacement: number) => number) =>
    Number(counts.reduce((sum, row) => sum + row.paths * BigInt(value(row.displacement)), 0n)) /
    denominator;
  const meanSquare = moment((displacement) => displacement * displacement);
  return Object.freeze({
    steps,
    rule,
    totalPaths: total.toString(),
    outcomes: Object.freeze(
      counts.map((row) =>
        Object.freeze({
          displacement: row.displacement,
          paths: row.paths.toString(),
          probability: Number(row.paths) / denominator,
        }),
      ),
    ),
    mean: moment((displacement) => displacement),
    meanSquare,
    rms: Math.sqrt(meanSquare),
    meanDistance: moment(Math.abs),
    returnProbability:
      Number(counts.find((row) => row.displacement === 0)?.paths ?? 0n) / denominator,
    // With no steps there is no direction to compare; all probability is at the start.
    allOneWayProbability:
      steps === 0
        ? 0
        : Number(
            counts
              .filter((row) => Math.abs(row.displacement) === steps)
              .reduce((sum, row) => sum + row.paths, 0n),
          ) / denominator,
  });
}

export function countFairWalks(steps: number, rule: CountedWalkRule): CountedWalkResult {
  if (!Number.isInteger(steps) || steps < 0 || steps > MAX_COUNTED_STEPS)
    return {
      kind: "refused",
      message: "Choose a whole number of steps from 0 to " + MAX_COUNTED_STEPS + ".",
    };
  if (rule !== "independent" && rule !== "same-direction")
    return { kind: "refused", message: "Choose a fresh coin for each step or repeat the first." };
  return { kind: "accepted", walk: buildCountedWalk(steps, rule) };
}

/** Reject malformed drafts before allocating outcomes; the caller retains its accepted walk. */
export function readCountedWalk(text: string, rule: CountedWalkRule): CountedWalkResult {
  const trimmed = text.trim();
  if (trimmed.length > 16 || !/^\d+$/.test(trimmed))
    return {
      kind: "refused",
      message: "Enter a whole number of steps from 0 to " + MAX_COUNTED_STEPS + ", such as 2 or 16.",
    };
  return countFairWalks(Number(trimmed), rule);
}

/** The numerical owner supplies the complete two-step example in the first server render. */
export const INITIAL_COUNTED_WALK = buildCountedWalk(2, "independent");
