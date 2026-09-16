import { describe, expect, test } from "bun:test";
import { BM06_OUTPUTS, BM06_WEAVE_PREDICATES } from "../experiments/bm06/definition.ts";

function mustFind<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

/**
 * am-bm-06-gaussian-spread-982y: "the weave predicates do not exist." This is a structural test
 * over the declared data only -- am-read-result-weave-jex (the weave compiler and evaluator the
 * bead's own acceptance criterion says these predicates must "validate against") does not exist
 * in this repository yet, so nothing here proves these predicates compile or evaluate correctly
 * against a real weave pass. It proves the declared shape matches the bead's own spec and that
 * every outputId a predicate names is a real, currently-published BM06_OUTPUTS key (catching the
 * one class of error a structural test *can* catch: a reference to a quantity that doesn't
 * exist).
 */
describe("BM-06 weave predicate declarations (data only, no real weave compiler exists yet)", () => {
  test("both predicates required by the bead are declared, with stable ids", () => {
    const ids = BM06_WEAVE_PREDICATES.map((p) => p.id);
    expect(ids).toEqual(["bm06-s4-solution", "bm06-s4-grid-agreement"]);
  });

  test("every condition targets either a real BM06_OUTPUTS key or the documented structural field", () => {
    for (const predicate of BM06_WEAVE_PREDICATES) {
      expect(predicate.conditions.length).toBeGreaterThan(0);
      for (const condition of predicate.conditions) {
        if ("field" in condition) {
          expect(condition.field).toBe("simulationTime");
        } else {
          expect(Object.hasOwn(BM06_OUTPUTS, condition.outputId)).toBe(true);
        }
      }
    }
  });

  test("bm06-s4-solution requires a positive elapsed time and two value-status outputs", () => {
    const predicate = mustFind(
      BM06_WEAVE_PREDICATES.find((p) => p.id === "bm06-s4-solution"),
      "bm06-s4-solution predicate",
    );
    expect(predicate.targetSentenceId).toBe("s4-solution");
    const kinds = predicate.conditions.map((c) => c.kind);
    expect(kinds).toEqual(["threshold", "status", "status"]);
    const statusTargets = predicate.conditions
      .filter((c) => c.kind === "status")
      .map((c) => ("outputId" in c ? c.outputId : null));
    expect(statusTargets.sort()).toEqual(["intervalProbability", "probabilityDensity"]);
  });

  test("bm06-s4-grid-agreement carries a hysteresis band on the cell-mass difference threshold", () => {
    const predicate = mustFind(
      BM06_WEAVE_PREDICATES.find((p) => p.id === "bm06-s4-grid-agreement"),
      "bm06-s4-grid-agreement predicate",
    );
    const band = predicate.conditions.find(
      (c) => "outputId" in c && c.outputId === "maxCellMassDifference",
    );
    expect(band).toBeDefined();
    if (band && "value" in band && "exitValue" in band) {
      // The bead: "enters at 9e-4, holds at 1.5e-3, exits at 2.1e-3" -- enter and exit thresholds
      // must differ (a hysteresis band), never a single boundary a noisy value could chatter across.
      expect(band.value).toBeLessThan(band.exitValue as number);
      expect(9e-4).toBeLessThanOrEqual(band.value as number);
      expect(2.1e-3).toBeGreaterThan(band.exitValue as number as number);
    }
  });

  test("declarations are frozen data, not executable predicates -- calling them is not offered", () => {
    for (const predicate of BM06_WEAVE_PREDICATES) {
      expect(Object.isFrozen(predicate)).toBe(true);
      expect(Object.isFrozen(predicate.conditions)).toBe(true);
      expect(typeof (predicate as unknown as { evaluate?: unknown }).evaluate).not.toBe("function");
    }
  });
});
