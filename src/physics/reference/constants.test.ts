import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import {
  assertSameSet,
  type ConstantEntry,
  ConstantSetError,
  checkPrintedConsistency,
  compareAcrossSets,
  constantValue,
  convert,
  createDeclaredConstantSet,
  deriveScenarioSet,
  type EvidentialRole,
  evidentialRoleText,
  freezeConstantSet,
  getConstantSet,
  printedReadingOf,
  RESERVED_SET_IDS,
  thermalConstant,
  withHistoricalGuard,
  withMode1904Guard,
} from "./constants.ts";

function expectRejection(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error(`Expected ${code} but nothing was thrown.`);
  } catch (error) {
    expect(error).toBeInstanceOf(ConstantSetError);
    expect((error as ConstantSetError).code).toBe(code);
  }
}

function mustFind<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Expected to find ${what}.`);
  return value;
}

describe("modern-si-2019", () => {
  const modern = getConstantSet("modern-si-2019");

  test("holds the five exact SI defining constants plus derived relations", () => {
    const ids = modern.entries.map((e) => e.quantityId);
    for (const id of [
      "planckConstant",
      "elementaryCharge",
      "boltzmannConstant",
      "avogadroConstant",
      "speedOfLight",
    ]) {
      expect(ids).toContain(id);
    }
    for (const entry of modern.entries) {
      expect(entry.kind).toBe("exact-defined");
      expect(entry.evidentialRole).toBe("defined-exact");
      expect(entry.uncertainty).toBeUndefined();
    }
  });

  test("R equals 8.31446261815324 exactly, both as the parsed decimal and as N_A * k_B in floating point", () => {
    const R = mustFind(
      modern.entries.find((e) => e.quantityId === "molarGasConstant"),
      "molarGasConstant",
    );
    expect(R.value).toBe(8.31446261815324);
    expect(Number(R.exactDecimal)).toBe(R.value);
    const N_A = mustFind(
      modern.entries.find((e) => e.quantityId === "avogadroConstant"),
      "avogadroConstant",
    ).value;
    const k_B = mustFind(
      modern.entries.find((e) => e.quantityId === "boltzmannConstant"),
      "boltzmannConstant",
    ).value;
    expect(N_A * k_B).toBe(R.value);
    expect(R.dependsOn).toEqual(["avogadroConstant", "boltzmannConstant"]);
  });

  test("planckChargeQuotient (h/e) is within 1e-15 relative of 4.135667696923859e-15 V s", () => {
    const hOverE = mustFind(
      modern.entries.find((e) => e.quantityId === "planckChargeQuotient"),
      "planckChargeQuotient",
    );
    const expected = 4.135667696923859e-15;
    expect(withinTolerance(hOverE.value, expected, { relative: 1e-15 }).ok).toBe(true);
    expect(hOverE.dependsOn).toEqual(["planckConstant", "elementaryCharge"]);
  });

  test("faradayConstant (N_A * e) is within 1e-15 relative of the exact product", () => {
    const F = mustFind(
      modern.entries.find((e) => e.quantityId === "faradayConstant"),
      "faradayConstant",
    );
    const N_A = mustFind(
      modern.entries.find((e) => e.quantityId === "avogadroConstant"),
      "avogadroConstant",
    ).value;
    const e = mustFind(
      modern.entries.find((e) => e.quantityId === "elementaryCharge"),
      "elementaryCharge",
    ).value;
    expect(withinTolerance(F.value, N_A * e, { relative: 1e-15 }).ok).toBe(true);
  });

  test("thermalConstant on the modern set returns k_B directly, gas-constant-provenance defined", () => {
    expect(modern.gasConstantProvenance).toBe("defined");
    const kB = thermalConstant(modern);
    expect(kB.quantityId).toBe("boltzmannConstant");
    expect(kB.value).toBe(1.380649e-23);
  });
});

describe("modern-codata-2022", () => {
  const codata = getConstantSet("modern-codata-2022");

  test("carries measured entries with a CODATA release id and uncertainty, checked live against NIST", () => {
    expect(codata.kind).toBe("measured");
    expect(codata.gasConstantProvenance).toBe("not-applicable");
    for (const entry of codata.entries) {
      expect(entry.kind).toBe("measured");
      expect(entry.uncertainty).toBeGreaterThan(0);
      expect(entry.provenance).toContain("CODATA 2022");
    }
  });

  test("electron mass, vacuum permeability, and vacuum permittivity match the NIST-published CODATA 2022 figures", () => {
    const byId = new Map(codata.entries.map((e) => [e.quantityId, e]));
    expect(byId.get("electronMass")?.value).toBe(9.1093837139e-31);
    expect(byId.get("electronMass")?.uncertainty).toBeCloseTo(0.0000000028e-31, 40);
    expect(byId.get("vacuumPermeability")?.value).toBe(1.25663706127e-6);
    expect(byId.get("vacuumPermittivity")?.value).toBe(8.8541878188e-12);
  });
});

describe("scenario-gas-constant-measured", () => {
  const scenario = getConstantSet("scenario-gas-constant-measured");

  test("holds one measured molarGasConstant entry with the Moldover 1988 value and uncertainty", () => {
    expect(scenario.entries).toHaveLength(1);
    const R = mustFind(scenario.entries[0], "scenario.entries[0]");
    expect(R.quantityId).toBe("molarGasConstant");
    expect(R.value).toBe(8.314471);
    expect(R.uncertainty).toBe(0.000014);
    expect(R.kind).toBe("declared-scenario");
    expect(scenario.gasConstantProvenance).toBe("measured-without-counting-molecules");
  });

  test("contains no avogadroConstant or boltzmannConstant entry", () => {
    const ids = scenario.entries.map((e) => e.quantityId);
    expect(ids).not.toContain("avogadroConstant");
    expect(ids).not.toContain("boltzmannConstant");
  });

  test("its relative difference from the 2019 exact R is about 1.008e-6", () => {
    const modernR = constantValue(getConstantSet("modern-si-2019"), "molarGasConstant");
    const scenarioR = constantValue(scenario, "molarGasConstant");
    const relativeDifference = (scenarioR.value - modernR.value) / modernR.value;
    expect(withinTolerance(relativeDifference, 1.008e-6, { absolute: 1e-8 }).ok).toBe(true);
  });

  test("a copy without uncertainty fails validation", () => {
    expectRejection(
      () =>
        createDeclaredConstantSet({
          id: "scenario-copy-without-uncertainty",
          era: 1988,
          provenance: "fixture",
          precisionNote: "fixture",
          gasConstantProvenance: "measured-without-counting-molecules",
          entries: [
            {
              quantityId: "molarGasConstant",
              value: 8.314471,
              exactDecimal: "8.314471",
              unit: "J/(mol K)",
              kind: "declared-scenario",
              evidentialRole: "measured-observation",
              provenance: "fixture",
              dependsOn: [],
            },
          ],
        }),
      "measured-missing-uncertainty",
    );
  });
});

describe("reserved and pending-facsimile set ids", () => {
  test("RESERVED_SET_IDS names the three dissertation sets, owned by am-ref-viscosity-suspension-c9lp", () => {
    expect(Object.keys(RESERVED_SET_IDS).sort()).toEqual(
      [
        "einstein-1905-thesis-printed",
        "einstein-1906-dissertation-printed",
        "einstein-1911-correction-printed",
      ].sort(),
    );
    for (const owner of Object.values(RESERVED_SET_IDS))
      expect(owner).toBe("am-ref-viscosity-suspension-c9lp");
  });

  test("every reserved id throws constant-set-not-registered naming its owner", () => {
    for (const [id, owner] of Object.entries(RESERVED_SET_IDS)) {
      try {
        getConstantSet(id);
        throw new Error(`${id} should have thrown`);
      } catch (error) {
        expect(error).toBeInstanceOf(ConstantSetError);
        expect((error as ConstantSetError).code).toBe("constant-set-not-registered");
        expect((error as Error).message).toContain(owner);
      }
    }
  });

  test("the four printed-historical papers are registered and return valid frozen sets", () => {
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

  test("an id that is neither registered nor reserved throws unknown-constant-set", () => {
    expectRejection(() => getConstantSet("not-a-real-set"), "unknown-constant-set");
  });

  test("checkPrintedConsistency reports a reserved/unregistered set as not-available rather than throwing", () => {
    const report = checkPrintedConsistency("einstein-1905-thesis-printed");
    expect(report.setId).toBe("einstein-1905-thesis-printed");
    expect(report.available).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.issues[0]?.code).toBe("not-available");
  });
});

describe("mixing guard", () => {
  test("cross-set arithmetic throws constant-set-mismatch", () => {
    const modernR = constantValue(getConstantSet("modern-si-2019"), "molarGasConstant");
    const scenarioR = constantValue(
      getConstantSet("scenario-gas-constant-measured"),
      "molarGasConstant",
    );
    expectRejection(() => assertSameSet(modernR, scenarioR), "constant-set-mismatch");
  });

  test("same-set values pass assertSameSet without throwing", () => {
    const modern = getConstantSet("modern-si-2019");
    const a = constantValue(modern, "planckConstant");
    const b = constantValue(modern, "elementaryCharge");
    expect(() => assertSameSet(a, b)).not.toThrow();
  });

  test("deriveScenarioSet records the base set id and every override's provenance", () => {
    const derived = deriveScenarioSet({
      id: "scenario-modern-water-17c",
      base: "modern-si-2019",
      overrides: [
        {
          quantityId: "viscosityOfWaterAt17C",
          value: 1.08e-3,
          exactDecimal: "1.08e-3",
          unit: "Pa s",
          provenance: "IAPWS 2008 viscosity formulation, Huber et al. 2009.",
          evidentialRole: "measured-observation",
          uncertainty: 0.01e-3,
        },
      ],
      reason: "modern-si-2019 plus the cited 17C viscosity",
    });
    expect(derived.baseSetId).toBe("modern-si-2019");
    expect(derived.overrideProvenance).toHaveLength(1);
    expect(derived.overrideProvenance[0]?.quantityId).toBe("viscosityOfWaterAt17C");
    expect(derived.entries.some((e) => e.quantityId === "planckConstant")).toBe(true);
  });

  test("deriveScenarioSet with base: null and only cited measured values is allowed", () => {
    const derived = deriveScenarioSet({
      id: "scenario-standalone-example",
      base: null,
      overrides: [
        {
          quantityId: "molarGasConstant",
          value: 8.314471,
          exactDecimal: "8.314471",
          unit: "J/(mol K)",
          provenance: "Moldover 1988.",
          evidentialRole: "measured-observation",
          uncertainty: 0.000014,
        },
      ],
      reason: "standalone declared set",
    });
    expect(derived.baseSetId).toBeNull();
  });

  test("compareAcrossSets returns both set ids, the ratio, and the relative difference", () => {
    const left = constantValue(getConstantSet("modern-si-2019"), "molarGasConstant");
    const right = constantValue(
      getConstantSet("scenario-gas-constant-measured"),
      "molarGasConstant",
    );
    const comparison = compareAcrossSets({
      left,
      right,
      reason: "modern exact R vs Moldover 1988 measured R",
    });
    expect(comparison.leftSetId).toBe("modern-si-2019");
    expect(comparison.rightSetId).toBe("scenario-gas-constant-measured");
    expect(comparison.ratio).toBeCloseTo(left.value / right.value, 15);
    expect(comparison.relativeDifference).toBeCloseTo((left.value - right.value) / right.value, 15);
  });

  test("compareAcrossSets rejects mismatched quantity ids", () => {
    const left = constantValue(getConstantSet("modern-si-2019"), "molarGasConstant");
    const right = constantValue(getConstantSet("modern-si-2019"), "planckConstant");
    expectRejection(
      () => compareAcrossSets({ left, right, reason: "fixture" }),
      "comparison-quantity-mismatch",
    );
  });

  test("compareAcrossSets requires a non-empty reason", () => {
    const left = constantValue(getConstantSet("modern-si-2019"), "molarGasConstant");
    expectRejection(
      () => compareAcrossSets({ left, right: left, reason: "" }),
      "missing-comparison-reason",
    );
  });

  test("the historical guard trips on modern exact k_B and N_A", () => {
    const modern = getConstantSet("modern-si-2019");
    expectRejection(
      () => withHistoricalGuard(() => constantValue(modern, "boltzmannConstant")),
      "modern-constant-in-historical-path",
    );
    expectRejection(
      () => withHistoricalGuard(() => constantValue(modern, "avogadroConstant")),
      "modern-constant-in-historical-path",
    );
  });

  test("the historical guard does not trip on a declared scenario set", () => {
    const scenario = getConstantSet("scenario-gas-constant-measured");
    expect(withHistoricalGuard(() => constantValue(scenario, "molarGasConstant").value)).toBe(
      8.314471,
    );
  });

  test("the historical guard does not affect access outside it", () => {
    const modern = getConstantSet("modern-si-2019");
    expect(constantValue(modern, "boltzmannConstant").value).toBe(1.380649e-23);
  });

  test("the 1904-mode guard trips on both modern sets", () => {
    expectRejection(
      () => withMode1904Guard(() => getConstantSet("modern-si-2019")),
      "modern-constant-in-1904-mode",
    );
    expectRejection(
      () => withMode1904Guard(() => getConstantSet("modern-codata-2022")),
      "modern-constant-in-1904-mode",
    );
  });

  test("the 1904-mode guard trips on the 1905 printed set ids (even while unregistered, the id match fires first)", () => {
    expectRejection(
      () => withMode1904Guard(() => getConstantSet("einstein-1905-light-quanta-printed")),
      "modern-constant-in-1904-mode",
    );
    expectRejection(
      () => withMode1904Guard(() => getConstantSet("einstein-1905-mass-energy-printed")),
      "modern-constant-in-1904-mode",
    );
  });

  test("the 1904-mode guard refuses a numeric light-speed request", () => {
    const scenario = getConstantSet("scenario-gas-constant-measured");
    expectRejection(
      () => withMode1904Guard(() => constantValue(scenario, "speedOfLight")),
      "no-pre-1905-light-speed-set",
    );
  });

  test("the 1904-mode guard does not affect access outside it", () => {
    expect(getConstantSet("modern-si-2019").id).toBe("modern-si-2019");
  });
});

describe("conversions", () => {
  test("erg/J, dyne/N, poise/Pa s, cm/m, cm2 s-2/m2 s-2 use their exact factors", () => {
    expect(convert(1, "erg", "J")).toBe(1e-7);
    expect(convert(1, "dyne", "N")).toBe(1e-5);
    expect(convert(1, "poise", "Pa s")).toBe(0.1);
    expect(convert(1, "cm", "m")).toBe(1e-2);
    expect(convert(1, "cm2 s-2", "m2 s-2")).toBe(1e-4);
  });

  test("statvolt, statcoulomb, abvolt, abcoulomb, gauss convert per the registry's Gaussian-SI correspondence", () => {
    expect(convert(1, "statvolt", "V")).toBeCloseTo(299.792458, 9);
    expect(convert(1, "statcoulomb", "C")).toBeCloseTo(3.3356409519815207e-10, 24);
    expect(convert(1, "abvolt", "V")).toBe(1e-8);
    expect(convert(1, "abcoulomb", "C")).toBe(10);
    expect(convert(1, "gauss", "T")).toBe(1e-4);
  });

  test("round trips return within 4 epsilon relative", () => {
    for (const [from, to] of [
      ["erg", "J"],
      ["statvolt", "V"],
      ["statcoulomb", "C"],
    ] as const) {
      const forward = convert(1, from, to);
      const back = convert(forward, to, from);
      expect(withinTolerance(back, 1, { absolute: 4 * Number.EPSILON }).ok).toBe(true);
    }
  });

  test("converting between incommensurable units throws", () => {
    expectRejection(() => convert(1, "erg", "V"), "incommensurable-units");
  });

  test("an unknown unit throws", () => {
    expectRejection(() => convert(1, "furlong", "m"), "unknown-unit");
  });
});

describe("printedReadingOf and evidentialRoleText", () => {
  const base: Omit<ConstantEntry, "printedStatus" | "evidentialRole"> = {
    quantityId: "fixtureQuantity",
    value: 1,
    exactDecimal: "1",
    unit: "unit",
    kind: "printed-historical",
    provenance: "fixture",
    dependsOn: [],
  };

  test("returns the printed reading for printed and printed-corrected entries", () => {
    expect(
      printedReadingOf({
        ...base,
        evidentialRole: "measured-observation",
        printedStatus: "printed",
        printedReading: "4,866",
      }),
    ).toBe("4,866");
    expect(
      printedReadingOf({
        ...base,
        evidentialRole: "theoretical-estimate",
        printedStatus: "printed-corrected",
        printedReading: "6,1·10⁻⁵⁶",
        correctedValue: 6.1e-57,
        correctionReason: "fixture",
        receiptRef: "docs/provenance/fixture.md",
      }),
    ).toBe("6,1·10⁻⁵⁶");
  });

  test("returns a labeled non-printed marker for editorial-input and non-printed-historical entries", () => {
    expect(
      printedReadingOf({
        ...base,
        evidentialRole: "measured-observation",
        printedStatus: "editorial-input",
        reason: "fixture",
        sensitivity: "fixture",
      }),
    ).toContain("editorial input");
    expect(
      printedReadingOf({
        ...base,
        kind: "exact-defined",
        evidentialRole: "defined-exact",
        printedStatus: undefined,
      }),
    ).toContain("not a printed-historical entry");
  });

  test("evidentialRoleText returns one authored phrase per role, none composed at call time", () => {
    const roles: EvidentialRole[] = [
      "defined-exact",
      "measured-observation",
      "fitted-constant",
      "theoretical-estimate",
      "illustrative-computation",
      "correction",
    ];
    const seen = new Set<string>();
    for (const evidentialRole of roles) {
      const text = evidentialRoleText({ ...base, evidentialRole });
      expect(text.length).toBeGreaterThan(0);
      seen.add(text);
    }
    expect(seen.size).toBe(roles.length);
  });
});

describe("freezeConstantSet validation", () => {
  const validEntry: ConstantEntry = {
    quantityId: "fixtureQuantity",
    value: 1,
    exactDecimal: "1",
    unit: "unit",
    kind: "exact-defined",
    evidentialRole: "defined-exact",
    provenance: "fixture",
    dependsOn: [],
  };
  const validSet = () => ({
    id: "fixture-set",
    kind: "exact-defined" as const,
    era: 2020,
    provenance: "fixture",
    precisionNote: "fixture",
    gasConstantProvenance: "not-applicable" as const,
    entries: [validEntry],
  });

  test("a clean set freezes without throwing", () => {
    expect(() => freezeConstantSet(validSet())).not.toThrow();
  });

  test("a duplicate quantity id fails", () => {
    expectRejection(
      () => freezeConstantSet({ ...validSet(), entries: [validEntry, validEntry] }),
      "duplicate-constant",
    );
  });

  test("Number(exactDecimal) must equal value", () => {
    expectRejection(
      () => freezeConstantSet({ ...validSet(), entries: [{ ...validEntry, exactDecimal: "2" }] }),
      "invalid-constant",
    );
  });

  test("an exact-defined entry cannot carry uncertainty", () => {
    expectRejection(
      () => freezeConstantSet({ ...validSet(), entries: [{ ...validEntry, uncertainty: 0.1 }] }),
      "exact-defined-has-uncertainty",
    );
  });

  test("a measured entry requires uncertainty", () => {
    expectRejection(
      () =>
        freezeConstantSet({
          ...validSet(),
          kind: "measured",
          gasConstantProvenance: "not-applicable",
          entries: [{ ...validEntry, kind: "measured", evidentialRole: "measured-observation" }],
        }),
      "measured-missing-uncertainty",
    );
  });

  test("a theoretical-estimate entry with empty dependsOn fails", () => {
    expectRejection(
      () =>
        freezeConstantSet({
          ...validSet(),
          kind: "printed-historical",
          entries: [
            {
              ...validEntry,
              kind: "printed-historical",
              evidentialRole: "theoretical-estimate",
              printedStatus: "printed",
              printedReading: "x",
              dependsOn: [],
            },
          ],
        }),
      "missing-dependency",
    );
  });

  test("a printed-historical entry requires printedStatus", () => {
    expectRejection(
      () =>
        freezeConstantSet({
          ...validSet(),
          kind: "printed-historical",
          entries: [
            { ...validEntry, kind: "printed-historical", evidentialRole: "measured-observation" },
          ],
        }),
      "missing-printed-status",
    );
  });

  test("printedStatus printed-corrected without receiptRef fails", () => {
    expectRejection(
      () =>
        freezeConstantSet({
          ...validSet(),
          kind: "printed-historical",
          entries: [
            {
              ...validEntry,
              kind: "printed-historical",
              evidentialRole: "correction",
              dependsOn: ["fixtureQuantity"],
              printedStatus: "printed-corrected",
              printedReading: "x",
              correctedValue: 2,
              correctionReason: "fixture",
            },
          ],
        }),
      "printed-corrected-missing-fields",
    );
  });

  test("transcriptionStatus transcribed-and-checked without checkedBy/checkedAt fails", () => {
    expectRejection(
      () =>
        freezeConstantSet({
          ...validSet(),
          kind: "printed-historical",
          entries: [
            {
              ...validEntry,
              kind: "printed-historical",
              evidentialRole: "measured-observation",
              printedStatus: "printed",
              printedReading: "x",
              transcriptionStatus: "transcribed-and-checked",
            },
          ],
        }),
      "transcribed-missing-check-metadata",
    );
  });

  test("a printedRegion out of [0,100] bounds fails", () => {
    expectRejection(
      () =>
        freezeConstantSet({
          ...validSet(),
          entries: [{ ...validEntry, printedRegion: { x: 90, y: 0, width: 20, height: 3 } }],
        }),
      "invalid-printed-region",
    );
  });

  test("a printedRegion within bounds passes", () => {
    expect(() =>
      freezeConstantSet({
        ...validSet(),
        entries: [{ ...validEntry, printedRegion: { x: 12, y: 40, width: 18, height: 3 } }],
      }),
    ).not.toThrow();
  });
});

describe("checkPrintedConsistency (structural)", () => {
  test("flags a dangling dependsOn reference", () => {
    const set = freezeConstantSet({
      id: "fixture-dangling",
      kind: "printed-historical",
      era: 1905,
      provenance: "fixture",
      precisionNote: "fixture",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          quantityId: "derived",
          value: 1,
          exactDecimal: "1",
          unit: "unit",
          kind: "printed-historical",
          evidentialRole: "theoretical-estimate",
          provenance: "fixture",
          dependsOn: ["missingInput"],
          printedStatus: "printed",
          printedReading: "x",
          transcriptionStatus: "pending-transcription",
        },
      ],
    });
    const report = checkPrintedConsistency(set);
    expect(report.available).toBe(true);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.code === "dangling-dependency")).toBe(true);
  });

  test("a clean set reports ok: true", () => {
    const modern = getConstantSet("modern-si-2019");
    const report = checkPrintedConsistency(modern);
    expect(report.available).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });
});

describe("immutability", () => {
  test("sets and entries are deeply frozen", () => {
    const modern = getConstantSet("modern-si-2019");
    expect(Object.isFrozen(modern)).toBe(true);
    expect(Object.isFrozen(modern.entries)).toBe(true);
    expect(Object.isFrozen(modern.entries[0])).toBe(true);
    expect(Object.isFrozen(modern.entries[0]?.dependsOn)).toBe(true);
  });

  test("a SetComparison record is frozen", () => {
    const left = constantValue(getConstantSet("modern-si-2019"), "molarGasConstant");
    const comparison = compareAcrossSets({ left, right: left, reason: "fixture self-comparison" });
    expect(Object.isFrozen(comparison)).toBe(true);
  });
});
