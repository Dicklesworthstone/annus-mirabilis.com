import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RepeatedIntervals } from "../components/foundations/RepeatedIntervals.tsx";
import {
  DEFAULT_SEED,
  drawRepeatedIntervals,
  type RepeatedOutcome,
  TRUE_DIFFUSIVITY,
} from "../foundations/repeatedIntervals.ts";
import { empiricalCoverageFraction } from "../physics/reference/inference.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The repeated-experiment view of the error-and-inference lesson
 * (am-found-statistics-inference-pzqv). Its draws must be the reference's own: the same seed and
 * trial count give the same covered count as empiricalCoverageFraction.
 *
 * A .ts file, rendering with createElement: noPhysicsInComponents forbids any .tsx from importing
 * src/physics/reference, and this test needs the reference to check the view against it.
 */

type Drawn = Extract<RepeatedOutcome, { status: "drawn" }>;
const draw = (seed: string, q: number, trials: number): Drawn => {
  const outcome = drawRepeatedIntervals({ seed, q, trials });
  expect(outcome.status).toBe("drawn");
  return outcome as Drawn;
};

describe("the draws are the reference's", () => {
  test("covered counts equal empiricalCoverageFraction for the same seed, q and trials", () => {
    for (const [q, trials] of [
      [100, 20],
      [100, 100],
      [10, 20],
      [10, 100],
    ] as const) {
      const reference = empiricalCoverageFraction({ trials, degreesOfFreedom: q, seed: "1905" });
      expect(reference.kind).toBe("accepted");
      if (reference.kind !== "accepted") continue;
      expect(draw("1905", q, trials).covered).toBe(Math.round(reference.data * trials));
    }
  });

  test("a seed fixes the experiments, and another seed gives others", () => {
    expect(draw("1905", 100, 20).intervals).toEqual(draw("1905", 100, 20).intervals);
    expect(draw("1906", 100, 20).intervals).not.toEqual(draw("1905", 100, 20).intervals);
  });
});

describe("each interval", () => {
  test("brackets its estimate, and covers exactly when it contains the generator's value", () => {
    const d = draw(DEFAULT_SEED, 100, 100);
    for (const r of d.intervals) {
      expect(r.lower).toBeLessThan(r.estimate);
      expect(r.estimate).toBeLessThan(r.upper);
      expect(r.covers).toBe(r.lower <= TRUE_DIFFUSIVITY && TRUE_DIFFUSIVITY <= r.upper);
    }
  });

  test("fewer displacements, wider intervals: q = 10 against q = 100", () => {
    const mean = (d: Drawn) =>
      d.intervals.reduce((s, r) => s + (r.upper - r.lower), 0) / d.intervals.length;
    expect(mean(draw(DEFAULT_SEED, 10, 100)) / mean(draw(DEFAULT_SEED, 100, 100))).toBeGreaterThan(
      2,
    );
  });

  test("over 1000 experiments about 95 in 100 cover, within a prespecified 0.02", () => {
    // Binomial spread at p = 0.95 and n = 1000 is 0.0069, so 0.02 is about three spreads. The seed
    // is fixed, so this is a reproducible check of the procedure, never rerun until it passes.
    const d = draw(DEFAULT_SEED, 100, 1000);
    expect(withinTolerance(d.covered / d.trials, 0.95, { absolute: 0.02 }).ok).toBe(true);
  });
});

describe("refusals", () => {
  test("a bad seed, too few displacements or no experiments are refused with a reason", () => {
    for (const input of [
      { seed: "-1", q: 100, trials: 20 },
      { seed: "abc", q: 100, trials: 20 },
      { seed: "18446744073709551616", q: 100, trials: 20 },
      { seed: "1905", q: 1, trials: 20 },
      { seed: "1905", q: 100, trials: 0 },
    ]) {
      const outcome = drawRepeatedIntervals(input);
      expect(outcome.status).toBe("refused");
    }
  });
});

describe("the construction as served", () => {
  const html = renderToStaticMarkup(createElement(RepeatedIntervals));
  // Tags become spaces: stripped to nothing, "misses" ran into the next row's "Experiment" and a
  // word-bounded count found none.
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
  const d = draw(DEFAULT_SEED, 100, 20);

  test("its first render, before any script runs, counts the default seed's twenty intervals", () => {
    expect(html).toContain('data-foundation-construction="error-and-inference"');
    expect(text).toContain(`${d.covered} of 20 intervals cover ${TRUE_DIFFUSIVITY} μm²/s.`);
    expect(text).toContain(`Seed ${DEFAULT_SEED}, q = 100.`);
    expect((html.match(/class="interval-track"/g) ?? []).length).toBe(20);
  });

  test("a miss is said in words, not only drawn", () => {
    const misses = d.intervals.filter((r) => !r.covers).length;
    // Non-vacuity: the default seed was chosen to show a miss; with none this test proves nothing.
    expect(misses).toBeGreaterThan(0);
    expect((text.match(/\bmisses\b/g) ?? []).length).toBe(misses);
    expect((html.match(/interval-bar-miss/g) ?? []).length).toBe(misses);
  });
});
