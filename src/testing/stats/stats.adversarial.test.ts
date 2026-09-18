import { describe, expect, it } from "bun:test";
import { createPhiloxStream } from "../../physics/reference/philox.ts";
import {
  assertCorrelationNearZero,
  assertMomentGrowth,
  assertSampleMean,
  StatisticalAssertionError,
} from "./assertions.ts";

describe("Adversarial Statistical Tests (am-ver-statistical-policy-grj)", () => {
  const seed = "987654321012345678";

  it("detects deliberately biased mean estimator and retains failure evidence", () => {
    const stream = createPhiloxStream({ seed, kernel: 10, tile: 1 });
    const n = 500;
    const biasedSamples: number[] = [];
    for (let i = 0; i < n; i++) {
      // Intended mean 0, but biased by +0.3
      biasedSamples.push(stream.nextNormal() + 0.3);
    }

    let caughtError: StatisticalAssertionError | undefined;
    try {
      assertSampleMean({
        samples: biasedSamples,
        expectedMean: 0,
        stdDev: 1.0,
        alpha: 1e-4,
        testId: "adversarial-biased-mean",
        seed,
      });
    } catch (err) {
      if (err instanceof StatisticalAssertionError) {
        caughtError = err;
      }
    }

    expect(caughtError).toBeDefined();
    expect(caughtError?.result.passed).toBe(false);
    expect(caughtError?.result.statistic).toBe("mean");
  });

  it("detects correlated sampler and rejects independence", () => {
    const stream = createPhiloxStream({ seed, kernel: 11, tile: 1 });
    const n = 500;
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const val = stream.nextNormal();
      x.push(val);
      // y is strongly correlated with x
      y.push(0.8 * val + 0.2 * stream.nextNormal());
    }

    expect(() =>
      assertCorrelationNearZero({
        x,
        y,
        expectedCorrelation: 0,
        alpha: 1e-4,
        testId: "adversarial-correlated-sampler",
        seed,
      }),
    ).toThrow(StatisticalAssertionError);
  });

  it("detects halved RMS scaling bug under diffusion", () => {
    const stream = createPhiloxStream({ seed, kernel: 12, tile: 1 });
    const D = 5.0e-13;
    const t = 1.0;
    const intendedSigma = Math.sqrt(2 * D * t);
    // Buggy model uses 0.5 * intendedSigma instead of 1.0 * intendedSigma (halved RMS)
    const buggySigma = 0.5 * intendedSigma;

    const M = 500;
    const buggyPositions: number[] = [];
    for (let i = 0; i < M; i++) {
      buggyPositions.push(stream.nextNormal() * buggySigma);
    }

    expect(() =>
      assertMomentGrowth({
        positions: buggyPositions,
        diffusionCoefficient: D,
        time: t,
        alpha: 1e-4,
        testId: "adversarial-halved-rms-diffusion",
        seed,
      }),
    ).toThrow(StatisticalAssertionError);
  });
});
