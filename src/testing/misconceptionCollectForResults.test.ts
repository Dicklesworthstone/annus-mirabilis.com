import { describe, expect, test } from "bun:test";
import {
  collectForResults,
  forPaper,
  withoutAResult,
} from "../reader/misconceptions/collectForResults.ts";
import {
  fixtureHalvingDiffusivity,
  fixtureLengthContraction,
  fixtureStaticTreatmentOnly,
} from "../reader/misconceptions/fixtures.ts";

/**
 * am-read-misconception-callouts-a3o: "On the results face, each result card lists the
 * misconceptions linked to it ... Entries without a result appear inline and in the paper list
 * only."
 */
const all = [fixtureHalvingDiffusivity, fixtureLengthContraction, fixtureStaticTreatmentOnly];

describe("collectForResults", () => {
  test("groups by every resultId an entry names, including entries that concern more than one result", () => {
    const grouped = collectForResults(all);
    expect(grouped.get("bm-displacement-law")).toEqual([
      fixtureHalvingDiffusivity,
      fixtureStaticTreatmentOnly,
    ]);
    expect(grouped.get("bm-molecular-number")).toEqual([fixtureStaticTreatmentOnly]);
  });

  test("an entry with no resultIds contributes no grouping entry", () => {
    const grouped = collectForResults(all);
    expect(grouped.has("")).toBe(false);
    for (const list of grouped.values()) {
      expect(list.includes(fixtureLengthContraction)).toBe(false);
    }
  });

  test("an empty input yields an empty map", () => {
    expect(collectForResults([]).size).toBe(0);
  });
});

describe("withoutAResult", () => {
  test("returns exactly the entries with an empty resultIds array", () => {
    const orphaned = withoutAResult(all);
    expect(orphaned).toEqual([fixtureLengthContraction]);
  });

  test("returns an empty array when every entry names a result", () => {
    expect(withoutAResult([fixtureHalvingDiffusivity, fixtureStaticTreatmentOnly])).toEqual([]);
  });
});

describe("forPaper", () => {
  test("filters to entries for exactly the named paper, in declaration order", () => {
    expect(forPaper(all, "brownian-motion")).toEqual([
      fixtureHalvingDiffusivity,
      fixtureStaticTreatmentOnly,
    ]);
    expect(forPaper(all, "special-relativity")).toEqual([fixtureLengthContraction]);
  });

  test("an unknown paper yields an empty array, not an error", () => {
    expect(forPaper(all, "mass-energy")).toEqual([]);
  });
});
