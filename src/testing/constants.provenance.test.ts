import { describe, expect, test } from "bun:test";
import {
  ConstantSetError,
  createDeclaredConstantSet,
  getConstantSet,
} from "../physics/reference/constants.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("gasConstantProvenance", () => {
  test("modern-si-2019 is defined", () => {
    expect(getConstantSet("modern-si-2019").gasConstantProvenance).toBe("defined");
  });

  test("modern-codata-2022 is not-applicable (no R, N_A, or k_B in this set)", () => {
    const set = getConstantSet("modern-codata-2022");
    expect(set.gasConstantProvenance).toBe("not-applicable");
    expect(set.entries.some((e) => e.quantityId === "avogadroConstant")).toBe(false);
    expect(set.entries.some((e) => e.quantityId === "boltzmannConstant")).toBe(false);
  });

  test("a declared scenario with defined gasConstantProvenance fails validation", () => {
    try {
      createDeclaredConstantSet({
        id: "scenario-bad-provenance",
        era: 2024,
        provenance: "test",
        precisionNote: "test",
        gasConstantProvenance: "defined",
        entries: [
          {
            quantityId: "temperature",
            value: 293.15,
            exactDecimal: "293.15",
            unit: "K",
            kind: "declared-scenario",
            evidentialRole: "declared-input",
            provenance: "test",
            dependsOn: [],
          },
        ],
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("ambiguous-constant-provenance");
      expect((e as Error).message).toContain("Standalone scenarios are not SI definitions");
    }
  });
});

describe("scenario-gas-constant-measured: the standalone Moldover 1988 set", () => {
  test("holds Moldover 1988 R = 8.314471 with uncertainty 0.000014 and role measured-observation", () => {
    const set = getConstantSet("scenario-gas-constant-measured");
    expect(set.era).toBe(1988);
    expect(set.gasConstantProvenance).toBe("measured-without-counting-molecules");
    const R = set.entries.find((e) => e.quantityId === "molarGasConstant");
    expect(R).toBeDefined();
    if (!R) throw new Error("Missing molarGasConstant entry in set");
    expect(R.value).toBe(8.314471);
    expect(R.uncertainty).toBe(0.000014);
    expect(R.evidentialRole).toBe("measured-observation");
  });

  test("a copy without the uncertainty fails validation", () => {
    try {
      createDeclaredConstantSet({
        id: "scenario-gas-constant-no-uncertainty",
        era: 1988,
        provenance: "test copy without uncertainty",
        precisionNote: "test",
        gasConstantProvenance: "measured-without-counting-molecules",
        entries: [
          {
            quantityId: "molarGasConstant",
            value: 8.314471,
            exactDecimal: "8.314471",
            unit: "J/(mol K)",
            kind: "declared-scenario",
            evidentialRole: "measured-observation",
            provenance: "test",
            dependsOn: [],
          },
        ],
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("measured-missing-uncertainty");
      expect((e as Error).message).toContain("requires uncertainty");
    }
  });

  test("its relative difference from the 2019 exact R is about 1.008e-6", () => {
    const measuredEntry = getConstantSet("scenario-gas-constant-measured").entries[0];
    expect(measuredEntry).toBeDefined();
    if (!measuredEntry) throw new Error("Missing measured entry");
    const measured = measuredEntry.value;
    const exactEntry = getConstantSet("modern-si-2019").entries.find(
      (e) => e.quantityId === "molarGasConstant",
    );
    expect(exactEntry).toBeDefined();
    if (!exactEntry) throw new Error("Missing exact molarGasConstant entry");
    const exact = exactEntry.value;
    const relativeDifference = (measured - exact) / exact;
    expect(withinTolerance(relativeDifference, 1.008e-6, { absolute: 2e-8 }).ok).toBe(true);
  });

  test("a declared set mixing a defined N_A with a measured R fails validation", () => {
    try {
      createDeclaredConstantSet({
        id: "scenario-bad-mix",
        era: 2024,
        provenance: "deliberately ambiguous",
        precisionNote: "test",
        gasConstantProvenance: "defined",
        entries: [
          {
            quantityId: "molarGasConstant",
            value: 8.314471,
            exactDecimal: "8.314471",
            unit: "J/(mol K)",
            kind: "declared-scenario",
            evidentialRole: "measured-observation",
            provenance: "test",
            dependsOn: [],
            uncertainty: 0.000014,
          },
        ],
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("ambiguous-constant-provenance");
      expect((e as Error).message).toContain("Standalone scenarios are not SI definitions");
    }
  });
});
