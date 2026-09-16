import { describe, expect, test } from "bun:test";
import {
  assertSameSet,
  compareAcrossSets,
  constantValue,
  createDeclaredConstantSet,
  deriveScenarioSet,
  getConstantSet,
  withHistoricalGuard,
  withMode1904Guard,
} from "../physics/reference/constants.ts";

describe("the mixing guard: cross-set arithmetic never happens silently", () => {
  test("assertSameSet throws constant-set-mismatch across two different sets", () => {
    const modern = getConstantSet("modern-si-2019");
    const codata = getConstantSet("modern-codata-2022");
    const R = constantValue(modern, "molarGasConstant");
    const me = constantValue(codata, "electronMass");
    expect(() => assertSameSet(R, me)).toThrow(/constant-set-mismatch/);
  });
});

describe("deriveScenarioSet", () => {
  test("succeeds from a real base and records both the base set id and every override's provenance", () => {
    const derived = deriveScenarioSet({
      id: "scenario-modern-water-17c",
      base: "modern-si-2019",
      overrides: [
        {
          quantityId: "viscosity",
          value: 1.08e-3,
          exactDecimal: "1.08e-3",
          unit: "Pa s",
          provenance: "IAPWS 2008 viscosity formulation, Huber et al. 2009, at 17 C.",
          evidentialRole: "measured-observation",
          uncertainty: 0.01e-3,
        },
      ],
      reason: "modern k_B with a cited modern viscosity at 17 C, never Einstein's printed value.",
    });
    expect(derived.baseSetId).toBe("modern-si-2019");
    expect(derived.overrideProvenance).toEqual([
      {
        quantityId: "viscosity",
        originalSetId: null,
        provenance: "IAPWS 2008 viscosity formulation, Huber et al. 2009, at 17 C.",
      },
    ]);
    // The base's exact N_A and k_B are carried through unchanged.
    expect(constantValue(derived, "avogadroConstant").value).toBe(6.02214076e23);
    expect(constantValue(derived, "viscosity").value).toBe(1.08e-3);
  });

  test("an override replacing an existing base entry records the base set as its original set", () => {
    const derived = deriveScenarioSet({
      id: "scenario-modern-custom-gas-constant",
      base: "modern-si-2019",
      overrides: [
        {
          quantityId: "molarGasConstant",
          value: 8.3,
          exactDecimal: "8.3",
          unit: "J/(mol K)",
          provenance: "A deliberately different test value.",
          evidentialRole: "measured-observation",
          uncertainty: 0.1,
        },
      ],
      reason: "exercise the override-replaces-base path",
    });
    expect(derived.overrideProvenance[0]?.originalSetId).toBe("modern-si-2019");
    expect(constantValue(derived, "molarGasConstant").value).toBe(8.3);
  });

  test("a standalone (base: null) scenario never contains the defined N_A or k_B: every override is declared-scenario kind by construction", () => {
    const standalone = deriveScenarioSet({
      id: "scenario-standalone-measured-only",
      base: null,
      overrides: [
        {
          quantityId: "molarGasConstant",
          value: 8.314471,
          exactDecimal: "8.314471",
          unit: "J/(mol K)",
          provenance: "Moldover et al. 1988",
          evidentialRole: "measured-observation",
          uncertainty: 0.000014,
        },
      ],
      reason: "a standalone declared set built only from cited measured values",
    });
    expect(standalone.baseSetId).toBeNull();
    expect(standalone.entries.every((e) => e.kind === "declared-scenario")).toBe(true);
    expect(standalone.entries.some((e) => e.kind === "exact-defined")).toBe(false);
  });

  test("createDeclaredConstantSet (the standalone-set builder) refuses an empty set", () => {
    expect(() =>
      createDeclaredConstantSet({
        id: "scenario-empty",
        era: 2024,
        provenance: "test",
        precisionNote: "test",
        gasConstantProvenance: "measured-without-counting-molecules",
        entries: [],
      }),
    ).toThrow(/empty-constant-set|Declare at least one input/);
  });
});

describe("compareAcrossSets: a labeled comparison, never a mixed calculation", () => {
  test("returns both set ids, the ratio, and the relative difference", () => {
    const modernSet = getConstantSet("modern-si-2019");
    const measured = getConstantSet("scenario-gas-constant-measured");
    const left = constantValue(measured, "molarGasConstant");
    const right = constantValue(modernSet, "molarGasConstant");
    const comparison = compareAcrossSets({
      left,
      right,
      reason: "Moldover 1988 measured R beside the 2019 exact R.",
    });
    expect(comparison.leftSetId).toBe("scenario-gas-constant-measured");
    expect(comparison.rightSetId).toBe("modern-si-2019");
    expect(Math.abs(comparison.relativeDifference - 1.008e-6)).toBeLessThan(2e-8);
  });

  test("mismatched quantity ids throw comparison-quantity-mismatch", () => {
    const modernSet = getConstantSet("modern-si-2019");
    const codata = getConstantSet("modern-codata-2022");
    expect(() =>
      compareAcrossSets({
        left: constantValue(modernSet, "molarGasConstant"),
        right: constantValue(codata, "electronMass"),
        reason: "deliberately mismatched",
      }),
    ).toThrow(/comparison-quantity-mismatch/);
  });

  test("a comparison record is not a ConstantValue and cannot be used as a constant", () => {
    const modernSet = getConstantSet("modern-si-2019");
    const measured = getConstantSet("scenario-gas-constant-measured");
    const comparison = compareAcrossSets({
      left: constantValue(measured, "molarGasConstant"),
      right: constantValue(modernSet, "molarGasConstant"),
      reason: "labeled comparison, not an input",
    });
    // @ts-expect-error a SetComparison is not a ConstantValue
    expect(() => assertSameSet(comparison)).toThrow(/invalid-constant/);
  });
});

describe("withHistoricalGuard: forbidModernExact", () => {
  test("trips on modern exact k_B and N_A read from inside the guard", () => {
    const modernSet = getConstantSet("modern-si-2019");
    expect(() =>
      withHistoricalGuard(() => constantValue(modernSet, "boltzmannConstant")),
    ).toThrow(/modern-constant-in-historical-path/);
    expect(() =>
      withHistoricalGuard(() => constantValue(modernSet, "avogadroConstant")),
    ).toThrow(/modern-constant-in-historical-path/);
  });

  test("does not trip on a declared scenario set used outside a historical path, or on a non-guarded modern read", () => {
    const measured = getConstantSet("scenario-gas-constant-measured");
    expect(() => withHistoricalGuard(() => constantValue(measured, "molarGasConstant"))).not.toThrow();
    const modernSet = getConstantSet("modern-si-2019");
    expect(constantValue(modernSet, "boltzmannConstant").value).toBe(1.380649e-23);
  });
});

describe("withMode1904Guard: no pre-1905 light speed, no modern sets", () => {
  test("trips on the modern sets", () => {
    expect(() => withMode1904Guard(() => getConstantSet("modern-si-2019"))).toThrow(
      /modern-constant-in-1904-mode/,
    );
    expect(() => withMode1904Guard(() => getConstantSet("modern-codata-2022"))).toThrow(
      /modern-constant-in-1904-mode/,
    );
  });

  test("a numeric light-speed request throws no-pre-1905-light-speed-set", () => {
    const modernSet = getConstantSet("modern-si-2019");
    expect(() => withMode1904Guard(() => constantValue(modernSet, "speedOfLight"))).toThrow(
      /no-pre-1905-light-speed-set/,
    );
  });

  test("does not trip outside the guard", () => {
    expect(() => getConstantSet("modern-si-2019")).not.toThrow();
  });
});
