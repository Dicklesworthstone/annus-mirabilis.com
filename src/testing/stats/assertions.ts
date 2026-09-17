/**
 * Standardized statistical assertions with precomputed bounds and no reruns.
 * (am-ver-statistical-policy-grj)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getLogger } from "../log/logger.ts";
import {
  getCriticalValuesDigest,
  getChi2Quantile,
  getNormalQuantile,
  getStudentTQuantile,
} from "./criticalValues.ts";
import type {
  AssertCorrelationNearZeroOptions,
  AssertGaussianVarianceOptions,
  AssertHistogramFitOptions,
  AssertMomentGrowthOptions,
  AssertNonGaussianMeanSquareOptions,
  AssertProportionOptions,
  AssertSampleMeanOptions,
  BaseStatisticalAssertionOptions,
  StatisticalAssertionResult,
} from "./types.ts";

export class StatisticalAssertionError extends Error {
  readonly result: StatisticalAssertionResult;
  constructor(result: StatisticalAssertionResult) {
    super(result.message);
    this.name = "StatisticalAssertionError";
    this.result = result;
  }
}

export function resolveAlpha(options: {
  alpha?: number;
  familyWiseBudget?: number;
  totalAssertions?: number;
}): number {
  if (options.alpha !== undefined) {
    if (options.alpha <= 0 || options.alpha >= 1) {
      throw new RangeError(`alpha must be in (0, 1), got ${options.alpha}`);
    }
    return options.alpha;
  }
  const budget = options.familyWiseBudget ?? 1e-6;
  const count = Math.max(1, options.totalAssertions ?? 1);
  return budget / count;
}

function retainFailureEvidence(result: StatisticalAssertionResult, logRunId: string): void {
  try {
    const dir = path.join(
      process.cwd(),
      "artifacts",
      "test-logs",
      "statistics",
      logRunId,
      "failures",
    );
    mkdirSync(dir, { recursive: true });
    const filename = `${result.testId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`;
    const payload = {
      testId: result.testId,
      beadId: result.beadId,
      seed: result.seed,
      allocationId: result.allocationId,
      n: result.sampleSize,
      statistic: result.statistic,
      observedValue: result.observedValue,
      lowerBound: result.lowerBound,
      upperBound: result.upperBound,
      alpha: result.alpha,
      criticalValueTableDigest: result.criticalValueTableDigest,
      power: result.power,
      effect: result.effect,
      evidenceKind: result.evidenceKind,
      message: result.message,
      reproductionCommand: `bun test src/testing/stats/ -t "${result.testId}"`,
    };
    writeFileSync(path.join(dir, filename), JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // Non-fatal if failure directory cannot be written
  }
}

function processAssertion(
  result: StatisticalAssertionResult,
  options: BaseStatisticalAssertionOptions,
): StatisticalAssertionResult {
  const logger = getLogger(options.suite ?? "statistics", options.logRunId);
  logger.log({
    testId: result.testId,
    beadId: result.beadId,
    seed: result.seed,
    streamVersion: result.streamVersion,
    outcome: result.passed ? "passed" : "failed",
    message: result.message,
    extra: {
      allocationId: result.allocationId,
      n: result.sampleSize,
      statistic: result.statistic,
      observedValue: result.observedValue,
      lowerBound: result.lowerBound,
      upperBound: result.upperBound,
      alpha: result.alpha,
      familyWiseBudget: result.familyWiseBudget,
      power: result.power,
      effect: result.effect,
      evidenceKind: result.evidenceKind,
      criticalValueTableDigest: result.criticalValueTableDigest,
    },
  });

  if (!result.passed) {
    retainFailureEvidence(result, logger.logRunId);
    if (!options.suppressThrow) {
      throw new StatisticalAssertionError(result);
    }
  }

  return result;
}

/**
 * Asserts that the sample mean falls within precomputed critical bounds.
 */
export function assertSampleMean(options: AssertSampleMeanOptions): StatisticalAssertionResult {
  const { samples, expectedMean, stdDev, testId } = options;
  const n = samples.length;
  if (n === 0) throw new RangeError("Sample size must be non-zero.");

  const sum = samples.reduce((acc, x) => acc + x, 0);
  const observedMean = sum / n;
  const alpha = resolveAlpha(options);

  let lowerBound: number;
  let upperBound: number;

  if (stdDev !== undefined) {
    if (stdDev <= 0) throw new RangeError("stdDev must be positive.");
    const se = stdDev / Math.sqrt(n);
    const z = getNormalQuantile(1 - alpha / 2);
    lowerBound = expectedMean - z * se;
    upperBound = expectedMean + z * se;
  } else {
    if (n < 2) throw new RangeError("Sample size must be >= 2 when estimating standard deviation.");
    const variance = samples.reduce((acc, x) => acc + (x - observedMean) ** 2, 0) / (n - 1);
    const se = Math.sqrt(variance / n);
    const t = getStudentTQuantile(n - 1, 1 - alpha / 2);
    lowerBound = expectedMean - t * se;
    upperBound = expectedMean + t * se;
  }

  const passed = observedMean >= lowerBound && observedMean <= upperBound;
  const message = passed
    ? `Sample mean ${observedMean.toPrecision(6)} is within [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for expected mean ${expectedMean} (alpha=${alpha}, n=${n}).`
    : `Sample mean ${observedMean.toPrecision(6)} failed critical bounds [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for expected mean ${expectedMean} (alpha=${alpha}, n=${n}).`;

  return processAssertion(
    {
      passed,
      statistic: "mean",
      observedValue: observedMean,
      lowerBound,
      upperBound,
      alpha,
      sampleSize: n,
      testId,
      beadId: options.beadId ?? "am-ver-statistical-policy-grj",
      seed: options.seed !== undefined ? options.seed.toString() : undefined,
      streamVersion: options.streamVersion ?? 1,
      allocationId: options.allocationId,
      familyWiseBudget: options.familyWiseBudget,
      power: options.power,
      effect: options.effect,
      evidenceKind: options.evidenceKind ?? "distribution-test",
      criticalValueTableDigest: getCriticalValuesDigest(),
      message,
    },
    options,
  );
}

/**
 * Asserts that the sample variance of Gaussian samples falls within chi-square bounds.
 */
export function assertGaussianVariance(
  options: AssertGaussianVarianceOptions,
): StatisticalAssertionResult {
  const { samples, expectedVariance, mean, testId } = options;
  const n = samples.length;
  if (expectedVariance <= 0) throw new RangeError("expectedVariance must be positive.");

  let df: number;
  let sampleVar: number;

  if (mean !== undefined) {
    if (n === 0) throw new RangeError("Sample size must be non-zero.");
    sampleVar = samples.reduce((acc, x) => acc + (x - mean) ** 2, 0) / n;
    df = n;
  } else {
    if (n < 2) throw new RangeError("Sample size must be >= 2 when mean is estimated.");
    const sampleMean = samples.reduce((acc, x) => acc + x, 0) / n;
    sampleVar = samples.reduce((acc, x) => acc + (x - sampleMean) ** 2, 0) / (n - 1);
    df = n - 1;
  }

  const alpha = resolveAlpha(options);
  const chi2Low = getChi2Quantile(df, alpha / 2);
  const chi2High = getChi2Quantile(df, 1 - alpha / 2);

  const lowerBound = (expectedVariance * chi2Low) / df;
  const upperBound = (expectedVariance * chi2High) / df;

  const passed = sampleVar >= lowerBound && sampleVar <= upperBound;
  const message = passed
    ? `Gaussian sample variance ${sampleVar.toPrecision(6)} is within [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for expected variance ${expectedVariance} (df=${df}, alpha=${alpha}).`
    : `Gaussian sample variance ${sampleVar.toPrecision(6)} failed critical bounds [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for expected variance ${expectedVariance} (df=${df}, alpha=${alpha}).`;

  return processAssertion(
    {
      passed,
      statistic: "gaussian-variance",
      observedValue: sampleVar,
      lowerBound,
      upperBound,
      alpha,
      sampleSize: n,
      testId,
      beadId: options.beadId ?? "am-ver-statistical-policy-grj",
      seed: options.seed !== undefined ? options.seed.toString() : undefined,
      streamVersion: options.streamVersion ?? 1,
      allocationId: options.allocationId,
      familyWiseBudget: options.familyWiseBudget,
      power: options.power,
      effect: options.effect,
      evidenceKind: options.evidenceKind ?? "distribution-test",
      criticalValueTableDigest: getCriticalValuesDigest(),
      message,
    },
    options,
  );
}

/**
 * Asserts non-Gaussian mean square against declared fourth moment bounds.
 */
export function assertNonGaussianMeanSquare(
  options: AssertNonGaussianMeanSquareOptions,
): StatisticalAssertionResult {
  const { samples, expectedSecondMoment, fourthMoment, testId } = options;
  const n = samples.length;
  if (n === 0) throw new RangeError("Sample size must be non-zero.");

  const m2Observed = samples.reduce((acc, x) => acc + x * x, 0) / n;
  const alpha = resolveAlpha(options);

  const varM2 = (fourthMoment - expectedSecondMoment * expectedSecondMoment) / n;
  let lowerBound: number;
  let upperBound: number;

  if (varM2 <= 1e-15) {
    // Exact deterministic moment case (e.g. coin steps x in {-1, +1} where x^2 is identically 1)
    lowerBound = expectedSecondMoment;
    upperBound = expectedSecondMoment;
  } else {
    const se = Math.sqrt(varM2);
    const z = getNormalQuantile(1 - alpha / 2);
    lowerBound = expectedSecondMoment - z * se;
    upperBound = expectedSecondMoment + z * se;
  }

  const passed = Math.abs(m2Observed - expectedSecondMoment) <= 1e-12 || (m2Observed >= lowerBound && m2Observed <= upperBound);
  const message = passed
    ? `Non-Gaussian mean square ${m2Observed.toPrecision(6)} is within [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for expected second moment ${expectedSecondMoment} (n=${n}, alpha=${alpha}).`
    : `Non-Gaussian mean square ${m2Observed.toPrecision(6)} failed critical bounds [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for expected second moment ${expectedSecondMoment} (n=${n}, alpha=${alpha}).`;

  return processAssertion(
    {
      passed,
      statistic: "non-gaussian-mean-square",
      observedValue: m2Observed,
      lowerBound,
      upperBound,
      alpha,
      sampleSize: n,
      testId,
      beadId: options.beadId ?? "am-ver-statistical-policy-grj",
      seed: options.seed !== undefined ? options.seed.toString() : undefined,
      streamVersion: options.streamVersion ?? 1,
      allocationId: options.allocationId,
      familyWiseBudget: options.familyWiseBudget,
      power: options.power,
      effect: options.effect,
      evidenceKind: options.evidenceKind ?? "distribution-test",
      criticalValueTableDigest: getCriticalValuesDigest(),
      message,
    },
    options,
  );
}

/**
 * Asserts success proportion against binomial/Wilson bounds.
 */
export function assertProportion(
  options: AssertProportionOptions,
): StatisticalAssertionResult {
  const { successes, trials, expectedProbability, testId } = options;
  if (trials <= 0) throw new RangeError("trials must be positive.");
  if (successes < 0 || successes > trials) {
    throw new RangeError(`successes (${successes}) must be between 0 and trials (${trials}).`);
  }
  if (expectedProbability <= 0 || expectedProbability >= 1) {
    throw new RangeError(`expectedProbability must be in (0, 1), got ${expectedProbability}`);
  }

  const observedProp = successes / trials;
  const alpha = resolveAlpha(options);
  const z = getNormalQuantile(1 - alpha / 2);

  const se = Math.sqrt((expectedProbability * (1 - expectedProbability)) / trials);
  const lowerBound = Math.max(0, expectedProbability - z * se);
  const upperBound = Math.min(1, expectedProbability + z * se);

  const passed = observedProp >= lowerBound && observedProp <= upperBound;
  const message = passed
    ? `Proportion ${observedProp.toPrecision(6)} (${successes}/${trials}) is within [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for expected p=${expectedProbability} (alpha=${alpha}).`
    : `Proportion ${observedProp.toPrecision(6)} (${successes}/${trials}) failed critical bounds [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for expected p=${expectedProbability} (alpha=${alpha}).`;

  return processAssertion(
    {
      passed,
      statistic: "proportion",
      observedValue: observedProp,
      lowerBound,
      upperBound,
      alpha,
      sampleSize: trials,
      testId,
      beadId: options.beadId ?? "am-ver-statistical-policy-grj",
      seed: options.seed !== undefined ? options.seed.toString() : undefined,
      streamVersion: options.streamVersion ?? 1,
      allocationId: options.allocationId,
      familyWiseBudget: options.familyWiseBudget,
      power: options.power,
      effect: options.effect,
      evidenceKind: options.evidenceKind ?? "distribution-test",
      criticalValueTableDigest: getCriticalValuesDigest(),
      message,
    },
    options,
  );
}

/**
 * Asserts goodness-of-fit of a frequency histogram against expected cell probabilities.
 */
export function assertHistogramFit(
  options: AssertHistogramFitOptions,
): StatisticalAssertionResult {
  const { observedCounts, expectedProbabilities, testId } = options;
  const k = observedCounts.length;
  if (k < 2) throw new RangeError("Histogram must contain at least 2 bins.");
  if (k !== expectedProbabilities.length) {
    throw new RangeError(
      `observedCounts length (${k}) must match expectedProbabilities length (${expectedProbabilities.length}).`,
    );
  }

  const totalObserved = observedCounts.reduce((acc, x) => acc + x, 0);
  if (totalObserved === 0) throw new RangeError("Total observations must be non-zero.");

  let chi2 = 0;
  for (let i = 0; i < k; i++) {
    const expected = totalObserved * expectedProbabilities[i]!;
    if (expected <= 0) throw new RangeError(`Expected count for bin ${i} must be positive.`);
    const diff = observedCounts[i]! - expected;
    chi2 += (diff * diff) / expected;
  }

  const df = k - 1;
  const alpha = resolveAlpha(options);
  const criticalChi2 = getChi2Quantile(df, 1 - alpha);

  const lowerBound = 0;
  const upperBound = criticalChi2;
  const passed = chi2 <= criticalChi2;

  const message = passed
    ? `Histogram chi-square ${chi2.toPrecision(6)} <= critical threshold ${criticalChi2.toPrecision(6)} (df=${df}, alpha=${alpha}, N=${totalObserved}).`
    : `Histogram chi-square ${chi2.toPrecision(6)} exceeded critical threshold ${criticalChi2.toPrecision(6)} (df=${df}, alpha=${alpha}, N=${totalObserved}).`;

  return processAssertion(
    {
      passed,
      statistic: "histogram-fit",
      observedValue: chi2,
      lowerBound,
      upperBound,
      alpha,
      sampleSize: totalObserved,
      testId,
      beadId: options.beadId ?? "am-ver-statistical-policy-grj",
      seed: options.seed !== undefined ? options.seed.toString() : undefined,
      streamVersion: options.streamVersion ?? 1,
      allocationId: options.allocationId,
      familyWiseBudget: options.familyWiseBudget,
      power: options.power,
      effect: options.effect,
      evidenceKind: options.evidenceKind ?? "distribution-test",
      criticalValueTableDigest: getCriticalValuesDigest(),
      message,
    },
    options,
  );
}

/**
 * Asserts that the Pearson correlation between two series is statistically consistent with zero (or expected).
 */
export function assertCorrelationNearZero(
  options: AssertCorrelationNearZeroOptions,
): StatisticalAssertionResult {
  const { x, y, expectedCorrelation = 0, testId } = options;
  const n = x.length;
  if (n < 4) throw new RangeError("Sample size must be at least 4 for correlation tests.");
  if (n !== y.length) {
    throw new RangeError(`x length (${n}) must match y length (${y.length}).`);
  }

  const meanX = x.reduce((acc, v) => acc + v, 0) / n;
  const meanY = y.reduce((acc, v) => acc + v, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const r = denX === 0 || denY === 0 ? 0 : num / Math.sqrt(denX * denY);
  const alpha = resolveAlpha(options);
  const z = getNormalQuantile(1 - alpha / 2);

  // Fisher z-transformation bound
  const seZ = 1 / Math.sqrt(n - 3);
  const zTarget = 0.5 * Math.log((1 + expectedCorrelation) / (1 - expectedCorrelation));
  const zLow = zTarget - z * seZ;
  const zHigh = zTarget + z * seZ;

  const lowerBound = Math.tanh(zLow);
  const upperBound = Math.tanh(zHigh);

  const passed = r >= lowerBound && r <= upperBound;
  const message = passed
    ? `Pearson correlation ${r.toPrecision(6)} is within [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for rho=${expectedCorrelation} (n=${n}, alpha=${alpha}).`
    : `Pearson correlation ${r.toPrecision(6)} failed bounds [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for rho=${expectedCorrelation} (n=${n}, alpha=${alpha}).`;

  return processAssertion(
    {
      passed,
      statistic: "correlation",
      observedValue: r,
      lowerBound,
      upperBound,
      alpha,
      sampleSize: n,
      testId,
      beadId: options.beadId ?? "am-ver-statistical-policy-grj",
      seed: options.seed !== undefined ? options.seed.toString() : undefined,
      streamVersion: options.streamVersion ?? 1,
      allocationId: options.allocationId,
      familyWiseBudget: options.familyWiseBudget,
      power: options.power,
      effect: options.effect,
      evidenceKind: options.evidenceKind ?? "distribution-test",
      criticalValueTableDigest: getCriticalValuesDigest(),
      message,
    },
    options,
  );
}

/**
 * Asserts moment growth <x^2> = 2Dt for Brownian position ensembles.
 */
export function assertMomentGrowth(
  options: AssertMomentGrowthOptions,
): StatisticalAssertionResult {
  const { positions, diffusionCoefficient, time, testId } = options;
  const m = positions.length;
  if (m === 0) throw new RangeError("positions ensemble must be non-empty.");
  if (diffusionCoefficient <= 0) throw new RangeError("diffusionCoefficient must be positive.");
  if (time <= 0) throw new RangeError("time must be positive.");

  const sumSq = positions.reduce((acc, x) => acc + x * x, 0);
  const observedMsd = sumSq / m;
  const theoreticalVariance = 2 * diffusionCoefficient * time;

  const alpha = resolveAlpha(options);
  const chi2Low = getChi2Quantile(m, alpha / 2);
  const chi2High = getChi2Quantile(m, 1 - alpha / 2);

  const lowerBound = (theoreticalVariance * chi2Low) / m;
  const upperBound = (theoreticalVariance * chi2High) / m;

  const passed = observedMsd >= lowerBound && observedMsd <= upperBound;
  const message = passed
    ? `Moment growth MSD ${observedMsd.toPrecision(6)} is within [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for 2Dt=${theoreticalVariance.toPrecision(6)} (M=${m}, alpha=${alpha}).`
    : `Moment growth MSD ${observedMsd.toPrecision(6)} failed critical bounds [${lowerBound.toPrecision(6)}, ${upperBound.toPrecision(6)}] for 2Dt=${theoreticalVariance.toPrecision(6)} (M=${m}, alpha=${alpha}).`;

  return processAssertion(
    {
      passed,
      statistic: "moment-growth",
      observedValue: observedMsd,
      lowerBound,
      upperBound,
      alpha,
      sampleSize: m,
      testId,
      beadId: options.beadId ?? "am-ver-statistical-policy-grj",
      seed: options.seed !== undefined ? options.seed.toString() : undefined,
      streamVersion: options.streamVersion ?? 1,
      allocationId: options.allocationId,
      familyWiseBudget: options.familyWiseBudget,
      power: options.power,
      effect: options.effect,
      evidenceKind: options.evidenceKind ?? "distribution-test",
      criticalValueTableDigest: getCriticalValuesDigest(),
      message,
    },
    options,
  );
}
