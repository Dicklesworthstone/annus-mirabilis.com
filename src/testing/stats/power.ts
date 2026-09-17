/**
 * Power and sample size calculations for statistical testing policy.
 * (am-ver-statistical-policy-grj)
 */

import { getNormalQuantile } from "./criticalValues.ts";

export interface SampleSizeForMeanOptions {
  readonly effectSize: number;
  readonly stdDev: number;
  readonly alpha?: number;
  readonly power?: number;
}

export interface SampleSizeForVarianceOptions {
  readonly relativeEffect: number;
  readonly alpha?: number;
  readonly power?: number;
}

export interface SampleSizeForProportionOptions {
  readonly p0: number;
  readonly p1: number;
  readonly alpha?: number;
  readonly power?: number;
}

export interface SampleSizeForRmsScalingOptions {
  readonly intendedScaling: number;
  readonly buggyScaling: number;
  readonly alpha?: number;
  readonly power?: number;
}

const DEFAULT_ALPHA = 1e-6;
const DEFAULT_POWER = 0.95;

/**
 * Calculates the minimum sample size to detect a difference in mean of `effectSize`
 * with significance `alpha` and power `power`.
 */
export function requiredSampleSizeForMean(options: SampleSizeForMeanOptions): number {
  const { effectSize, stdDev, alpha = DEFAULT_ALPHA, power = DEFAULT_POWER } = options;
  if (effectSize <= 0) {
    throw new RangeError(`effectSize must be positive, got ${effectSize}`);
  }
  if (stdDev <= 0) {
    throw new RangeError(`stdDev must be positive, got ${stdDev}`);
  }
  const zAlpha = getNormalQuantile(1 - alpha / 2);
  const zPower = getNormalQuantile(power);
  const standardizedEffect = effectSize / stdDev;
  const n = ((zAlpha + zPower) / standardizedEffect) ** 2;
  return Math.max(2, Math.ceil(n));
}

/**
 * Calculates the minimum sample size to detect a relative variance error `relativeEffect` = delta
 * (e.g. delta = 0.02 for a 2% scaling error) at significance `alpha` and power `power`.
 */
export function requiredSampleSizeForVariance(options: SampleSizeForVarianceOptions): number {
  const { relativeEffect, alpha = DEFAULT_ALPHA, power = DEFAULT_POWER } = options;
  const delta = relativeEffect;
  const absDelta = Math.abs(delta);
  if (absDelta <= 0) {
    throw new RangeError(`relativeEffect must be non-zero, got ${relativeEffect}`);
  }
  const zAlpha = getNormalQuantile(1 - alpha / 2);
  const zPower = getNormalQuantile(power);
  const logRatio = Math.abs(Math.log(1 + delta));
  const n = 1 + 2 * ((zAlpha + zPower) / logRatio) ** 2;
  return Math.max(3, Math.ceil(n));
}

/**
 * Calculates the minimum sample size to distinguish proportion `p1` from `p0`
 * at significance `alpha` and power `power`.
 */
export function requiredSampleSizeForProportion(options: SampleSizeForProportionOptions): number {
  const { p0, p1, alpha = DEFAULT_ALPHA, power = DEFAULT_POWER } = options;
  if (p0 <= 0 || p0 >= 1 || p1 <= 0 || p1 >= 1) {
    throw new RangeError(`Probabilities p0 and p1 must be in (0, 1)`);
  }
  const diff = Math.abs(p1 - p0);
  if (diff === 0) {
    throw new RangeError(`p0 and p1 must be distinct`);
  }
  const zAlpha = getNormalQuantile(1 - alpha / 2);
  const zPower = getNormalQuantile(power);
  const numerator = zAlpha * Math.sqrt(p0 * (1 - p0)) + zPower * Math.sqrt(p1 * (1 - p1));
  const n = (numerator / diff) ** 2;
  return Math.max(2, Math.ceil(n));
}

/**
 * Calculates the minimum sample size to detect a bug in RMS scaling
 * (e.g. using 1/2 instead of 1/sqrt(2) for diffusion RMS scaling).
 */
export function requiredSampleSizeForRmsScaling(options: SampleSizeForRmsScalingOptions): number {
  const { intendedScaling, buggyScaling, alpha = DEFAULT_ALPHA, power = DEFAULT_POWER } = options;
  if (intendedScaling <= 0 || buggyScaling <= 0) {
    throw new RangeError(`Scalings must be positive numbers`);
  }
  const varianceIntended = intendedScaling * intendedScaling;
  const varianceBuggy = buggyScaling * buggyScaling;
  const relativeEffect = (varianceBuggy - varianceIntended) / varianceIntended;
  return requiredSampleSizeForVariance({ relativeEffect, alpha, power });
}

/**
 * Asserts that the actual sample size meets or exceeds the required sample size for the declared power.
 */
export function assertMinimumSampleSize(
  actualN: number,
  requiredN: number,
  context?: string,
): void {
  if (actualN < requiredN) {
    throw new Error(
      `Statistical sample size underpowered: actual N = ${actualN} is less than required N = ${requiredN} ` +
        `to achieve target power for ${context ?? "declared effect"}.`,
    );
  }
}
