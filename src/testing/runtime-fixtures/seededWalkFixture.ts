/**
 * Seeded random walk runtime fixture (am-rt-command-classes-dzp).
 *
 * "a small ensemble on a replay grid with a latent stream and a separate localization-noise
 * stream... A draw accessor counts draws per stream... changing exposure and localization
 * error on the seeded walk leaves latentPathDigest identical and advances only the noise
 * stream counter by the declared number of draws."
 */

import type { ReplayGrid } from "../../experiments/commands/replayGrid.ts";
import {
  latentPathDigest,
  observationDataDigest,
} from "../../experiments/digest/scientificDigest.ts";

export const FIXTURE_REPLAY_GRID: ReplayGrid = Object.freeze({
  baseSpacingSeconds: 0.1,
  storedHorizonSeconds: 10.0,
});

export type WalkSample = Readonly<{
  t: number;
  trueX: number;
  observedX: number;
}>;

export type SeededWalkState = Readonly<{
  grid: ReplayGrid;
  observationIntervalSeconds: number;
  exposureTimeSeconds: number;
  localizationError: number;
  latentSamples: readonly { t: number; trueX: number }[];
  observedSamples: readonly WalkSample[];
  latentPathDigest: string;
  observationDataDigest: string;
  drawCounters: Readonly<{
    latent: number;
    noise: number;
  }>;
}>;

/**
 * Deterministic pseudo-random sequence for fixture testing.
 */
function deterministicPRNG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Pre-generates the latent path on the base replay grid.
 */
export function generateBaseLatentPath(
  grid: ReplayGrid = FIXTURE_REPLAY_GRID,
  seed = 42,
): { t: number; trueX: number }[] {
  const steps = Math.round(grid.storedHorizonSeconds / grid.baseSpacingSeconds);
  const rng = deterministicPRNG(seed);
  const path: { t: number; trueX: number }[] = [];
  let currentX = 0.0;

  for (let i = 0; i <= steps; i++) {
    const t = Math.round(i * grid.baseSpacingSeconds * 1000) / 1000;
    if (i > 0) {
      const u1 = rng();
      const u2 = rng();
      // Box-Muller standard normal step
      const z = Math.sqrt(-2.0 * Math.log(u1 || 1e-10)) * Math.cos(2.0 * Math.PI * u2);
      const step = z * Math.sqrt(grid.baseSpacingSeconds);
      currentX += step;
    }
    path.push({ t, trueX: currentX });
  }

  return path;
}

/**
 * Creates or observes the seeded walk fixture with specific measurement settings.
 */
export async function createSeededWalkFixture(options: {
  observationIntervalSeconds: number;
  exposureTimeSeconds: number;
  localizationError: number;
  baseLatentPath?: readonly { t: number; trueX: number }[];
  noiseSeed?: number;
}): Promise<SeededWalkState> {
  const grid = FIXTURE_REPLAY_GRID;
  const latentPath = options.baseLatentPath ?? generateBaseLatentPath(grid);
  const noiseRng = deterministicPRNG(options.noiseSeed ?? 1337);

  const stepMultiple = Math.max(
    1,
    Math.round(options.observationIntervalSeconds / grid.baseSpacingSeconds),
  );

  const observedSamples: WalkSample[] = [];
  let noiseDrawCount = 0;

  for (let i = 0; i < latentPath.length; i += stepMultiple) {
    const point = latentPath[i];
    if (!point) continue;
    // Measurement noise draw
    const u1 = noiseRng();

    const u2 = noiseRng();
    noiseDrawCount += 2;
    const z = Math.sqrt(-2.0 * Math.log(u1 || 1e-10)) * Math.cos(2.0 * Math.PI * u2);
    const noise = z * options.localizationError;

    // Optional exposure-time blurring factor
    const exposureBlur = options.exposureTimeSeconds * 0.01;

    observedSamples.push({
      t: point.t,
      trueX: point.trueX,
      observedX: point.trueX + noise + exposureBlur,
    });
  }

  // Digest over the latent path (independent of observation settings)
  const latentDigestRes = await latentPathDigest({
    gridSpacing: grid.baseSpacingSeconds,
    horizon: grid.storedHorizonSeconds,
    samples: latentPath.map((p) => ({ t: p.t, x: p.trueX })),
  });

  // Digest over the observed data
  const obsDigestRes = await observationDataDigest({
    interval: options.observationIntervalSeconds,
    exposure: options.exposureTimeSeconds,
    localizationError: options.localizationError,
    data: observedSamples.map((s) => ({ t: s.t, x: s.observedX })),
  });

  return Object.freeze({
    grid,
    observationIntervalSeconds: options.observationIntervalSeconds,
    exposureTimeSeconds: options.exposureTimeSeconds,
    localizationError: options.localizationError,
    latentSamples: Object.freeze(latentPath),
    observedSamples: Object.freeze(observedSamples),
    latentPathDigest: latentDigestRes.digest,
    observationDataDigest: obsDigestRes.digest,
    drawCounters: Object.freeze({
      latent: latentPath.length * 2,
      noise: noiseDrawCount,
    }),
  });
}
