import { describe, expect, test } from "bun:test";
import { checkVoice } from "../content/checks/voice/index.ts";
import {
  constantValue,
  type ConstantEntry,
  evidentialRoleText,
  freezeConstantSet,
  printedReadingOf,
} from "../physics/reference/constants.ts";

const baseEntry: ConstantEntry = Object.freeze({
  quantityId: "testQuantity",
  value: 1,
  exactDecimal: "1",
  unit: "1",
  kind: "declared-scenario",
  evidentialRole: "measured-observation",
  provenance: "fixture",
  dependsOn: [],
});

function fixtureSet(entries: readonly ConstantEntry[]) {
  return freezeConstantSet({
    id: "scenario-roles-fixture",
    kind: "declared-scenario",
    era: 2024,
    provenance: "fixture",
    precisionNote: "fixture",
    gasConstantProvenance: "not-applicable",
    entries,
  });
}

describe("evidentialRole consistency rules", () => {
  test("kind exact-defined requires evidentialRole defined-exact, and no other role may use it", () => {
    expect(() =>
      fixtureSet([{ ...baseEntry, kind: "exact-defined", evidentialRole: "measured-observation" }]),
    ).toThrow(/invalid-evidential-role/);
    expect(() =>
      fixtureSet([{ ...baseEntry, kind: "declared-scenario", evidentialRole: "defined-exact" }]),
    ).toThrow(/invalid-evidential-role/);
  });

  test("kind measured requires measured-observation or fitted-constant", () => {
    expect(() =>
      fixtureSet([
        { ...baseEntry, kind: "measured", evidentialRole: "theoretical-estimate", dependsOn: ["x"], uncertainty: 1 },
      ]),
    ).toThrow(/invalid-evidential-role/);
    expect(() =>
      fixtureSet([{ ...baseEntry, kind: "measured", evidentialRole: "fitted-constant", uncertainty: 0.1 }]),
    ).not.toThrow();
  });

  test("theoretical-estimate, illustrative-computation, or correction requires a non-empty dependsOn", () => {
    for (const role of ["theoretical-estimate", "illustrative-computation", "correction"] as const) {
      expect(() => fixtureSet([{ ...baseEntry, evidentialRole: role, dependsOn: [] }])).toThrow(
        /missing-dependency/,
      );
      expect(() =>
        fixtureSet([
          { ...baseEntry, quantityId: "inputA", evidentialRole: "measured-observation", uncertainty: 1 },
          { ...baseEntry, quantityId: "derived", evidentialRole: role, dependsOn: ["inputA"] },
        ]),
      ).not.toThrow();
    }
  });
});

describe("illustrative-value-as-input", () => {
  test("a consumer reading an illustrative-computation entry as an input fails, naming the real inputs", () => {
    const set = fixtureSet([
      { ...baseEntry, quantityId: "rawInput", evidentialRole: "measured-observation", uncertainty: 1 },
      {
        ...baseEntry,
        quantityId: "illustrativeDisplacement",
        evidentialRole: "illustrative-computation",
        dependsOn: ["rawInput"],
      },
    ]);
    expect(() => constantValue(set, "illustrativeDisplacement")).toThrow(/illustrative-value-as-input/);
    expect(() => constantValue(set, "rawInput")).not.toThrow();
  });
});

describe("printedReadingOf", () => {
  test("returns the printed reading for printed and printed-corrected entries, and a label for others", () => {
    expect(
      printedReadingOf({ ...baseEntry, kind: "printed-historical", printedStatus: "printed", printedReading: "6,17·10^23" }),
    ).toBe("6,17·10^23");
    expect(printedReadingOf({ ...baseEntry, kind: "printed-historical", printedStatus: "editorial-input" })).toBe(
      "(not printed; editorial input)",
    );
    expect(printedReadingOf(baseEntry)).toBe("(not a printed-historical entry)");
  });
});

describe("evidentialRoleText: one authored phrase per role, passing the voice lint", () => {
  const roles: ConstantEntry["evidentialRole"][] = [
    "defined-exact",
    "measured-observation",
    "fitted-constant",
    "theoretical-estimate",
    "illustrative-computation",
    "correction",
  ];

  test("every role has a distinct authored phrase", () => {
    const phrases = roles.map((role) => evidentialRoleText({ ...baseEntry, evidentialRole: role }));
    expect(new Set(phrases).size).toBe(roles.length);
  });

  test("every phrase passes checkVoice at context 'prose'", () => {
    for (const role of roles) {
      const phrase = evidentialRoleText({ ...baseEntry, evidentialRole: role });
      expect(checkVoice(phrase, { context: "prose" })).toEqual([]);
    }
  });
});

describe("printedRegion validation", () => {
  test("a region within bounds validates", () => {
    expect(() =>
      fixtureSet([
        {
          ...baseEntry,
          kind: "printed-historical",
          printedStatus: "printed",
          printedReading: "x",
          transcriptionStatus: "pending-transcription",
          printedRegion: { x: 12, y: 40, width: 18, height: 3 },
        },
      ]),
    ).not.toThrow();
  });

  test("a region exceeding the page bounds fails, naming the bound", () => {
    expect(() =>
      fixtureSet([
        {
          ...baseEntry,
          kind: "printed-historical",
          printedStatus: "printed",
          printedReading: "x",
          transcriptionStatus: "pending-transcription",
          printedRegion: { x: 90, y: 0, width: 20, height: 3 },
        },
      ]),
    ).toThrow(/invalid-printed-region/);
  });
});
