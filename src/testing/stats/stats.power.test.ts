import { describe, expect, it } from "bun:test";
import {
  assertMinimumSampleSize,
  requiredSampleSizeForMean,
  requiredSampleSizeForProportion,
  requiredSampleSizeForRmsScaling,
  requiredSampleSizeForVariance,
} from "./power.ts";

describe("Statistical Power & Sample Size (am-ver-statistical-policy-grj)", () => {
  it("computes required sample size for mean difference", () => {
    // Detect 0.1 sigma shift at alpha=0.05, power=0.90
    const n = requiredSampleSizeForMean({
      effectSize: 0.1,
      stdDev: 1.0,
      alpha: 0.05,
      power: 0.9,
    });
    // (1.96 + 1.28)^2 / 0.01 = 10.5 / 0.01 = ~1050
    expect(n).toBeGreaterThan(1000);
    expect(n).toBeLessThan(1200);
  });

  it("computes required sample size for variance scaling error", () => {
    // 2% relative variance error (delta = 0.02) at alpha=0.05, power=0.90
    const n = requiredSampleSizeForVariance({
      relativeEffect: 0.02,
      alpha: 0.05,
      power: 0.9,
    });
    expect(n).toBeGreaterThan(50000);
  });

  it("computes required sample size for proportion shift", () => {
    // Distinguish 0.50 from 0.55 at alpha=0.05, power=0.90
    const n = requiredSampleSizeForProportion({
      p0: 0.5,
      p1: 0.55,
      alpha: 0.05,
      power: 0.9,
    });
    expect(n).toBeGreaterThan(800);
    expect(n).toBeLessThan(1200);
  });

  it("computes required sample size for halved RMS scaling bug", () => {
    // Diffusion RMS scaling: intended 1/sqrt(2) vs buggy 1/2
    const n = requiredSampleSizeForRmsScaling({
      intendedScaling: 1 / Math.SQRT2,
      buggyScaling: 0.5,
      alpha: 1e-4,
      power: 0.99,
    });
    // This is a massive 50% variance discrepancy, requires few samples
    expect(n).toBeGreaterThan(50);
    expect(n).toBeLessThan(500);
  });

  it("assertMinimumSampleSize passes when sample size is sufficient and throws when underpowered", () => {
    expect(() => assertMinimumSampleSize(1000, 500, "test-case")).not.toThrow();
    expect(() => assertMinimumSampleSize(200, 500, "test-case")).toThrow(
      /Statistical sample size underpowered/,
    );
  });
});
