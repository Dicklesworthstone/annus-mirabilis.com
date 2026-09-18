import { frameRatePasses } from "../../src/testing/perfProfiles.ts";

export type DeviceTier = "desktop-capable" | "mobile-low-cost";

export interface FrameTimingThresholds {
  medianMaxMs: number;
  longMaxMs: number;
  longMaxFraction: number;
}

export const TIER_THRESHOLDS: Record<DeviceTier, FrameTimingThresholds> = {
  "desktop-capable": {
    medianMaxMs: 16.7,
    longMaxMs: 33.4,
    longMaxFraction: 0.05,
  },
  "mobile-low-cost": {
    medianMaxMs: 33.4,
    longMaxMs: 50.0,
    longMaxFraction: 0.05,
  },
};

export interface FrameTimingEvaluation {
  tier: DeviceTier;
  sampleCount: number;
  medianMs: number;
  longFraction: number;
  thresholds: FrameTimingThresholds;
  ok: boolean;
}

/**
 * Evaluates requestAnimationFrame frame intervals against the tier thresholds:
 * - desktop-capable: median <= 16.7 ms, at most 5% > 33.4 ms.
 * - mobile-low-cost: median <= 33.4 ms, at most 5% > 50.0 ms.
 */
export function evaluateFrameTiming(
  tier: DeviceTier,
  intervalsMs: number[],
): FrameTimingEvaluation {
  if (intervalsMs.length === 0) {
    throw new Error("Cannot evaluate frame timing on empty interval sample");
  }

  const thresholds = TIER_THRESHOLDS[tier];
  const check = frameRatePasses({
    intervalsMs,
    medianMaxMs: thresholds.medianMaxMs,
    longMaxMs: thresholds.longMaxMs,
    longMaxFraction: thresholds.longMaxFraction,
  });

  return {
    tier,
    sampleCount: intervalsMs.length,
    medianMs: check.medianMs,
    longFraction: check.longFraction,
    thresholds,
    ok: check.ok,
  };
}

export interface ThrottledPhysicsCheckResult {
  stepIndex: number;
  unthrottledDigest: string;
  throttledDigest: string;
  matched: boolean;
  message: string;
}

/**
 * Checks that under the throttled profile, the scientific digest of the accepted snapshot
 * at a fixed stepIndex equals the digest from an unthrottled run.
 * This proves no model step, sample, or diffusivity was traded for frame rate.
 */
export function verifyThrottledPhysicsDigest(input: {
  stepIndex: number;
  unthrottledDigest: string;
  throttledDigest: string;
}): ThrottledPhysicsCheckResult {
  const matched = input.unthrottledDigest === input.throttledDigest;
  return {
    stepIndex: input.stepIndex,
    unthrottledDigest: input.unthrottledDigest,
    throttledDigest: input.throttledDigest,
    matched,
    message: matched
      ? `Physics invariant preserved: scientific digest '${input.unthrottledDigest}' matches across unthrottled and throttled profiles at step ${input.stepIndex}`
      : `Physics violation: throttled profile modified physics at step ${input.stepIndex} (unthrottled: '${input.unthrottledDigest}', throttled: '${input.throttledDigest}')`,
  };
}
