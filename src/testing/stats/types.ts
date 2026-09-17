/**
 * Types and interfaces for statistical testing policy and assertion helpers.
 * (am-ver-statistical-policy-grj)
 */

export type EvidenceKind =
  | "fixed-random-golden"
  | "distribution-test"
  | "exact-transition-sampler"
  | "deterministic-convergence";

export type StatisticKind =
  | "mean"
  | "gaussian-variance"
  | "non-gaussian-mean-square"
  | "proportion"
  | "histogram-fit"
  | "correlation"
  | "moment-growth";

export interface StatisticalAssertionResult {
  readonly passed: boolean;
  readonly statistic: StatisticKind;
  readonly observedValue: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly alpha: number;
  readonly sampleSize: number;
  readonly testId: string;
  readonly beadId: string;
  readonly seed?: string | undefined;
  readonly streamVersion?: number | undefined;
  readonly allocationId?: string | undefined;
  readonly familyWiseBudget?: number | undefined;
  readonly power?: number | undefined;
  readonly effect?: string | number | undefined;
  readonly evidenceKind: EvidenceKind;
  readonly criticalValueTableDigest: string;
  readonly message: string;
}

export interface BaseStatisticalAssertionOptions {
  readonly testId: string;
  readonly beadId?: string;
  readonly seed?: string | bigint;
  readonly streamVersion?: number;
  readonly allocationId?: string;
  readonly alpha?: number;
  readonly familyWiseBudget?: number;
  readonly totalAssertions?: number;
  readonly power?: number;
  readonly effect?: string | number;
  readonly evidenceKind?: EvidenceKind;
  readonly suite?: string;
  readonly logRunId?: string;
  readonly suppressThrow?: boolean;
}

export interface AssertSampleMeanOptions extends BaseStatisticalAssertionOptions {
  readonly samples: readonly number[];
  readonly expectedMean: number;
  readonly stdDev?: number;
}

export interface AssertGaussianVarianceOptions extends BaseStatisticalAssertionOptions {
  readonly samples: readonly number[];
  readonly expectedVariance: number;
  readonly mean?: number;
}

export interface AssertNonGaussianMeanSquareOptions extends BaseStatisticalAssertionOptions {
  readonly samples: readonly number[];
  readonly expectedSecondMoment: number;
  readonly fourthMoment: number;
}

export interface AssertProportionOptions extends BaseStatisticalAssertionOptions {
  readonly successes: number;
  readonly trials: number;
  readonly expectedProbability: number;
}

export interface AssertHistogramFitOptions extends BaseStatisticalAssertionOptions {
  readonly observedCounts: readonly number[];
  readonly expectedProbabilities: readonly number[];
}

export interface AssertCorrelationNearZeroOptions extends BaseStatisticalAssertionOptions {
  readonly x: readonly number[];
  readonly y: readonly number[];
  readonly expectedCorrelation?: number;
}

export interface AssertMomentGrowthOptions extends BaseStatisticalAssertionOptions {
  readonly positions: readonly number[];
  readonly diffusionCoefficient: number;
  readonly time: number;
}
