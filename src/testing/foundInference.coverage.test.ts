import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COVERAGE, drawRepeatedIntervals } from "../foundations/repeatedIntervals.ts";
import { empiricalCoverageFraction } from "../physics/reference/inference.ts";
import { assertProportion } from "./stats/assertions.ts";

/**
 * am-found-statistics-inference-pzqv, foundInference.coverage: "a coverage check with a fixed
 * decimal-string seed under am-ver-statistical-policy-grj: over a prespecified number of synthetic
 * repetitions the covering fraction lies within its prespecified binomial tolerance of 0.95. The
 * test is never rerun to pass, and a failure keeps its seed and per-repetition table as evidence."
 *
 * Prespecified before the first run, 2026-09-24, and not to be changed to make a run pass:
 * - SEED "20260924", a decimal string, and TRIALS 1000 at each of q = 100 and q = 10;
 * - a family-wise false-alarm budget of 10⁻⁶ split over the two assertions, so each band is the
 *   normal approximation to the binomial at α = 5 × 10⁻⁷, about ±0.035 around 0.95 at n = 1000;
 * - power: a recipe that truly covered 90 per cent would fall outside that band about 95 times in
 *   100, and the negative control below shows an 80 per cent recipe failing.
 * The draws are synthetic. The test checks what the interval procedure promises, nothing about
 * molecules.
 */

const SEED = "20260924";
const TRIALS = 1000;
const FAMILY_WISE_BUDGET = 1e-6;
const ASSERTIONS = 2;

function keepTable(q: number, outcome: ReturnType<typeof drawRepeatedIntervals>): void {
  const dir = join(process.cwd(), "artifacts", "test-logs", "found-inference", "coverage-failures");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `seed-${SEED}-q-${q}.json`),
    JSON.stringify({ seed: SEED, q, trials: TRIALS, outcome }, null, 2),
  );
}

describe("the 95 per cent chi-square interval covers in 95 of 100 synthetic repetitions", () => {
  for (const q of [100, 10])
    test(`q = ${q}, seed ${SEED}, ${TRIALS} repetitions`, () => {
      const outcome = drawRepeatedIntervals({ seed: SEED, q, trials: TRIALS });
      if (outcome.status !== "drawn") throw new TypeError(outcome.message);
      expect(outcome.intervals.length).toBe(TRIALS);

      // The construction and the owner draw the same stream in the same order.
      const owner = empiricalCoverageFraction({
        trials: TRIALS,
        nominalCoverage: COVERAGE,
        degreesOfFreedom: q,
        seed: SEED,
      });
      expect(owner.kind).toBe("accepted");
      if (owner.kind === "accepted") expect(owner.data).toBe(outcome.covered / TRIALS);

      const result = assertProportion({
        testId: `found-inference-coverage-q${q}`,
        beadId: "am-found-statistics-inference-pzqv",
        successes: outcome.covered,
        trials: TRIALS,
        expectedProbability: COVERAGE,
        familyWiseBudget: FAMILY_WISE_BUDGET,
        totalAssertions: ASSERTIONS,
        seed: SEED,
        evidenceKind: "distribution-test",
        suite: "found-inference",
        suppressThrow: true,
      });
      if (!result.passed) keepTable(q, outcome);
      expect(result.passed, result.message).toBe(true);
    });
});

describe("the check can fail", () => {
  test("an 80 per cent recipe, judged against 0.95 with the same band, fails", () => {
    const owner = empiricalCoverageFraction({
      trials: TRIALS,
      nominalCoverage: 0.8,
      degreesOfFreedom: 100,
      seed: SEED,
    });
    if (owner.kind !== "accepted") throw new TypeError("expected an accepted fraction");
    const result = assertProportion({
      testId: "found-inference-coverage-negative-control",
      beadId: "am-found-statistics-inference-pzqv",
      successes: Math.round(owner.data * TRIALS),
      trials: TRIALS,
      expectedProbability: COVERAGE,
      familyWiseBudget: FAMILY_WISE_BUDGET,
      totalAssertions: ASSERTIONS,
      seed: SEED,
      suite: "found-inference",
      suppressThrow: true,
    });
    expect(result.passed).toBe(false);
  });
});
