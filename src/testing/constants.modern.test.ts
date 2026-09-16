import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";

function entryOf(setId: string, quantityId: string) {
  const set = getConstantSet(setId);
  const entry = set.entries.find((e) => e.quantityId === quantityId);
  if (!entry) throw new Error(`${setId} has no ${quantityId}`);
  return entry;
}

describe("modern-si-2019: the five exact SI defining constants", () => {
  test("every exact-defined entry equals the SI Brochure decimal and carries no uncertainty", () => {
    const set = getConstantSet("modern-si-2019");
    for (const entry of set.entries) {
      if (entry.kind !== "exact-defined") continue;
      expect(entry.evidentialRole).toBe("defined-exact");
      expect(Number(entry.exactDecimal)).toBe(entry.value);
      expect(entry.uncertainty).toBeUndefined();
    }
  });

  test("h, e, k_B, N_A, c match the printed SI Brochure values exactly", () => {
    expect(entryOf("modern-si-2019", "planckConstant").value).toBe(6.62607015e-34);
    expect(entryOf("modern-si-2019", "elementaryCharge").value).toBe(1.602176634e-19);
    expect(entryOf("modern-si-2019", "boltzmannConstant").value).toBe(1.380649e-23);
    expect(entryOf("modern-si-2019", "avogadroConstant").value).toBe(6.02214076e23);
    expect(entryOf("modern-si-2019", "speedOfLight").value).toBe(299792458);
  });

  test("R = N_A k_B exactly, both as the parsed decimal and as floating multiplication", () => {
    const R = entryOf("modern-si-2019", "molarGasConstant");
    const NA = entryOf("modern-si-2019", "avogadroConstant");
    const kB = entryOf("modern-si-2019", "boltzmannConstant");
    expect(R.exactDecimal).toBe("8.31446261815324");
    expect(Number("8.31446261815324")).toBe(R.value);
    expect(NA.value * kB.value).toBe(R.value);
    expect(R.dependsOn).toEqual(["avogadroConstant", "boltzmannConstant"]);
  });

  test("h/e = 4.135667696923859e-15 V s within 1e-15 relative, and every derived entry names its inputs", () => {
    const hOverE = entryOf("modern-si-2019", "planckChargeQuotient");
    const h = entryOf("modern-si-2019", "planckConstant");
    const e = entryOf("modern-si-2019", "elementaryCharge");
    expect(Math.abs(hOverE.value / (h.value / e.value) - 1)).toBeLessThan(1e-15);
    expect(hOverE.dependsOn).toEqual(["planckConstant", "elementaryCharge"]);
  });

  test("Faraday constant F = N_A e within 1e-15 relative, computed from the set's own entries", () => {
    const F = entryOf("modern-si-2019", "faradayConstant");
    const NA = entryOf("modern-si-2019", "avogadroConstant");
    const e = entryOf("modern-si-2019", "elementaryCharge");
    expect(Math.abs(F.value / (NA.value * e.value) - 1)).toBeLessThan(1e-15);
    expect(F.dependsOn).toEqual(["avogadroConstant", "elementaryCharge"]);
  });

  test("gasConstantProvenance is defined", () => {
    expect(getConstantSet("modern-si-2019").gasConstantProvenance).toBe("defined");
  });
});

describe("modern-codata-2022: measured constants carry a release and an uncertainty", () => {
  test("electron mass, vacuum permeability, and vacuum permittivity match the values fetched live from physics.nist.gov on 2026-09-16", () => {
    const set = getConstantSet("modern-codata-2022");
    expect(set.gasConstantProvenance).toBe("not-applicable");
    const me = set.entries.find((e) => e.quantityId === "electronMass");
    const mu0 = set.entries.find((e) => e.quantityId === "vacuumPermeability");
    const eps0 = set.entries.find((e) => e.quantityId === "vacuumPermittivity");
    expect(me?.value).toBe(9.1093837139e-31);
    expect(me?.uncertainty).toBeCloseTo(0.0000000028e-31, 40);
    expect(mu0?.value).toBe(1.25663706127e-6);
    expect(eps0?.value).toBe(8.8541878188e-12);
    for (const entry of set.entries) {
      expect(entry.kind).toBe("measured");
      expect(entry.uncertainty).toBeGreaterThan(0);
      expect(entry.provenance).toContain("CODATA 2022");
    }
  });
});
