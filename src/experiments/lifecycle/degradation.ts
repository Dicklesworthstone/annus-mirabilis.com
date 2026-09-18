/**
 * Annus Mirabilis: Performance Degradation Policy
 *
 * Implements AGENTS.md "Worker behavior, memory, and lifecycle":
 * - A depleted performance budget reduces visual detail (displayed particle count,
 *   resolution, rendering frequency) or pauses with an explanation.
 * - It NEVER changes a model's diffusivity, enlarges an integration step, changes
 *   the model, reduces the statistical sample behind an inference, or skips scientific time.
 * - Rendering a subset of particles never changes the ensemble used for results.
 */

import { createHash } from "node:crypto";

export interface PerformanceBudget {
  readonly targetFrameTimeMs: number; // e.g. 16.67ms (60fps) or 33.33ms (30fps)
  readonly measuredFrameTimeMs: number;
  readonly droppedFrames?: number;
}

export interface VisualDetailSettings {
  readonly requestedParticleCount: number;
  readonly displayedParticleCount: number;
  readonly renderDecimationRatio: number;
  readonly isPaused: boolean;
  readonly explanation?: string;
}

export interface EnsembleMoments {
  readonly sampleSize: number;
  readonly meanX: number;
  readonly meanSquaredX: number;
  readonly varianceX: number;
  readonly rmsX: number;
  readonly digest: string;
}

/**
 * Computes canonical ensemble moments strictly over the FULL statistical sample.
 * This function NEVER subsamples: all N particles must be included in scientific inference.
 */
export function computeFullEnsembleMoments(
  positions: Float64Array,
  dimensions = 3,
): EnsembleMoments {
  const count = Math.floor(positions.length / dimensions);
  if (count <= 0) {
    return {
      sampleSize: 0,
      meanX: 0,
      meanSquaredX: 0,
      varianceX: 0,
      rmsX: 0,
      digest: "empty-ensemble-e3b0c442",
    };
  }

  let sumX = 0;
  let sumSqX = 0;

  for (let i = 0; i < count; i++) {
    const x = positions[i * dimensions] ?? 0;
    sumX += x;
    sumSqX += x * x;
  }

  const meanX = sumX / count;
  const meanSquaredX = sumSqX / count;
  const varianceX = Math.max(0, meanSquaredX - meanX * meanX);
  const rmsX = Math.sqrt(meanSquaredX);

  // Mint bitwise-reproducible scientific digest of moments
  const digestInput = `n=${count}|mean=${meanX.toFixed(12)}|var=${varianceX.toFixed(12)}|rms=${rmsX.toFixed(12)}`;
  const digest = createHash("sha256").update(digestInput).digest("hex").slice(0, 16);

  return {
    sampleSize: count,
    meanX,
    meanSquaredX,
    varianceX,
    rmsX,
    digest,
  };
}

/**
 * Evaluates performance budget and adapts visual detail without compromising physics.
 */
export function evaluateVisualDetailPolicy(
  requestedParticleCount: number,
  budget: PerformanceBudget,
  minDisplayed = 50,
): VisualDetailSettings {
  const { targetFrameTimeMs, measuredFrameTimeMs } = budget;

  // Severe pressure: frame time > 4x target budget -> pause with explanation
  if (measuredFrameTimeMs >= targetFrameTimeMs * 4) {
    return {
      requestedParticleCount,
      displayedParticleCount: Math.min(requestedParticleCount, minDisplayed),
      renderDecimationRatio: requestedParticleCount / Math.min(requestedParticleCount, minDisplayed),
      isPaused: true,
      explanation: `Rendering paused: measured frame time (${measuredFrameTimeMs.toFixed(1)}ms) exceeds 4x budget (${targetFrameTimeMs.toFixed(1)}ms). Scientific state and tape are preserved.`,
    };
  }

  // Moderate pressure: frame time > target budget -> scale down displayed count
  if (measuredFrameTimeMs > targetFrameTimeMs) {
    const ratio = targetFrameTimeMs / measuredFrameTimeMs;
    const scaledCount = Math.max(
      minDisplayed,
      Math.min(requestedParticleCount, Math.floor(requestedParticleCount * ratio)),
    );
    return {
      requestedParticleCount,
      displayedParticleCount: scaledCount,
      renderDecimationRatio: requestedParticleCount / scaledCount,
      isPaused: false,
      explanation: `Visual detail degraded under budget: displaying ${scaledCount}/${requestedParticleCount} particles. Statistical ensemble and inference moments remain full size (${requestedParticleCount}).`,
    };
  }

  // Nominal performance: full visual detail
  return {
    requestedParticleCount,
    displayedParticleCount: requestedParticleCount,
    renderDecimationRatio: 1.0,
    isPaused: false,
  };
}

/**
 * Extracts a display-only slice of particle positions for rendering.
 * Does NOT alter the underlying physics buffer.
 */
export function extractDisplayParticleSlice(
  fullPositions: Float64Array,
  displayedCount: number,
  dimensions = 3,
): Float64Array {
  const availableCount = Math.floor(fullPositions.length / dimensions);
  const targetCount = Math.min(availableCount, Math.max(0, displayedCount));
  const slice = new Float64Array(targetCount * dimensions);
  slice.set(fullPositions.subarray(0, targetCount * dimensions));
  return slice;
}
