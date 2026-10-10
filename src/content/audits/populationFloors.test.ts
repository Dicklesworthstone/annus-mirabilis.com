/**
 * THE POPULATION FLOORS, DRIVEN (am-rc1001-bridge-plan-pcjk.10, am-4k0m).
 *
 * `verify-content` feeds the compiler four families that no lane had ever compiled: 4 journey
 * records, 453 source blocks, 821 translation units, 4 alignments and 4 alias files. Nine checks
 * depend on them, and every one of those checks reported CLEAN while its population was empty.
 * The floors exist so that state cannot come back quietly, and they are here as functions rather
 * than inline in the `loadFiles` config literal for two reasons: a literal cannot be called, so
 * the refusals had no way to be exercised and the untested-refusal ratchet counted them as
 * undeclared debt; and a floor nobody has seen fire is a floor nobody has checked.
 *
 * Each refusal carries its code as the FIRST constructor argument, per the owner's ruling on
 * am-p465, which is also the only shape `scanRefusalThrowSites` reads.
 */
import { describe, expect, test } from "bun:test";
import {
  assertEditionPopulation,
  assertJourneyPopulation,
  EQUATION_BLOCK_FLOOR,
  PopulationFloorError,
} from "./verifyContent.ts";

/** The refusal a call raises, or null when it was admitted. */
function refusalFrom(run: () => void): PopulationFloorError | null {
  try {
    run();
    return null;
  } catch (error) {
    if (error instanceof PopulationFloorError) return error;
    throw error;
  }
}

describe("verify-content's population floors", () => {
  test("journey-records-absent: the directory exists and yielded nothing", () => {
    const refusal = refusalFrom(() => assertJourneyPopulation(true, 0));
    expect(refusal?.code).toBe("journey-records-absent");
    expect(refusal?.message).toContain("report clean");
    // The boundary in BOTH directions, because a floor that always fires is as useless as one
    // that never does. A populated directory is admitted...
    expect(refusalFrom(() => assertJourneyPopulation(true, 4))).toBeNull();
    // ...and so is a repository with no content/journeys at all, which is a legitimate zero
    // rather than a wiring fault: the refusal is about a directory that exists and read empty.
    expect(refusalFrom(() => assertJourneyPopulation(false, 0))).toBeNull();
  });

  test("edition-layer-absent: no block, unit or alignment was read", () => {
    const refusal = refusalFrom(() => assertEditionPopulation(0, 0));
    expect(refusal?.code).toBe("edition-layer-absent");
    expect(refusal?.message).toContain("report clean");
  });

  test("equation-population-below-floor: half a glob is not a clean result", () => {
    // The defect this one exists for: 150 pairs compared with 0 differences and 200 pairs
    // compared with 0 differences print the same verdict, and only one of them is a result.
    const refusal = refusalFrom(() => assertEditionPopulation(1278, EQUATION_BLOCK_FLOOR - 1));
    expect(refusal?.code).toBe("equation-population-below-floor");
    expect(refusal?.message).toContain("reads exactly like a clean result");
    expect(refusal?.message).toContain(String(EQUATION_BLOCK_FLOOR - 1));
    // Exactly at the floor is admitted, so the comparison is `<` and not `<=`.
    expect(refusalFrom(() => assertEditionPopulation(1278, EQUATION_BLOCK_FLOOR))).toBeNull();
    // And above it, because the corpus grows and a floor is not a ceiling.
    expect(refusalFrom(() => assertEditionPopulation(1278, EQUATION_BLOCK_FLOOR + 50))).toBeNull();
  });

  test("the floor is the measured corpus, not a round number", () => {
    // 7 + 52 + 43 + 98 printed displays across the four papers
    // (content/display-terms/<paper>.yaml). Stated here so a future change to this constant has
    // to say which measurement replaced it.
    expect(EQUATION_BLOCK_FLOOR).toBe(7 + 52 + 43 + 98);
  });

  test("the refusals are a PopulationFloorError, which is what puts the code first", () => {
    // Not decoration: `scanRefusalThrowSites` credits `throw new SomethingError("kebab", ...)`
    // and sees nothing when the code is the last argument, so these three would count as bare
    // throws under any other shape.
    const refusal = new PopulationFloorError("some-code", "m");
    expect(refusal instanceof Error).toBe(true);
    expect(refusal.name).toBe("PopulationFloorError");
    expect(refusal.name.endsWith("Error")).toBe(true);
    expect(refusal.code).toBe("some-code");
  });
});
