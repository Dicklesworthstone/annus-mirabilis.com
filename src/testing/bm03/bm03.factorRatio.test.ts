import { describe, expect, test } from "bun:test";
import { configurationFactorRatio } from "../../physics/reference/diffusion/routeA.ts";

/**
 * (V/V0)^Np as a double, when one exists. Math.exp(Np ln r) used to stand in for it: it published a
 * finite 1.7976931348622732e308 for 2^1024, which overflows a double; exactly 0 for 0.5^1100, a
 * positive ratio; and 2^500 wrong in the 14th digit although 2^500 is exact in binary.
 */
const dbl = (Np: number, r: string) => {
  const f = configurationFactorRatio(Np, r);
  if (!("representableDouble" in f)) throw new Error(`expected a factor ratio for ${Np}, ${r}`);
  return f.representableDouble;
};

describe("bm-03 factor ratio as a double", () => {
  test("powers of two are exact while they fit: 2^500 and 2^1023", () => {
    expect(dbl(500, "2")).toBe(2 ** 500);
    expect(dbl(1023, "2")).toBe(2 ** 1023);
  });

  test("the overflow-guard preset, 2^1024, is not representable", () => {
    expect(dbl(1024, "2")).toBeNull();
    expect(dbl(1_000_000, "2")).toBeNull();
  });

  test("a positive ratio that underflows is not published as 0", () => {
    expect(dbl(1100, "0.5")).toBeNull();
    expect(dbl(1_000_000, "0.5")).toBeNull();
  });

  test("small cases are exact: 2^2, 2^12 and 1.5^3", () => {
    expect(dbl(2, "2")).toBe(4);
    expect(dbl(12, "2")).toBe(4096);
    expect(dbl(3, "1.5")).toBe(3.375);
  });
});
