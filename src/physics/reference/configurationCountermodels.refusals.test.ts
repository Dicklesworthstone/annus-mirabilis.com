/**
 * Every refusal the occupancy model raises, driven through its real site (am-muyh's bare-throw
 * ratchet; dispatch 92). Each case asserts the code AND the message: the message is what a reader
 * sees in the independence workbench, and the code is how refusalRatchet finds the site.
 */
import { describe, expect, test } from "bun:test";
import {
  compareOccupancyEvidence,
  distinguishOccupancy,
  MAX_OCCUPANCY_POINTS,
  MAX_OCCUPANCY_TRIALS,
  type OccupancyCheck,
  OccupancyModelError,
  validateOccupancySettings,
} from "./configurationCountermodels.ts";

function refusalFrom(run: () => unknown): OccupancyModelError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(OccupancyModelError);
    return error as OccupancyModelError;
  }
  throw new Error("expected an OccupancyModelError, and nothing was thrown");
}

const FOUR_POINTS_HALF = { n: 4, quarters: 2 };

describe("occupancy model refusals", () => {
  test("settings-not-plain-record: a non-object or a class instance is refused", () => {
    for (const value of [null, 4, "n=4", new Date()]) {
      const error = refusalFrom(() => validateOccupancySettings(value));
      expect(error.code).toBe("settings-not-plain-record");
      expect(error.message).toBe("Use a plain occupancy-settings record.");
    }
  });

  test("settings-unknown-fields: a third field is refused", () => {
    const error = refusalFrom(() => validateOccupancySettings({ n: 4, quarters: 2, seed: 1 }));
    expect(error.code).toBe("settings-unknown-fields");
    expect(error.message).toBe("Settings must contain only point count and volume quarters.");
  });

  test("point-count-out-of-range: zero, a fraction and one past the limit are refused", () => {
    for (const n of [0, 2.5, MAX_OCCUPANCY_POINTS + 1]) {
      const error = refusalFrom(() => validateOccupancySettings({ n, quarters: 2 }));
      expect(error.code).toBe("point-count-out-of-range");
      expect(error.message).toBe(`Use an integer point count from 1 to ${MAX_OCCUPANCY_POINTS}.`);
    }
    expect(validateOccupancySettings({ n: MAX_OCCUPANCY_POINTS, quarters: 2 }).n).toBe(
      MAX_OCCUPANCY_POINTS,
    );
  });

  test("volume-quarters-out-of-range: five quarters is refused, four is admitted", () => {
    const error = refusalFrom(() => validateOccupancySettings({ n: 4, quarters: 5 }));
    expect(error.code).toBe("volume-quarters-out-of-range");
    expect(error.message).toBe("Choose 0, 1, 2, 3 or 4 quarters of the volume.");
    expect(validateOccupancySettings({ n: 4, quarters: 4 }).quarters).toBe(4);
  });

  test("checks-invalid: an unknown or repeated check is refused", () => {
    for (const checks of [["bogus"], ["mean-count", "mean-count"]]) {
      const error = refusalFrom(() =>
        distinguishOccupancy(FOUR_POINTS_HALF, checks as unknown as OccupancyCheck[]),
      );
      expect(error.code).toBe("checks-invalid");
      expect(error.message).toBe("Choose unique, known occupancy checks.");
    }
  });

  test("frequency-count-mismatch: four points need five frequencies", () => {
    const error = refusalFrom(() => compareOccupancyEvidence(FOUR_POINTS_HALF, [1, 2, 3]));
    expect(error.code).toBe("frequency-count-mismatch");
    expect(error.message).toBe("Supply exactly 5 frequencies, for counts 0 through 4.");
  });

  test("frequency-not-nonnegative-integer: a negative, a fraction and a hole are refused", () => {
    const holey = [1, 2, 3, 4, 5];
    delete (holey as (number | undefined)[])[2];
    for (const counts of [[1, -1, 0, 0, 0], [1, 0.5, 0, 0, 0], holey]) {
      const error = refusalFrom(() => compareOccupancyEvidence(FOUR_POINTS_HALF, counts));
      expect(error.code).toBe("frequency-not-nonnegative-integer");
      expect(error.message).toBe(
        "Each frequency must be a nonnegative integer; missing bins are not zero.",
      );
    }
  });

  test("placements-over-limit: one placement past the limit is refused", () => {
    const error = refusalFrom(() =>
      compareOccupancyEvidence(FOUR_POINTS_HALF, [MAX_OCCUPANCY_TRIALS, 1, 0, 0, 0]),
    );
    expect(error.code).toBe("placements-over-limit");
    expect(error.message).toBe(`Use at most ${MAX_OCCUPANCY_TRIALS} repeat placements.`);
    expect(
      compareOccupancyEvidence(FOUR_POINTS_HALF, [MAX_OCCUPANCY_TRIALS, 0, 0, 0, 0]).trials,
    ).toBe(MAX_OCCUPANCY_TRIALS);
  });

  test("record-empty: an all-zero record is not evidence", () => {
    const error = refusalFrom(() => compareOccupancyEvidence(FOUR_POINTS_HALF, [0, 0, 0, 0, 0]));
    expect(error.code).toBe("record-empty");
    expect(error.message).toBe("An empty record is not evidence. Enter at least one placement.");
  });
});
