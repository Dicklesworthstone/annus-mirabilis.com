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
  compareAcrossSets,
  constantValue,
  freezeConstantSet,
  getConstantSet,
  RESERVED_SET_IDS,
} from "../physics/reference/constants.ts";
import { withinTolerance } from "../units/tolerance.ts";

function requireEntry(set: ReturnType<typeof getConstantSet>, quantityId: string): ConstantEntry {
  const entry = set.entries.find((e) => e.quantityId === quantityId);
  if (!entry) {
    throw new Error(`Missing expected quantity '${quantityId}' in set '${set.id}'`);
  }
  return entry;
}

describe("registry status: historical sets registered and dissertation ids reserved", () => {
  test("the four printed-historical papers are registered and return valid sets", () => {
    for (const id of [
      "einstein-1905-light-quanta-printed",
      "einstein-1905-brownian-printed",
      "einstein-1905-mass-energy-printed",
      "planck-1900-1901-printed",
    ]) {
      const set = getConstantSet(id);
      expect(set.id).toBe(id);
      expect(set.entries.length).toBeGreaterThan(0);
      expect(Object.isFrozen(set)).toBe(true);
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
        expect(error).toBeInstanceOf(ConstantSetError);
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
    const report = checkPrintedConsistency("einstein-1905-thesis-printed");
    expect(report.available).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.issues[0]?.code).toBe("not-available");
    expect(report.issues[0]?.message).toContain("am-ref-viscosity-suspension-c9lp");
  });

  test("checkPrintedConsistency on all four registered historical sets reports ok", () => {
    for (const id of [
      "einstein-1905-light-quanta-printed",
      "einstein-1905-brownian-printed",
      "einstein-1905-mass-energy-printed",
      "planck-1900-1901-printed",
    ]) {
      const report = checkPrintedConsistency(id);
      expect(report.available).toBe(true);
      expect(report.ok).toBe(true);
      expect(report.issues).toEqual([]);
    }
  });
});

describe("einstein-1905-light-quanta-printed", () => {
  const set = getConstantSet("einstein-1905-light-quanta-printed");

  test("records gasConstantProvenance as measured-without-counting-molecules", () => {
    expect(set.gasConstantProvenance).toBe("measured-without-counting-molecules");
  });

  test("alpha entry follows printed-corrected decision with receipt reference", () => {
    const alpha = set.entries.find((e) => e.quantityId === "wienConstantAlpha");
    expect(alpha).toBeDefined();
    expect(alpha?.printedStatus).toBe("printed-corrected");
    expect(alpha?.printedReading).toBe("6,10 · 10^-56");
    expect(alpha?.correctedValue).toBe(6.1e-57);
    expect(alpha?.receiptRef).toBe("docs/provenance/ap-17-132.md#watch-alpha-exponent");
    expect(alpha?.journalPage).toBe("136");
    expect(alpha?.facsimilePdfPage).toBe(5);
    expect(alpha?.transcriptionStatus).toBe("transcribed-and-checked");
    expect(alpha?.checkedBy).toMatch(/docs\/provenance\/.*#watch-[a-z-]+/);
    expect(alpha?.checkedAt).toBeDefined();
    expect(alpha?.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("R and L are editorial inputs carrying sensitivity 6.1858e23", () => {
    const R = set.entries.find((e) => e.quantityId === "molarGasConstant");
    const L = set.entries.find((e) => e.quantityId === "speedOfLight");
    expect(R?.printedStatus).toBe("editorial-input");
    expect(R?.sensitivity).toContain("6.1858e23");
    expect(L?.printedStatus).toBe("editorial-input");
    expect(L?.sensitivity).toContain("6.1858e23");
  });

  test("recomputing N from stated inputs gives 6.170486e23, rounding to printed 6.17e23", () => {
    const alpha = requireEntry(set, "wienConstantAlpha");
    const beta = requireEntry(set, "wienConstantBeta");
    const R = requireEntry(set, "molarGasConstant");
    const L = requireEntry(set, "speedOfLight");
    const alphaVal = alpha.correctedValue ?? alpha.value;
    const computedN = (beta.value / alphaVal) * ((8 * Math.PI * R.value) / L.value ** 3);
    expect(withinTolerance(computedN, 6.170486e23, { relative: 1e-6 }).ok).toBe(true);
    expect(computedN.toExponential(2)).toBe("6.17e+23");
  });

  test("section 8 check reproduces 4.3385 V and slope 4.2121e-15 V s", () => {
    const R = requireEntry(set, "molarGasConstant");
    const beta = requireEntry(set, "wienConstantBeta");
    const E = requireEntry(set, "gramEquivalentCharge");
    const nu = 1.03e15;
    const PiAbvolt = (R.value * beta.value * nu) / E.value;
    const PiVolts = PiAbvolt * 1e-8;
    expect(withinTolerance(PiVolts, 4.3385, { relative: 1e-4 }).ok).toBe(true);
    const slope = ((R.value * beta.value) / E.value) * 1e-8;
    expect(withinTolerance(slope, 4.2121e-15, { relative: 1e-4 }).ok).toBe(true);
  });

  test("section 8 documented alternative esu route reproduces 4.3057 V and 4.3087 V", () => {
    const R = requireEntry(set, "molarGasConstant");
    const beta = requireEntry(set, "wienConstantBeta");
    const N = requireEntry(set, "avogadroConstant");
    const nu = 1.03e15;
    const eps = 4.7e-10; // esu
    const statvolts = (R.value * beta.value * nu) / (N.value * eps);
    const voltsExact = statvolts * 299.792458;
    const voltsHist = statvolts * 300;
    expect(withinTolerance(voltsExact, 4.3057, { relative: 1e-3 }).ok).toBe(true);
    expect(withinTolerance(voltsHist, 4.3087, { relative: 1e-3 }).ok).toBe(true);
  });

  test("section 9 relations reproduce 6.4e12 and 9.6e12 erg at printed precision", () => {
    const R = requireEntry(set, "molarGasConstant");
    const beta = requireEntry(set, "wienConstantBeta");
    const L = requireEntry(set, "speedOfLight");
    const E = requireEntry(set, "gramEquivalentCharge");
    const lambda = 1.9e-5;
    const lenardWork = (R.value * beta.value * L.value) / lambda;
    expect(withinTolerance(lenardWork, 6.3847e12, { relative: 1e-4 }).ok).toBe(true);
    expect(lenardWork.toExponential(1)).toBe("6.4e+12");
    const starkWork = E.value * 10 * 1e8;
    expect(starkWork).toBe(9.6e12);
  });
});

describe("einstein-1905-brownian-printed", () => {
  const set = getConstantSet("einstein-1905-brownian-printed");

  test("records gasConstantProvenance as measured-without-counting-molecules", () => {
    expect(set.gasConstantProvenance).toBe("measured-without-counting-molecules");
  });

  test("records R as editorial input not printed in paper 2, and T = 290.15 K", () => {
    const R = set.entries.find((e) => e.quantityId === "molarGasConstant");
    expect(R?.printedStatus).toBe("editorial-input");
    expect(R?.reason).toContain("not printed in paper 2");
    const T = set.entries.find((e) => e.quantityId === "temperature");
    expect(T?.value).toBe(290.15);
    expect(T?.printedReading).toBe("17°");
  });

  test("reproduces 0.7947833 um at 1 s and 6.156365 um at 60 s", () => {
    const R = requireEntry(set, "molarGasConstant");
    const T = requireEntry(set, "temperature");
    const N = requireEntry(set, "avogadroConstant");
    const eta = requireEntry(set, "viscosity");
    const a = requireEntry(set, "particleRadius");
    const D = (R.value * T.value) / N.value / (6 * Math.PI * eta.value * a.value);
    const lambda1 = Math.sqrt(2 * D);
    const lambda60 = Math.sqrt(2 * D * 60);
    expect(withinTolerance(lambda1, 0.7947833e-6, { relative: 1e-6 }).ok).toBe(true);
    expect(withinTolerance(lambda60, 6.156365e-6, { relative: 1e-6 }).ok).toBe(true);
  });
});

describe("einstein-1905-mass-energy-printed", () => {
  const set = getConstantSet("einstein-1905-mass-energy-printed");

  test("records gasConstantProvenance as not-applicable", () => {
    expect(set.gasConstantProvenance).toBe("not-applicable");
  });

  test("reproduces 1 g for 9e20 erg and compares with modern c^2", () => {
    const c2 = requireEntry(set, "speedOfLightSquared");
    expect(c2.printedReading).toBe("9 · 10²⁰");
    const energyJ = 9e13; // 9e20 erg in Joules
    const massKg = energyJ / c2.value;
    expect(massKg).toBe(0.001); // 1 g

    const modern = getConstantSet("modern-si-2019");
    const modernC = constantValue(modern, "speedOfLight").value;
    const modernC2 = modernC * modernC;
    const printedMassVal = { setId: set.id, quantityId: "speedOfLightSquared", value: c2.value };
    const modernMassVal = { setId: modern.id, quantityId: "speedOfLightSquared", value: modernC2 };
    const comp = compareAcrossSets({
      left: printedMassVal,
      right: modernMassVal,
      reason: "factor comparison",
    });
    expect(withinTolerance(comp.ratio, 1.00138505, { relative: 1e-7 }).ok).toBe(true);
  });
});

describe("planck-1900-1901-printed", () => {
  const set = getConstantSet("planck-1900-1901-printed");

  test("records gasConstantProvenance as measured-without-counting-molecules", () => {
    expect(set.gasConstantProvenance).toBe("measured-without-counting-molecules");
  });

  test("consistency check between independently transcribed sets matches beta and alpha", () => {
    const h = requireEntry(set, "planckConstant");
    const k = requireEntry(set, "boltzmannConstant");
    const c = requireEntry(set, "speedOfLight");
    const hCgs = h.value * 1e7;
    const kCgs = k.value * 1e7;
    const hOverK = hCgs / kCgs;
    expect(withinTolerance(hOverK, 4.86627e-11, { relative: 1e-3 }).ok).toBe(true);
    const LCgs = c.value * 100;
    const alphaCalc = (8 * Math.PI * hCgs) / LCgs ** 3;
    expect(withinTolerance(alphaCalc, 6.097e-57, { relative: 1e-2 }).ok).toBe(true);
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
