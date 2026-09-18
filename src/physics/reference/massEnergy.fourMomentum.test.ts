import { describe, expect, it } from "bun:test";
import { evaluateFourMomentum, invariantMass } from "./massEnergy.ts";

describe("massEnergy.fourMomentum: four-momentum invariant mass mode", () => {
  const c = 299792458;
  const cSq = c * c;

  function val(res: { status: string; value?: number | Float64Array }): number {
    expect(res.status).toBe("value");
    return res.value as number;
  }

  it("single pulse carries lightlike 4-momentum: invariant mass is exactly 0", () => {
    const res1 = evaluateFourMomentum("single-pulse", 50.0);
    expect(val(res1)).toBe(0);

    const res2 = invariantMass("single-pulse", 1000.0);
    expect(val(res2)).toBe(0);
  });

  it("two collinear pulses in same direction: invariant mass is exactly 0", () => {
    const res1 = evaluateFourMomentum("two-collinear", 50.0);
    expect(val(res1)).toBe(0);

    const res2 = invariantMass("two-collinear", 1000.0);
    expect(val(res2)).toBe(0);
  });

  it("two equal opposite pulses with total energy L: invariant mass is L/c^2", () => {
    const L = 100.0; // J
    const res1 = evaluateFourMomentum("two-opposite", L);
    expect(val(res1)).toBeCloseTo(L / cSq, 25);

    const res2 = invariantMass("two-opposite", L);
    expect(val(res2)).toBeCloseTo(L / cSq, 25);
  });
});
