import { describe, expect, test } from "bun:test";
import { createDeclaredConstantSet, getConstantSet } from "../physics/reference/constants.ts";
import { rmsDisplacement, stokesEinsteinD } from "../physics/reference/diffusion.ts";

function val(e: { result: { status: string; value?: number | Float64Array } }): number {
  expect(e.result.status).toBe("value");
  return e.result.value as number;
}

/**
 * Scenario id `diffusion-einstein-1905-printed` (am-ref-diffusion-lr3).
 * Constant set id `einstein-1905-brownian-printed` is reserved for am-ref-constants-xik
 * and is not registered; the arithmetic uses a declared scenario with Einstein's printed
 * R = 8.31 J mol^-1 K^-1 and N = 6e23 mol^-1, never modern k_B.
 */
const SCENARIO_ID = "diffusion-einstein-1905-printed";

function printedSet() {
  return createDeclaredConstantSet({
    id: "scenario-einstein-1905-brownian-printed",
    era: 1905,
    provenance:
      "Declared editorial inputs matching Einstein 1905 printed R and N. The reserved historical set einstein-1905-brownian-printed is not registered (am-ref-constants-xik).",
    precisionNote: "Two-significant-figure comparison to 0,8 Mikron and ca. 6 Mikron.",
    gasConstantProvenance: "measured-without-counting-molecules",
    entries: [
      {
        quantityId: "molarGasConstant",
        value: 8.31,
        exactDecimal: "8.31",
        unit: "J/(mol K)",
        kind: "declared-scenario",
        evidentialRole: "measured-observation",
        provenance: "Paper 2 printed R = 8.31e7 erg mol^-1 K^-1.",
        dependsOn: [],
      },
      {
        quantityId: "avogadroConstant",
        value: 6e23,
        exactDecimal: "6e23",
        unit: "1/mol",
        kind: "declared-scenario",
        evidentialRole: "measured-observation",
        provenance: "Paper 2 printed N = 6e23 mol^-1.",
        dependsOn: [],
      },
    ],
  });
}

describe(`scenario ${SCENARIO_ID}`, () => {
  test("reserved printed set is not registered; declared R/N path never reads modern k_B", () => {
    expect(() => getConstantSet("einstein-1905-brownian-printed")).toThrow();
    const set = printedSet();
    expect(set.id).not.toBe("modern-si-2019");
    expect(set.entries.some((e) => e.quantityId === "boltzmannConstant")).toBe(false);
  });

  test("stated a=0.5 um, eta=1.35e-3, T=290.15 give 0.7947833 um at 1 s and 6.156365 um at 60 s", () => {
    const set = printedSet();
    const D = stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 0.5e-6 }, set);
    expect(D.constantSetId).toBe(set.id);
    const one = val(rmsDisplacement(val(D), 1));
    const sixty = val(rmsDisplacement(val(D), 60));
    expect(Math.abs(one / 0.7947833e-6 - 1)).toBeLessThan(1e-6);
    expect(Math.abs(sixty / 6.156365e-6 - 1)).toBeLessThan(1e-6);
    const caption = `about 0.8 micron at 1 s and about 6 micron at 60 s (set ${set.id}, scenario ${SCENARIO_ID})`;
    expect(caption.includes("6.1 μm")).toBe(false);
    expect(caption.includes("6.1 um")).toBe(false);
  });

  test("modern k_B with the printed viscosity is a different scenario, not the historical path", () => {
    const modern = getConstantSet("modern-si-2019");
    const D = stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 0.5e-6 }, modern);
    const one = val(rmsDisplacement(val(D), 1));
    const sixty = val(rmsDisplacement(val(D), 60));
    expect(Math.abs(one / 0.7935339e-6 - 1)).toBeLessThan(1e-6);
    expect(Math.abs(sixty / 6.146687e-6 - 1)).toBeLessThan(1e-6);
    expect(D.constantSetId).toBe("modern-si-2019");
  });
});
