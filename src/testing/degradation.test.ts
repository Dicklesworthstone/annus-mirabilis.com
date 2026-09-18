import { describe, expect, test } from "bun:test";
import {
  computeFullEnsembleMoments,
  evaluateVisualDetailPolicy,
  extractDisplayParticleSlice,
} from "../experiments/lifecycle/degradation.ts";
import { createPhiloxStream } from "../physics/reference/philox.ts";

describe("Performance degradation policy and scientific ensemble integrity", () => {
  test("displayed particle count scales down under budget without altering full ensemble", () => {
    const totalParticles = 2000;

    // 1. Nominal frame budget: 60fps (16.6ms) with 12ms measured
    const nominal = evaluateVisualDetailPolicy(totalParticles, {
      targetFrameTimeMs: 16.67,
      measuredFrameTimeMs: 12.0,
    });
    expect(nominal.isPaused).toBe(false);
    expect(nominal.displayedParticleCount).toBe(2000);
    expect(nominal.renderDecimationRatio).toBe(1.0);

    // 2. Over-budget: 35ms measured (under 30fps)
    const degraded = evaluateVisualDetailPolicy(totalParticles, {
      targetFrameTimeMs: 16.67,
      measuredFrameTimeMs: 35.0,
    });
    expect(degraded.isPaused).toBe(false);
    expect(degraded.displayedParticleCount).toBeLessThan(totalParticles);
    expect(degraded.displayedParticleCount).toBeGreaterThanOrEqual(50);
    expect(degraded.explanation).toContain("Visual detail degraded under budget");
    expect(degraded.explanation).toContain("Statistical ensemble and inference moments remain full size");

    // 3. Severely starved: 75ms measured (> 4x budget)
    const starved = evaluateVisualDetailPolicy(totalParticles, {
      targetFrameTimeMs: 16.67,
      measuredFrameTimeMs: 75.0,
    });
    expect(starved.isPaused).toBe(true);
    expect(starved.explanation).toContain("Rendering paused");
  });

  test("scientific moments and digests are bitwise identical regardless of visual degradation", () => {
    // Generate an ensemble of 1000 particles in 3D using Philox stream
    const particleCount = 1000;
    const fullPositions = new Float64Array(particleCount * 3);
    const stream = createPhiloxStream({ seed: "19050511", kernel: 0, tile: 0 });

    for (let i = 0; i < particleCount * 3; i++) {
      fullPositions[i] = stream.nextNormal();
    }

    // Moments computed on full ensemble under nominal conditions
    const nominalMoments = computeFullEnsembleMoments(fullPositions, 3);
    expect(nominalMoments.sampleSize).toBe(1000);
    expect(nominalMoments.digest).toHaveLength(16);

    // Simulate severe visual detail reduction down to 100 particles
    const lowBudget = evaluateVisualDetailPolicy(particleCount, {
      targetFrameTimeMs: 16.67,
      measuredFrameTimeMs: 40.0,
    });
    const displaySlice = extractDisplayParticleSlice(
      fullPositions,
      lowBudget.displayedParticleCount,
      3,
    );
    expect(displaySlice.length).toBe(lowBudget.displayedParticleCount * 3);

    // Scientific evaluation must still use fullPositions
    const degradedScientificMoments = computeFullEnsembleMoments(fullPositions, 3);

    // The scientific moments and digests must be bitwise identical
    expect(degradedScientificMoments.sampleSize).toBe(nominalMoments.sampleSize);
    expect(degradedScientificMoments.meanX).toBe(nominalMoments.meanX);
    expect(degradedScientificMoments.varianceX).toBe(nominalMoments.varianceX);
    expect(degradedScientificMoments.rmsX).toBe(nominalMoments.rmsX);
    expect(degradedScientificMoments.digest).toBe(nominalMoments.digest);
  });
});
