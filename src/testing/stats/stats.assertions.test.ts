import { describe, expect, it } from "bun:test";
import { createPhiloxStream } from "../../physics/reference/philox.ts";
import {
  assertCorrelationNearZero,
  assertGaussianVariance,
  assertHistogramFit,
  assertMomentGrowth,
  assertNonGaussianMeanSquare,
  assertProportion,
  assertSampleMean,
} from "./assertions.ts";

describe("Statistical Assertion Helpers (am-ver-statistical-policy-grj)", () => {
  const seed = "10905190519051905";

  it("assertSampleMean: verifies sample mean with known stdDev and estimated s", () => {
    const stream = createPhiloxStream({ seed, kernel: 1, tile: 1 });
    const n = 1000;
    const samples: number[] = [];
    for (let i = 0; i < n; i++) {
      samples.push(stream.nextNormal());
    }

    // Known standard deviation = 1
    const resKnown = assertSampleMean({
      samples,
      expectedMean: 0,
      stdDev: 1,
      alpha: 1e-4,
      testId: "mean-known-stddev",
      seed,
    });
    expect(resKnown.passed).toBe(true);
    expect(resKnown.statistic).toBe("mean");

    // Estimated standard deviation via Student-t
    const resEst = assertSampleMean({
      samples,
      expectedMean: 0,
      alpha: 1e-4,
      testId: "mean-estimated-stddev",
      seed,
    });
    expect(resEst.passed).toBe(true);
  });

  it("assertGaussianVariance: verifies sample variance against chi-square bounds", () => {
    const stream = createPhiloxStream({ seed, kernel: 2, tile: 1 });
    const n = 500;
    const samples: number[] = [];
    for (let i = 0; i < n; i++) {
      samples.push(stream.nextNormal() * 2.0); // variance = 4.0
    }

    const res = assertGaussianVariance({
      samples,
      expectedVariance: 4.0,
      alpha: 1e-4,
      testId: "gaussian-variance-check",
      seed,
    });
    expect(res.passed).toBe(true);
    expect(res.statistic).toBe("gaussian-variance");
  });

  it("assertNonGaussianMeanSquare: handles coin, uniform, and Gaussian steps", () => {
    const stream = createPhiloxStream({ seed, kernel: 3, tile: 1 });
    const n = 1000;

    // 1. Coin steps x in {-1, +1}: mu_2 = 1, mu_4 = 1 -> exact deterministic mean square
    const coinSamples: number[] = [];
    for (let i = 0; i < n; i++) {
      coinSamples.push(stream.nextF64() < 0.5 ? -1 : 1);
    }
    const resCoin = assertNonGaussianMeanSquare({
      samples: coinSamples,
      expectedSecondMoment: 1.0,
      fourthMoment: 1.0,
      alpha: 1e-5,
      testId: "non-gaussian-coin-steps",
      seed,
    });
    expect(resCoin.passed).toBe(true);
    expect(resCoin.observedValue).toBe(1.0);

    // 2. Uniform steps x in [-a, a] with a = 3: mu_2 = a^2 / 3 = 3, mu_4 = a^4 / 5 = 16.2
    const a = 3;
    const uniformSamples: number[] = [];
    for (let i = 0; i < n; i++) {
      uniformSamples.push((stream.nextF64() * 2 - 1) * a);
    }
    const resUniform = assertNonGaussianMeanSquare({
      samples: uniformSamples,
      expectedSecondMoment: (a * a) / 3,
      fourthMoment: a ** 4 / 5,
      alpha: 1e-4,
      testId: "non-gaussian-uniform-steps",
      seed,
    });
    expect(resUniform.passed).toBe(true);

    // 3. Gaussian steps with sigma = 2: mu_2 = sigma^2 = 4, mu_4 = 3 * sigma^4 = 48
    const gaussianSamples: number[] = [];
    for (let i = 0; i < n; i++) {
      gaussianSamples.push(stream.nextNormal() * 2);
    }
    const resGaussian = assertNonGaussianMeanSquare({
      samples: gaussianSamples,
      expectedSecondMoment: 4.0,
      fourthMoment: 48.0,
      alpha: 1e-4,
      testId: "non-gaussian-gaussian-steps",
      seed,
    });
    expect(resGaussian.passed).toBe(true);
  });

  it("assertProportion: checks success rates within Wilson bounds", () => {
    const stream = createPhiloxStream({ seed, kernel: 4, tile: 1 });
    const trials = 2000;
    const p = 0.35;
    let successes = 0;
    for (let i = 0; i < trials; i++) {
      if (stream.nextF64() < p) successes++;
    }

    const res = assertProportion({
      successes,
      trials,
      expectedProbability: p,
      alpha: 1e-4,
      testId: "proportion-check",
      seed,
    });
    expect(res.passed).toBe(true);
    expect(res.statistic).toBe("proportion");
  });

  it("assertHistogramFit: validates empirical frequencies across bins", () => {
    const stream = createPhiloxStream({ seed, kernel: 5, tile: 1 });
    const bins = 5;
    const observedCounts = [0, 0, 0, 0, 0];
    const total = 5000;
    for (let i = 0; i < total; i++) {
      const idx = Math.min(bins - 1, Math.floor(stream.nextF64() * bins));
      observedCounts[idx] = (observedCounts[idx] ?? 0) + 1;
    }

    const res = assertHistogramFit({
      observedCounts,
      expectedProbabilities: [0.2, 0.2, 0.2, 0.2, 0.2],
      alpha: 1e-4,
      testId: "histogram-fit-check",
      seed,
    });
    expect(res.passed).toBe(true);
    expect(res.statistic).toBe("histogram-fit");
  });

  it("assertCorrelationNearZero: confirms independent Philox streams are uncorrelated", () => {
    const stream1 = createPhiloxStream({ seed, kernel: 6, tile: 1 });
    const stream2 = createPhiloxStream({ seed, kernel: 7, tile: 1 });
    const n = 1000;
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      x.push(stream1.nextNormal());
      y.push(stream2.nextNormal());
    }

    const res = assertCorrelationNearZero({
      x,
      y,
      expectedCorrelation: 0,
      alpha: 1e-4,
      testId: "correlation-near-zero",
      seed,
    });
    expect(res.passed).toBe(true);
    expect(Math.abs(res.observedValue)).toBeLessThan(0.15);
  });

  it("assertMomentGrowth: confirms <x^2> = 2Dt for Brownian positions", () => {
    const stream = createPhiloxStream({ seed, kernel: 8, tile: 1 });
    const D = 5.2e-13; // m^2 / s
    const t = 1.0; // s
    const sigma = Math.sqrt(2 * D * t);
    const M = 1000;
    const positions: number[] = [];
    for (let i = 0; i < M; i++) {
      positions.push(stream.nextNormal() * sigma);
    }

    const res = assertMomentGrowth({
      positions,
      diffusionCoefficient: D,
      time: t,
      alpha: 1e-4,
      testId: "moment-growth-brownian",
      seed,
    });
    expect(res.passed).toBe(true);
    expect(res.statistic).toBe("moment-growth");
  });
});
