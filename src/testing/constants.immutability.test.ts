import { describe, expect, test } from "bun:test";
import {
  compareAcrossSets,
  constantValue,
  deriveScenarioSet,
  getConstantSet,
} from "../physics/reference/constants.ts";

describe("immutability: sets, entries, and comparison records are deeply frozen", () => {
  test("a registered set and its entries are frozen", () => {
    const set = getConstantSet("modern-si-2019");
    expect(Object.isFrozen(set)).toBe(true);
    expect(Object.isFrozen(set.entries)).toBe(true);
    for (const entry of set.entries) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.dependsOn)).toBe(true);
    }
  });

  test("mutating a returned set does not change the registry's copy", () => {
    const set = getConstantSet("modern-si-2019");
    expect(() => {
      // @ts-expect-error deliberate mutation attempt against a frozen object
      set.entries = [];
    }).toThrow();
    expect(getConstantSet("modern-si-2019").entries.length).toBeGreaterThan(0);
  });

  test("a ConstantValue is frozen", () => {
    const value = constantValue(getConstantSet("modern-si-2019"), "planckConstant");
    expect(Object.isFrozen(value)).toBe(true);
  });

  test("a SetComparison record is frozen", () => {
    const modernSet = getConstantSet("modern-si-2019");
    const measured = getConstantSet("scenario-gas-constant-measured");
    const comparison = compareAcrossSets({
      left: constantValue(measured, "molarGasConstant"),
      right: constantValue(modernSet, "molarGasConstant"),
      reason: "immutability check",
    });
    expect(Object.isFrozen(comparison)).toBe(true);
  });

  test("a derived scenario set is frozen, including its override-provenance list", () => {
    const derived = deriveScenarioSet({
      id: "scenario-immutability-fixture",
      base: "modern-si-2019",
      overrides: [
        {
          quantityId: "viscosity",
          value: 1e-3,
          exactDecimal: "1e-3",
          unit: "Pa s",
          provenance: "fixture",
          evidentialRole: "measured-observation",
          uncertainty: 1e-5,
        },
      ],
      reason: "immutability check",
    });
    expect(Object.isFrozen(derived)).toBe(true);
    expect(Object.isFrozen(derived.entries)).toBe(true);
    expect(Object.isFrozen(derived.overrideProvenance)).toBe(true);
  });
});
