import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  configurationFactorRatio,
  configurationVolumeTerm,
  lockedClusterPressure,
} from "../physics/reference/diffusion.ts";

const modern = getConstantSet("modern-si-2019");

function val(e: { result: { status: string; value?: number | Float64Array } }): number {
  expect(e.result.status).toBe("value");
  return e.result.value as number;
}

describe("configuration (BM-03)", () => {
  test("exact decimal strings for Np <= 12", () => {
    const r = configurationFactorRatio(3, "2");
    expect("decimal" in r && r.decimal).toBe("8");
    const half = configurationFactorRatio(2, "1.5");
    expect("decimal" in half && half.decimal).toBe("2.25");
  });

  test("exponents above Np=12", () => {
    const r = configurationFactorRatio(13, "2");
    expect(!("decimal" in r) || !("decimal" in r && r.decimal)).toBe(true);
    if ("ln" in r) expect(r.ln).toBeCloseTo(13 * Math.LN2, 12);
  });

  test("independent vs locked pressure at Np=1000, V=1e-12 m3, 293.15 K", () => {
    const V = 1e6 * 1e-18;
    const T = 293.15;
    const term = configurationVolumeTerm({ Np: 1000, V, V0: V, T }, modern);
    expect("pressure" in term).toBe(true);
    if ("pressure" in term) expect(val(term.pressure)).toBeCloseTo(4.0473725e-6, 12);
    const locked = lockedClusterPressure(V, T, modern);
    expect("locked" in locked).toBe(true);
    if ("locked" in locked) {
      expect(val(locked.locked)).toBeCloseTo(4.0473725e-9, 12);
      expect(locked.independent.result.status).toBe("outside-domain");
    }
  });
});
