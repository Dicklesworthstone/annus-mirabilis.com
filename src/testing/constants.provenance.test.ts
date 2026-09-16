import { describe, expect, test } from "bun:test";
import { createDeclaredConstantSet, getConstantSet } from "../physics/reference/constants.ts";

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

  test("scenario-gas-constant-measured is measured-without-counting-molecules and contains no N_A or k_B", () => {
    const set = getConstantSet("scenario-gas-constant-measured");
    expect(set.gasConstantProvenance).toBe("measured-without-counting-molecules");
    expect(set.entries.some((e) => e.quantityId === "avogadroConstant")).toBe(false);
    expect(set.entries.some((e) => e.quantityId === "boltzmannConstant")).toBe(false);
  });
});

describe("scenario-gas-constant-measured: the standalone Moldover 1988 set", () => {
  test("its one entry carries the standard uncertainty and CODATA-style precision", () => {
    const set = getConstantSet("scenario-gas-constant-measured");
    expect(set.entries).toHaveLength(1);
    const R = set.entries[0]!;
    expect(R.quantityId).toBe("molarGasConstant");
    expect(R.value).toBe(8.314471);
    expect(R.uncertainty).toBe(0.000014);
    expect(R.evidentialRole).toBe("measured-observation");
  });

  test("a copy without the uncertainty fails validation", () => {
    expect(() =>
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
      }),
    ).toThrow(/measured-missing-uncertainty/);
  });

  test("its relative difference from the 2019 exact R is about 1.008e-6", () => {
    const measured = getConstantSet("scenario-gas-constant-measured").entries[0]!.value;
    const exact = getConstantSet("modern-si-2019").entries.find((e) => e.quantityId === "molarGasConstant")!.value;
    const relativeDifference = (measured - exact) / exact;
    expect(Math.abs(relativeDifference - 1.008e-6)).toBeLessThan(2e-8);
  });

  test("a declared set mixing a defined N_A with a measured R fails validation", () => {
    expect(() =>
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
      }),
    ).toThrow(/ambiguous-constant-provenance|not SI definitions/);
  });
});
