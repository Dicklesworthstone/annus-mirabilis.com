/**
 * am-ref-constants-xik. Scope note (see src/physics/reference/constants.ts's module docblock for
 * the full reasoning): the four printed-historical papers are NOT registered in this commit --
 * no pinned facsimile for any of them exists anywhere in this repository, and
 * src/testing/diffusion.einsteinPrinted.test.ts (am-ref-diffusion-lr3, already committed) already
 * asserts that einstein-1905-brownian-printed throws. This file tests two things instead: (1) that
 * every printed-historical and reserved set id correctly reports "not registered", naming its real
 * owner; and (2) that the printed-historical entry model -- printedStatus, transcriptionStatus,
 * printed-corrected's required fields, and checkPrintedConsistency's structural checks -- works
 * against fixture sets. None of the fixture values below are claimed as facsimile-checked
 * transcriptions of Einstein's or Planck's papers; they are structural test fixtures only.
 */
import { describe, expect, test } from "bun:test";
import {
  type ConstantEntry,
  ConstantSetError,
  checkPrintedConsistency,
  freezeConstantSet,
  getConstantSet,
  RESERVED_SET_IDS,
} from "../physics/reference/constants.ts";

describe("registry status: every printed-historical and reserved set reports not-registered", () => {
  test("the four printed-historical papers throw constant-set-not-registered, owner am-ref-constants-xik", () => {
    for (const id of [
      "einstein-1905-light-quanta-printed",
      "einstein-1905-brownian-printed",
      "einstein-1905-mass-energy-printed",
      "planck-1900-1901-printed",
    ]) {
      try {
        getConstantSet(id);
        throw new Error(`expected ${id} to throw`);
      } catch (error) {
        expect(error).toBeInstanceOf(ConstantSetError);
        expect((error as ConstantSetError).code).toBe("constant-set-not-registered");
        expect((error as Error).message).toContain("am-ref-constants-xik");
      }
    }
  });

  test("the three dissertation ids are reserved for am-ref-viscosity-suspension-c9lp", () => {
    expect(Object.keys(RESERVED_SET_IDS)).toEqual([
      "einstein-1905-thesis-printed",
      "einstein-1906-dissertation-printed",
      "einstein-1911-correction-printed",
    ]);
    for (const id of Object.keys(RESERVED_SET_IDS)) {
      try {
        getConstantSet(id);
        throw new Error(`expected ${id} to throw`);
      } catch (error) {
        expect((error as ConstantSetError).code).toBe("constant-set-not-registered");
        expect((error as Error).message).toContain("am-ref-viscosity-suspension-c9lp");
      }
    }
  });

  test("an id that is neither registered nor reserved throws the typed unknown-id error", () => {
    try {
      getConstantSet("not-a-real-set-id");
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConstantSetError);
      expect((error as ConstantSetError).code).toBe("unknown-constant-set");
    }
  });

  test("checkPrintedConsistency on a reserved id reports not-available, never passed", () => {
    const report = checkPrintedConsistency("einstein-1905-brownian-printed");
    expect(report.available).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.issues[0]?.code).toBe("not-available");
    expect(report.issues[0]?.message).toContain("am-ref-constants-xik");
  });
});

const printedBase: Omit<ConstantEntry, "quantityId" | "value" | "exactDecimal"> = {
  unit: "1",
  kind: "printed-historical",
  evidentialRole: "measured-observation",
  provenance: "fixture, not a facsimile-checked transcription",
  dependsOn: [],
};

describe("the printed-historical entry model (fixture sets, not registered content)", () => {
  test("printedStatus is required on every printed-historical entry", () => {
    try {
      freezeConstantSet({
        id: "modern-si-2019-will-not-collide",
        kind: "printed-historical",
        era: 1905,
        provenance: "fixture",
        precisionNote: "fixture",
        gasConstantProvenance: "not-applicable",
        entries: [{ ...printedBase, quantityId: "fixtureAlpha", value: 1, exactDecimal: "1" }],
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("missing-printed-status");
      expect((e as Error).message).toContain("requires printedStatus");
    }
  });

  test('printedStatus "printed" requires printedReading', () => {
    try {
      freezeConstantSet({
        id: "scenario-will-not-collide-1",
        kind: "printed-historical",
        era: 1905,
        provenance: "fixture",
        precisionNote: "fixture",
        gasConstantProvenance: "not-applicable",
        entries: [
          {
            ...printedBase,
            quantityId: "fixtureAlpha",
            value: 1,
            exactDecimal: "1",
            printedStatus: "printed",
            transcriptionStatus: "pending-transcription",
          },
        ],
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("printed-missing-reading");
      expect((e as Error).message).toContain("has no printedReading");
    }
  });

  test('printedStatus "editorial-input" requires reason and sensitivity', () => {
    try {
      freezeConstantSet({
        id: "scenario-will-not-collide-2",
        kind: "printed-historical",
        era: 1905,
        provenance: "fixture",
        precisionNote: "fixture",
        gasConstantProvenance: "not-applicable",
        entries: [
          {
            ...printedBase,
            quantityId: "fixtureR",
            value: 8.31e7,
            exactDecimal: "8.31e7",
            printedStatus: "editorial-input",
            transcriptionStatus: "pending-transcription",
          },
        ],
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("editorial-input-missing-fields");
      expect((e as Error).message).toContain("needs reason and sensitivity");
    }

    expect(() =>
      freezeConstantSet({
        id: "scenario-will-not-collide-3",
        kind: "printed-historical",
        era: 1905,
        provenance: "fixture",
        precisionNote: "fixture",
        gasConstantProvenance: "not-applicable",
        entries: [
          {
            ...printedBase,
            quantityId: "fixtureR",
            value: 8.31e7,
            exactDecimal: "8.31e7",
            printedStatus: "editorial-input",
            reason: "not printed; needed by the printed arithmetic",
            sensitivity: "documented in the fixture",
            transcriptionStatus: "pending-transcription",
          },
        ],
      }),
    ).not.toThrow();
  });

  test('a "printed-corrected" entry without receiptRef fails schema validation, matching the printed-exponent decision case', () => {
    try {
      freezeConstantSet({
        id: "scenario-will-not-collide-4",
        kind: "printed-historical",
        era: 1905,
        provenance: "fixture",
        precisionNote: "fixture",
        gasConstantProvenance: "not-applicable",
        entries: [
          {
            ...printedBase,
            quantityId: "fixtureAlpha",
            value: 6.1e-57,
            exactDecimal: "6.1e-57",
            printedStatus: "printed-corrected",
            printedReading: "6,1·10^-56",
            correctedValue: 6.1e-57,
            correctionReason:
              "reproduces the printed N; the printed exponent is ten times too large",
            transcriptionStatus: "pending-transcription",
          },
        ],
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("printed-corrected-missing-fields");
      expect((e as Error).message).toContain(
        "needs printedReading, correctedValue, correctionReason, and receiptRef",
      );
    }
  });

  test('a "transcribed-and-checked" entry without checkedBy/checkedAt fails validation', () => {
    try {
      freezeConstantSet({
        id: "scenario-will-not-collide-5",
        kind: "printed-historical",
        era: 1905,
        provenance: "fixture",
        precisionNote: "fixture",
        gasConstantProvenance: "not-applicable",
        entries: [
          {
            ...printedBase,
            quantityId: "fixtureAlpha",
            value: 1,
            exactDecimal: "1",
            printedStatus: "printed",
            printedReading: "1",
            transcriptionStatus: "transcribed-and-checked",
          },
        ],
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("transcribed-missing-check-metadata");
      expect((e as Error).message).toContain(
        "claims transcribed-and-checked without checkedBy and checkedAt",
      );
    }
  });

  test("a pending-transcription entry validates without checkedBy/checkedAt: this is the honest state for content this bead has not facsimile-checked", () => {
    const set = freezeConstantSet({
      id: "scenario-will-not-collide-6",
      kind: "printed-historical",
      era: 1905,
      provenance: "fixture",
      precisionNote: "fixture",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          ...printedBase,
          quantityId: "fixtureAlpha",
          value: 1,
          exactDecimal: "1",
          printedStatus: "printed",
          printedReading: "1",
          transcriptionStatus: "pending-transcription",
        },
      ],
    });
    expect(set.entries[0]?.transcriptionStatus).toBe("pending-transcription");
  });
});

describe("checkPrintedConsistency: structural checks, not per-paper arithmetic (see this bead's Out of scope)", () => {
  test("a dangling dependsOn is reported by quantity id and named dependency", () => {
    const set = freezeConstantSet({
      id: "scenario-will-not-collide-7",
      kind: "printed-historical",
      era: 1905,
      provenance: "fixture",
      precisionNote: "fixture",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          ...printedBase,
          quantityId: "derivedN",
          value: 1,
          exactDecimal: "1",
          evidentialRole: "theoretical-estimate",
          dependsOn: ["fixtureAlpha", "missingBeta"],
          printedStatus: "printed",
          printedReading: "1",
          transcriptionStatus: "pending-transcription",
        },
        {
          ...printedBase,
          quantityId: "fixtureAlpha",
          value: 1,
          exactDecimal: "1",
          printedStatus: "printed",
          printedReading: "1",
          transcriptionStatus: "pending-transcription",
        },
      ],
    });
    const report = checkPrintedConsistency(set);
    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual({
      quantityId: "derivedN",
      code: "dangling-dependency",
      message:
        'derivedN depends on "missingBeta", which is not an entry of scenario-will-not-collide-7.',
    });
  });

  test("a fully self-consistent fixture set reports ok", () => {
    const set = freezeConstantSet({
      id: "scenario-will-not-collide-8",
      kind: "printed-historical",
      era: 1905,
      provenance: "fixture",
      precisionNote: "fixture",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          ...printedBase,
          quantityId: "derivedN",
          value: 1,
          exactDecimal: "1",
          evidentialRole: "theoretical-estimate",
          dependsOn: ["fixtureAlpha"],
          printedStatus: "printed",
          printedReading: "1",
          transcriptionStatus: "pending-transcription",
        },
        {
          ...printedBase,
          quantityId: "fixtureAlpha",
          value: 1,
          exactDecimal: "1",
          printedStatus: "printed",
          printedReading: "1",
          transcriptionStatus: "pending-transcription",
        },
      ],
    });
    expect(checkPrintedConsistency(set)).toEqual({
      setId: set.id,
      available: true,
      ok: true,
      issues: [],
    });
  });
});
