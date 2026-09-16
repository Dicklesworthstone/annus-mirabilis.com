import { describe, expect, test } from "bun:test";
import {
  assertSameSet,
  ConstantSetError,
  compareAcrossSets,
  constantValue,
  createDeclaredConstantSet,
  deriveScenarioSet,
  getConstantSet,
  withHistoricalGuard,
  withMode1904Guard,
} from "../physics/reference/constants.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("the mixing guard: cross-set arithmetic never happens silently", () => {
  test("assertSameSet throws constant-set-mismatch across two different sets", () => {
    const modern = getConstantSet("modern-si-2019");
    const codata = getConstantSet("modern-codata-2022");
    const R = constantValue(modern, "molarGasConstant");
    const me = constantValue(codata, "electronMass");
    try {
      assertSameSet(R, me);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("constant-set-mismatch");
      expect((e as Error).message).toContain(
        "Cannot combine modern-si-2019 and modern-codata-2022",
      );
    }
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
    try {
      createDeclaredConstantSet({
        id: "scenario-empty",
        era: 2024,
        provenance: "test",
        precisionNote: "test",
        gasConstantProvenance: "not-applicable",
        entries: [],
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("empty-constant-set");
      expect((e as Error).message).toContain("Declare at least one input");
    }
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
    expect(withinTolerance(comparison.relativeDifference, 1.008e-6, { absolute: 2e-8 }).ok).toBe(
      true,
    );
  });

  test("mismatched quantity ids throw comparison-quantity-mismatch", () => {
    const modernSet = getConstantSet("modern-si-2019");
    const codata = getConstantSet("modern-codata-2022");
    try {
      compareAcrossSets({
        left: constantValue(modernSet, "molarGasConstant"),
        right: constantValue(codata, "electronMass"),
        reason: "deliberately mismatched",
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("comparison-quantity-mismatch");
      expect((e as Error).message).toContain(
        "Cannot compare molarGasConstant (in modern-si-2019) with electronMass (in modern-codata-2022)",
      );
    }
  });

  test("a comparison record is not a ConstantValue and cannot be used as a constant", () => {
    const modernSet = getConstantSet("modern-si-2019");
    const measured = getConstantSet("scenario-gas-constant-measured");
    const comparison = compareAcrossSets({
      left: constantValue(measured, "molarGasConstant"),
      right: constantValue(modernSet, "molarGasConstant"),
      reason: "labeled comparison, not an input",
    });
    try {
      // @ts-expect-error a SetComparison is not a ConstantValue
      assertSameSet(comparison);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("invalid-constant");
      expect((e as Error).message).toContain("Expected a tagged finite constant");
    }
  });
});

describe("withHistoricalGuard: forbidModernExact", () => {
  test("trips on modern exact k_B and N_A read from inside the guard", () => {
    const modernSet = getConstantSet("modern-si-2019");
    try {
      withHistoricalGuard(() => constantValue(modernSet, "boltzmannConstant"));
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("modern-constant-in-historical-path");
      expect((e as Error).message).toContain(
        "Historical inference paths may not read modern exact boltzmannConstant from modern-si-2019",
      );
    }

    try {
      withHistoricalGuard(() => constantValue(modernSet, "avogadroConstant"));
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("modern-constant-in-historical-path");
      expect((e as Error).message).toContain(
        "Historical inference paths may not read modern exact avogadroConstant from modern-si-2019",
      );
    }
  });

  test("does not trip on a declared scenario set used outside a historical path, or on a non-guarded modern read", () => {
    const measured = getConstantSet("scenario-gas-constant-measured");
    expect(() =>
      withHistoricalGuard(() => constantValue(measured, "molarGasConstant")),
    ).not.toThrow();
    const modernSet = getConstantSet("modern-si-2019");
    expect(constantValue(modernSet, "boltzmannConstant").value).toBe(1.380649e-23);
  });
});

describe("withMode1904Guard: no pre-1905 light speed, no modern sets", () => {
  test("trips on the modern sets", () => {
    try {
      withMode1904Guard(() => getConstantSet("modern-si-2019"));
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("modern-constant-in-1904-mode");
      expect((e as Error).message).toContain("modern-si-2019 is not available inside a 1904 mode");
    }

    try {
      withMode1904Guard(() => getConstantSet("modern-codata-2022"));
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("modern-constant-in-1904-mode");
      expect((e as Error).message).toContain(
        "modern-codata-2022 is not available inside a 1904 mode",
      );
    }
  });

  test("a numeric light-speed request throws no-pre-1905-light-speed-set", () => {
    const modernSet = getConstantSet("modern-si-2019");
    try {
      withMode1904Guard(() => constantValue(modernSet, "speedOfLight"));
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("no-pre-1905-light-speed-set");
      expect((e as Error).message).toContain(
        "No constant set holding a light speed available by 1904 is registered",
      );
    }
  });

  test("does not trip outside the guard", () => {
    expect(() => getConstantSet("modern-si-2019")).not.toThrow();
  });
});
