/**
 * The repeated-experiment view of the error-and-inference lesson (am-found-statistics-inference-pzqv):
 * many synthetic experiments, each estimating one known diffusion coefficient from q squared
 * displacements and forming the 95 per cent chi-square interval, so a reader can count how many
 * intervals cover the value the generator used.
 *
 * Synthetic by construction. It checks what the interval procedure promises; it is not evidence
 * about molecules. The draws come from the site's seeded Philox stream, on the same logical stream
 * and in the same order as empiricalCoverageFraction in src/physics/reference/inference.ts, so the
 * covered count here equals that function's fraction for the same seed and trial count, and
 * foundStatistics.repeated.test.tsx holds the two to it. Nothing here throws.
 */
import { chiSquareQuantile } from "../physics/reference/diffusion/statistics.ts";
import { createPhiloxStream, parseU64 } from "../physics/reference/philox.ts";

/** The generator's diffusion coefficient in μm²/s: the bead's synthetic worked value. */
export const TRUE_DIFFUSIVITY = 0.43;
/**
 * The first seed from 1905 whose first twenty q = 100 intervals include exactly one miss, which is
 * the typical case: nineteen of twenty is what 95 per cent coverage predicts. Seed 1905 itself gives
 * twenty of twenty, which is also possible but shows a reader nothing about what a miss looks like.
 * The draws are the stream's own; only the starting seed was chosen.
 */
export const DEFAULT_SEED = "1906";
export const COVERAGE = 0.95;
/** INFERENCE_STREAMS.latent, the stream empiricalCoverageFraction draws from. */
export const LATENT_KERNEL = 0x19050003;

export const TRIAL_CHOICES = [20, 100] as const;
export const DEGREES_CHOICES = [100, 10] as const;
/** How many intervals the view draws; the count always covers every trial. */
export const ROWS_DRAWN = 20;

export interface RepeatedInterval {
  readonly index: number;
  readonly estimate: number;
  readonly lower: number;
  readonly upper: number;
  readonly covers: boolean;
}

export type RepeatedOutcome =
  | {
      readonly status: "drawn";
      readonly seed: string;
      readonly q: number;
      readonly trials: number;
      readonly intervals: readonly RepeatedInterval[];
      readonly covered: number;
    }
  | { readonly status: "refused"; readonly message: string };

const refused = (message: string): RepeatedOutcome => ({ status: "refused", message });

/** Draws `trials` synthetic experiments of q squared displacements each, from `seed`. */
export function drawRepeatedIntervals(input: {
  readonly seed: string;
  readonly q: number;
  readonly trials: number;
}): RepeatedOutcome {
  const { seed, q, trials } = input;
  try {
    parseU64(seed);
  } catch {
    return refused("A seed is a whole number from 0 to 2⁶⁴ − 1, written in decimal.");
  }
  if (!Number.isSafeInteger(q) || q < 2 || q > 1000)
    return refused("The number of squared displacements must be a whole number from 2 to 1000.");
  if (!Number.isSafeInteger(trials) || trials < 1 || trials > 1000)
    return refused("The number of experiments must be a whole number from 1 to 1000.");

  const alpha = 1 - COVERAGE;
  const lo = chiSquareQuantile(q, alpha / 2);
  const hi = chiSquareQuantile(q, 1 - alpha / 2);
  if (lo.kind !== "accepted" || hi.kind !== "accepted")
    return refused("The chi-square points for this many displacements could not be computed.");

  const stream = createPhiloxStream({ seed, kernel: LATENT_KERNEL, tile: 0 });
  const intervals: RepeatedInterval[] = [];
  let covered = 0;
  for (let index = 0; index < trials; index++) {
    let sumSq = 0;
    for (let k = 0; k < q; k++) {
      const z = stream.nextNormal();
      sumSq += z * z;
    }
    // Each squared displacement is 2Dt z², so the estimate is D times the mean of z², and the
    // interval [q·D̂/χ²(0.975), q·D̂/χ²(0.025)] covers D exactly when the sum lies between the points.
    const covers = sumSq >= lo.data && sumSq <= hi.data;
    if (covers) covered += 1;
    intervals.push({
      index: index + 1,
      estimate: (TRUE_DIFFUSIVITY * sumSq) / q,
      lower: (TRUE_DIFFUSIVITY * sumSq) / hi.data,
      upper: (TRUE_DIFFUSIVITY * sumSq) / lo.data,
      covers,
    });
  }
  return { status: "drawn", seed, q, trials, intervals, covered };
}
