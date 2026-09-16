import { describe, expect, test } from "bun:test";
import { checkVoice } from "../content/checks/voice/index.ts";
import {
  constantValue,
  ConstantSetError,
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
  evidentialRole: "declared-input",
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
    try {
      fixtureSet([{ ...baseEntry, kind: "exact-defined", evidentialRole: "declared-input" }]);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("invalid-evidential-role");
      expect((e as Error).message).toContain("Exact definition required");
    }

    try {
      fixtureSet([{ ...baseEntry, kind: "declared-scenario", evidentialRole: "defined-exact" }]);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("invalid-evidential-role");
      expect((e as Error).message).toContain("Declared inputs are not SI definitions");
    }
  });

  test("evidentialRole declared-input requires kind declared-scenario and rejects measured or printed-historical kinds", () => {
    try {
      fixtureSet([
        { ...baseEntry, kind: "measured", evidentialRole: "declared-input", uncertainty: 0.1 },
      ]);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("invalid-evidential-role");
      expect((e as Error).message).toContain(
        "A chosen scenario input cannot stand in for a measurement",
      );
    }

    try {
      fixtureSet([
        {
          ...baseEntry,
          kind: "printed-historical",
          evidentialRole: "declared-input",
          printedStatus: "printed",
          printedReading: "1",
          transcriptionStatus: "pending-transcription",
        },
      ]);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("invalid-evidential-role");
      expect((e as Error).message).toContain(
        "A chosen scenario input cannot stand in for a measurement",
      );
    }
  });

  test("kind measured requires measured-observation or fitted-constant and uncertainty", () => {
    try {
      fixtureSet([
        {
          ...baseEntry,
          kind: "measured",
          evidentialRole: "theoretical-estimate",
          dependsOn: ["x"],
          uncertainty: 1,
        },
      ]);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("invalid-evidential-role");
    }

    try {
      fixtureSet([
        { ...baseEntry, kind: "measured", evidentialRole: "measured-observation" }, // missing uncertainty
      ]);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("measured-missing-uncertainty");
      expect((e as Error).message).toContain("requires uncertainty");
    }

    expect(() =>
      fixtureSet([
        { ...baseEntry, kind: "measured", evidentialRole: "fitted-constant", uncertainty: 0.1 },
      ]),
    ).not.toThrow();

    expect(() =>
      fixtureSet([
        {
          ...baseEntry,
          kind: "measured",
          evidentialRole: "measured-observation",
          uncertainty: 0.05,
        },
      ]),
    ).not.toThrow();
  });

  test("theoretical-estimate, illustrative-computation, or correction requires a non-empty dependsOn", () => {
    for (const role of [
      "theoretical-estimate",
      "illustrative-computation",
      "correction",
    ] as const) {
      try {
        fixtureSet([{ ...baseEntry, evidentialRole: role, dependsOn: [] }]);
        throw new Error(`expected throw for role ${role}`);
      } catch (e) {
        expect(e).toBeInstanceOf(ConstantSetError);
        expect((e as ConstantSetError).code).toBe("missing-dependency");
        expect((e as Error).message).toContain("must name its inputs");
      }

      expect(() =>
        fixtureSet([
          { ...baseEntry, quantityId: "inputA", evidentialRole: "declared-input" },
          { ...baseEntry, quantityId: "derived", evidentialRole: role, dependsOn: ["inputA"] },
        ]),
      ).not.toThrow();
    }
  });
});

describe("illustrative-value-as-input", () => {
  test("a consumer reading an illustrative-computation entry as an input fails, naming the real inputs", () => {
    const set = fixtureSet([
      { ...baseEntry, quantityId: "rawInput", evidentialRole: "declared-input" },
      {
        ...baseEntry,
        quantityId: "illustrativeDisplacement",
        evidentialRole: "illustrative-computation",
        dependsOn: ["rawInput"],
      },
    ]);
    try {
      constantValue(set, "illustrativeDisplacement");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("illustrative-value-as-input");
      expect((e as Error).message).toContain("computed illustration, not an input; use rawInput");
    }
    expect(() => constantValue(set, "rawInput")).not.toThrow();
  });
});

describe("printedReadingOf", () => {
  test("returns the printed reading for printed and printed-corrected entries, and a label for others", () => {
    expect(
      printedReadingOf({
        ...baseEntry,
        kind: "printed-historical",
        printedStatus: "printed",
        printedReading: "6,17·10^23",
      }),
    ).toBe("6,17·10^23");
    expect(
      printedReadingOf({
        ...baseEntry,
        kind: "printed-historical",
        printedStatus: "editorial-input",
      }),
    ).toBe("(not printed; editorial input)");
    expect(printedReadingOf(baseEntry)).toBe("(not a printed-historical entry)");
  });
});

describe("evidentialRoleText: one authored phrase per role, passing the voice lint", () => {
  const roles: ConstantEntry["evidentialRole"][] = [
    "defined-exact",
    "declared-input",
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
          evidentialRole: "measured-observation",
          printedStatus: "printed",
          printedReading: "x",
          transcriptionStatus: "pending-transcription",
          printedRegion: { x: 12, y: 40, width: 18, height: 3 },
        },
      ]),
    ).not.toThrow();
  });

  test("a region exceeding the page bounds fails, naming the bound", () => {
    try {
      fixtureSet([
        {
          ...baseEntry,
          kind: "printed-historical",
          evidentialRole: "measured-observation",
          printedStatus: "printed",
          printedReading: "x",
          transcriptionStatus: "pending-transcription",
          printedRegion: { x: 90, y: 0, width: 20, height: 3 },
        },
      ]);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("invalid-printed-region");
      expect((e as Error).message).toContain("out-of-bounds printedRegion");
    }
  });
});
