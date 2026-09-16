import { describe, expect, test } from "bun:test";
import { checkObservationInterval, type ReplayGrid } from "./replayGrid.ts";

const grid: ReplayGrid = Object.freeze({ baseSpacingSeconds: 0.25, storedHorizonSeconds: 2.5 });

describe("checkObservationInterval: supported multiples", () => {
  test("the base spacing itself is accepted", () => {
    expect(checkObservationInterval(grid, 0.25, "observationInterval")).toEqual({ accepted: true });
  });

  test("an interior positive integer multiple is accepted", () => {
    expect(checkObservationInterval(grid, 1.0, "observationInterval")).toEqual({ accepted: true });
  });

  test("the exact horizon (itself a clean multiple) is accepted", () => {
    expect(checkObservationInterval(grid, 2.5, "observationInterval")).toEqual({ accepted: true });
  });
});

describe("checkObservationInterval: off-grid refusal", () => {
  test("an interval between two supported multiples is refused with off-replay-grid and both repairs", () => {
    const decision = checkObservationInterval(grid, 0.6, "observationInterval");
    expect(decision.accepted).toBe(false);
    if (decision.accepted) throw new Error("unreachable");
    expect(decision.refusal.code).toBe("off-replay-grid");
    expect(decision.refusal.affected.parameterIds).toEqual(["observationInterval"]);
    expect(decision.refusal.rankedRepairs).toHaveLength(2);
    expect(decision.refusal.rankedRepairs[0]?.action?.value).toBeCloseTo(0.5, 10);
    expect(decision.refusal.rankedRepairs[1]?.action?.value).toBeCloseTo(0.75, 10);
  });

  test("an interval below the base spacing has no 'below' repair, only 'above'", () => {
    const decision = checkObservationInterval(grid, 0.1, "observationInterval");
    expect(decision.accepted).toBe(false);
    if (decision.accepted) throw new Error("unreachable");
    expect(decision.refusal.rankedRepairs).toHaveLength(1);
    expect(decision.refusal.rankedRepairs[0]?.action?.value).toBeCloseTo(0.25, 10);
    expect(decision.refusal.rankedRepairs[0]?.label).toContain("above");
  });

  test("an interval past the stored horizon has no 'above' repair, only 'below'", () => {
    const decision = checkObservationInterval(grid, 3.5, "observationInterval");
    expect(decision.accepted).toBe(false);
    if (decision.accepted) throw new Error("unreachable");
    expect(decision.refusal.rankedRepairs).toHaveLength(1);
    expect(decision.refusal.rankedRepairs[0]?.action?.value).toBeCloseTo(2.5, 10);
    expect(decision.refusal.rankedRepairs[0]?.label).toContain("below");
  });

  test("zero and negative requested intervals are refused, never accepted", () => {
    expect(checkObservationInterval(grid, 0, "observationInterval").accepted).toBe(false);
    expect(checkObservationInterval(grid, -1, "observationInterval").accepted).toBe(false);
  });

  test("the refusal's details record the requested interval and the grid it was checked against", () => {
    const decision = checkObservationInterval(grid, 0.6, "observationInterval");
    expect(decision.accepted).toBe(false);
    if (decision.accepted) throw new Error("unreachable");
    expect(decision.refusal.details).toEqual({
      requestedIntervalSeconds: 0.6,
      baseSpacingSeconds: 0.25,
      storedHorizonSeconds: 2.5,
    });
  });
});

describe("checkObservationInterval: grid validation", () => {
  test("a non-positive base spacing throws", () => {
    expect(() =>
      checkObservationInterval(
        { baseSpacingSeconds: 0, storedHorizonSeconds: 1 },
        0.5,
        "observationInterval",
      ),
    ).toThrow();
  });

  test("a horizon shorter than the base spacing throws", () => {
    expect(() =>
      checkObservationInterval(
        { baseSpacingSeconds: 1, storedHorizonSeconds: 0.5 },
        0.5,
        "observationInterval",
      ),
    ).toThrow();
  });
});
