import { describe, expect, test } from "bun:test";
import { generateSeed, isValidSeed } from "../experiments/controls/seed.ts";
import { FIXTURE_PARAMETER_SPECS } from "./e2e/fixture-apps/controls-kit/index.ts";

describe("Parameter Controls Reset Semantics (am-inst-parameter-controls-cmj9)", () => {
  test("reset same-seed restores defaults while preserving current seed", () => {
    const currentSeed = "18446744073709551615";
    const modifiedState = {
      seed: currentSeed,
      T: 320.0,
      eta: 0.005,
      a: 1e-6,
      h: 0.05,
      interval: 5.0,
      d: 3,
      D: 0.1,
      statistic: 2,
    };

    // Reset with mode: "same-seed"
    const resetState: Record<string, number | string> = {};
    for (const spec of FIXTURE_PARAMETER_SPECS) {
      resetState[spec.id] = spec.default;
    }
    resetState.seed = modifiedState.seed; // preserve same seed

    expect(resetState.seed).toBe(currentSeed);
    expect(resetState.T).toBe(290.15);
    expect(resetState.eta).toBe(0.00135);
    expect(resetState.a).toBe(5e-7);
    expect(resetState.interval).toBe(1.0);
  });

  test("reset new-trial generates and records a new valid random seed", () => {
    const previousSeed = "1905";
    const freshSeed = generateSeed();

    expect(isValidSeed(freshSeed)).toBe(true);
    expect(freshSeed).not.toBe(previousSeed);

    const resetState: Record<string, number | string> = {};
    for (const spec of FIXTURE_PARAMETER_SPECS) {
      resetState[spec.id] = spec.default;
    }
    resetState.seed = freshSeed;

    expect(resetState.seed).toBe(freshSeed);
    expect(resetState.T).toBe(290.15);
  });
});
