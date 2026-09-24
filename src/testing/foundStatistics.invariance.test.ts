import { describe, expect, test } from "bun:test";
import { type ConstantSet, createDeclaredConstantSet } from "../physics/reference/constants.ts";
import { stokesEinsteinD } from "../physics/reference/diffusion.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * am-found-statistics-inference-pzqv: "The invariance is asserted numerically, not only stated: for
 * fixed R, T, η, doubling a and halving N reproduces the same D to within 10⁻¹² relative, computed
 * through am-ref-diffusion-lr3 and compared with withinTolerance."
 *
 * The two-measurements lesson says it in words: "Double the radius and halve N, and the product,
 * and with it D, is exactly what it was." N reaches the Stokes-Einstein owner only through a
 * constant set, as k = R/N, so each case declares a scenario set that differs from the others in
 * N alone. These are declared scenario inputs, not a printed or measured set.
 */

const R = 8.31;
const CONDITIONS = { T: 290.15, eta: 1.35e-3 } as const;
const RELATIVE = { relative: 1e-12 } as const;

function withN(label: string, N: number, decimal: string): ConstantSet {
  return createDeclaredConstantSet({
    id: `scenario-two-measurements-${label}`,
    era: 1905,
    provenance: "Declared inputs for the two-measurements invariance check; only N differs.",
    precisionNote: "Exact inputs chosen to test an identity, not a measurement.",
    gasConstantProvenance: "not-applicable",
    entries: [
      {
        quantityId: "molarGasConstant",
        value: R,
        exactDecimal: "8.31",
        unit: "J/(mol K)",
        kind: "declared-scenario",
        evidentialRole: "declared-input",
        provenance: "The same R in every case.",
        dependsOn: [],
      },
      {
        quantityId: "avogadroConstant",
        value: N,
        exactDecimal: decimal,
        unit: "1/mol",
        kind: "declared-scenario",
        evidentialRole: "declared-input",
        provenance: "The N this case assumes.",
        dependsOn: [],
      },
    ],
  });
}

function D(a: number, set: ConstantSet): number {
  const result = stokesEinsteinD({ ...CONDITIONS, a }, set).result;
  if (result.status !== "value" || typeof result.value !== "number")
    throw new TypeError(`stokesEinsteinD returned ${result.status}`);
  return result.value;
}

const base = withN("n6e23", 6e23, "6e23");

describe("a larger radius with a proportionally smaller N gives the same D", () => {
  const cases = [
    ["doubling a and halving N", 2, withN("n3e23", 3e23, "3e23")],
    ["tripling a and dividing N by three", 3, withN("n2e23", 2e23, "2e23")],
    ["ten times a and a tenth of N", 10, withN("n6e22", 6e22, "6e22")],
  ] as const;
  for (const [name, factor, set] of cases)
    test(`${name}: D agrees to 10⁻¹² relative`, () => {
      const a = 0.5e-6;
      expect(withinTolerance(D(factor * a, set), D(a, base), RELATIVE).ok).toBe(true);
    });

  test("the control: doubling a alone halves D, so the check can fail", () => {
    const a = 0.5e-6;
    expect(withinTolerance(D(2 * a, base), D(a, base), RELATIVE).ok).toBe(false);
    expect(withinTolerance(D(2 * a, base), D(a, base) / 2, RELATIVE).ok).toBe(true);
  });
});
