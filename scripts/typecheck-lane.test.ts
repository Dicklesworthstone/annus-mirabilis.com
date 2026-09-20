import { describe, expect, test } from "bun:test";
import { CATALOGUE_IDS, REGISTERED_IDS } from "../src/experiments/catalogue.ts";
import { familyPaper } from "../src/search/documents.ts";
import {
  checkInstrumentPaperMapping,
  checkTypes,
  countTypeErrors,
  formatLane,
} from "./typecheck-lane.ts";

/**
 * am-14js criterion 5. Both outages of 2026-09-20 are driven here, with their REAL identifiers and
 * their real compiler output rather than synthetic stand-ins, because a lane that only catches
 * invented faults has not been shown to catch the ones that happened.
 *
 *     ad92ef0b  light-thread registered with no search-paper mapping
 *     dacd28fd  TS7053 at src/experiments/avogadro/session.ts(94,115)
 *
 * Each must turn the lane red, and each must turn red for its OWN reason: the whole defect being
 * repaired is that `bun run typecheck` exits 1 for both causes and names neither.
 */
describe("the typecheck lane turns red on both historical outages", () => {
  /**
   * THE HISTORICAL ID NO LONGER REPRODUCES IT, and saying so is part of the evidence. 76ee7230,
   * "a registered instrument's paper comes from the declared taxonomy, not a prefix", widened the
   * grammar, so familyPaper("light-thread") now returns "cross-paper" and the specific instance is
   * repaired. Asserting that the real id fails would be a test that can never go red.
   *
   * The CLASS is intact: any registered id the grammar does not accept still maps to null and still
   * makes documentsFromCompiled throw. Measured today: "a-brand-new-lab", "lightThread" and "xx-99"
   * all map to null. The check is driven with one of those, and the repair of the original is
   * asserted beside it so a future widening of this test cannot quietly lose either fact.
   */
  test("ad92ef0b's shape: a catalogue id the grammar rejects fails the registry check", () => {
    expect(familyPaper("light-thread")).toBe("cross-paper"); // repaired by 76ee7230
    expect(familyPaper("a-brand-new-lab")).toBeNull(); // the class, still live

    const check = checkInstrumentPaperMapping(["bm-01", "a-brand-new-lab"], () => "registered");
    expect(check.ok).toBe(false);
    expect(check.detail).toContain("a-brand-new-lab");
    expect(check.detail).toContain("search index build throw");
  });

  /**
   * The real shape, over the real catalogue. ad92ef0b added light-thread to CATALOGUE_STATUS
   * without adding it to NON_CORE_INSTRUMENT_IDS, so parseInstrumentId rejected it and the search
   * index build threw. This asserts the invariant that was missing, over every id the catalogue
   * actually holds, rather than over a list assembled in the test.
   */
  test("every id the real catalogue holds maps to a search paper", () => {
    const check = checkInstrumentPaperMapping();
    expect(check.ok).toBe(true);
    // all of them, not the registered slice: an id is an id whether or not it is registered
    expect(check.detail).toContain(`${CATALOGUE_IDS.length} catalogue ids`);
    expect(CATALOGUE_IDS.filter((id) => familyPaper(id) === null)).toEqual([]);
    // and the population is bigger than the registered slice, so the widening is not cosmetic
    expect(CATALOGUE_IDS.length).toBeGreaterThan(REGISTERED_IDS.length);
  });

  /**
   * The vacuity guard, written for the same reason as the one in registryDispatch.test.ts: "every
   * id maps" over an empty catalogue is true and establishes nothing. Without this, a catalogue
   * that failed to load would report the check PASSING.
   */
  test("an empty catalogue fails the check rather than passing it vacuously", () => {
    const check = checkInstrumentPaperMapping([], () => "registered");
    expect(check.ok).toBe(false);
    expect(check.detail).toContain("vacuously true");
    expect(check.detail).toContain("failed to load");
  });

  test("dacd28fd: the real TS7053 output fails the types check and is counted", () => {
    const historical =
      "src/experiments/avogadro/session.ts(94,115): error TS7053: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type 'Readonly<{ readonly alphaScale: number; }> | Readonly<{}>'.\n" +
      "  No index signature with a parameter of type 'string' was found on type 'Readonly<{}>'.\n";
    expect(countTypeErrors(historical)).toBe(1);
    const check = checkTypes(() => ({ status: 1, output: historical }));
    expect(check.ok).toBe(false);
    expect(check.detail).toContain("1 type error");
    expect(check.detail).toContain("TS7053");
  });

  test("THE CONTROL: a clean tree passes both checks, so the lane is satisfiable", () => {
    const registry = checkInstrumentPaperMapping(["bm-01", "sr-03"], () => "registered");
    const types = checkTypes(() => ({ status: 0, output: "" }));
    expect(registry.ok).toBe(true);
    expect(types.ok).toBe(true);
    expect(formatLane([registry, types])).toContain("2 of 2 checks passed");
  });

  /**
   * The distinction the existing gate cannot make. `bun run typecheck` exited 1 during the
   * light-thread outage having printed no "error TS" line at all, because prepare:content threw and
   * tsc never ran, and the exit code alone said "typecheck failed".
   */
  test("an exit code with no compiler error is reported as the compiler not running, not as a type error", () => {
    const chainFailure =
      "TypeError: Registered instrument needs a search paper mapping: light-thread.\n" +
      "  at documentsFromCompiled (src/search/documents.ts:257:17)\n";
    expect(countTypeErrors(chainFailure)).toBe(0);
    const check = checkTypes(() => ({ status: 1, output: chainFailure }));
    expect(check.ok).toBe(false);
    expect(check.detail).toContain("failing to RUN, not the types failing");
    expect(check.detail).not.toContain("type error(s)");
  });

  test("the registry check states its denominator rather than only its verdict", () => {
    // shelf-fizeau is in-preparation and is in the grammar's non-core list, so it belongs to the
    // population and maps. The detail reports the whole catalogue with the registered count beside
    // it, rather than reporting only the registered slice as the population.
    const check = checkInstrumentPaperMapping(["bm-01", "sr-03", "shelf-fizeau"], (id) =>
      id === "shelf-fizeau" ? "in-preparation" : "registered",
    );
    expect(check.ok).toBe(true);
    expect(check.detail).toContain("3 catalogue ids (2 registered)");
  });

  /**
   * The widening, asserted as a behaviour change rather than left implicit. Before, the check
   * filtered to registered ids and an in-preparation id the grammar rejects passed. It does not now:
   * well-formedness does not depend on status, and src/content/anchors.ts parses ids without
   * consulting one.
   */
  test("an in-preparation id the grammar rejects fails too, not just a registered one", () => {
    const check = checkInstrumentPaperMapping(["bm-01", "future-idea"], (id) =>
      id === "future-idea" ? "in-preparation" : "registered",
    );
    expect(check.ok).toBe(false);
    expect(check.detail).toContain("future-idea");
    expect(check.detail).toContain("1 of 2 catalogue id(s)");
  });
});
