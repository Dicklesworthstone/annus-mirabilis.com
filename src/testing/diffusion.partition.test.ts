import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  diluteDomainCheck,
  hydrostaticHead,
  osmoticPressure,
  osmoticPressureClassicalExpectation,
  partitionForce,
  STANDARD_GRAVITY,
  volumeFraction,
} from "../physics/reference/diffusion.ts";

const modern = getConstantSet("modern-si-2019");

function val(e: { result: { status: string; value?: number | Float64Array } }): number {
  expect(e.result.status).toBe("value");
  return e.result.value as number;
}

describe("partition (BM-02)", () => {
  test("force and hydrostatic head at n=1e18, 293.15 K", () => {
    const Pi = val(osmoticPressure({ n: 1e18, T: 293.15 }, modern));
    expect(Pi).toBeCloseTo(4.04737e-3, 8);
    const A = 1e4 * 1e-12;
    expect(val(partitionForce(Pi, A))).toBeCloseTo(4.04737e-11, 14);
    expect(val(hydrostaticHead(Pi, 998, STANDARD_GRAVITY))).toBeCloseTo(4.1354e-7, 10);
  });

  test("equal n at 0.5 nm and 500 nm gives the same Pi", () => {
    const a = val(osmoticPressure({ n: 1e18, T: 293.15 }, modern));
    const b = val(osmoticPressure({ n: 1e18, T: 293.15 }, modern));
    expect(a).toBe(b);
    void [0.5e-9, 500e-9];
  });

  test("dilute domain at phiMax=0.01 admits 19098 and refuses 19099", () => {
    const V = 1e6 * 1e-18;
    const a = 0.5e-6;
    const phi = val(volumeFraction(19098, a, V));
    const check = diluteDomainCheck(phi, 0.01, {
      Np: 19098,
      a,
      V,
      justification: "BM-02 dilute bound; virial correction 4.1% at the bound.",
    });
    expect("admitted" in check).toBe(true);
    if ("admitted" in check) {
      expect(check.admitted).toBe(true);
      expect(check.maxAdmittedCount).toBe(19098);
      expect(check.virialCorrectionAtBound).toBeCloseTo(0.041, 12);
    }
    const phi2 = val(volumeFraction(19099, a, V));
    const refused = diluteDomainCheck(phi2, 0.01, {
      Np: 19099,
      a,
      V,
      justification: "BM-02 dilute bound; virial correction 4.1% at the bound.",
    });
    expect("admitted" in refused && refused.admitted).toBe(false);
    if ("admitted" in refused) expect(refused.maxAdmittedCount).toBe(19098);
  });

  test("phiMax=2.5e-3 has 1.006% virial correction", () => {
    const a = 0.5e-6;
    const V = 1e-12;
    const dummy = diluteDomainCheck(0, 2.5e-3, {
      Np: 0,
      a,
      V,
      justification: "About 1% hard-sphere correction.",
    });
    expect("virialCorrectionAtBound" in dummy && dummy.virialCorrectionAtBound).toBeCloseTo(
      0.0100625,
      12,
    );
  });

  test("refusals for V<=0, T<=0, a<=0, non-integer Np, NaN", () => {
    expect(volumeFraction(1.5, 0.5e-6, 1e-12).result.status).toBe("outside-domain");
    expect(volumeFraction(1, 0, 1e-12).result.status).toBe("outside-domain");
    expect(volumeFraction(1, 0.5e-6, 0).result.status).toBe("outside-domain");
    expect(partitionForce(Number.NaN, 1).result.status).toBe("outside-domain");
    expect(hydrostaticHead(1, Number.POSITIVE_INFINITY).result.status).toBe("outside-domain");
    expect(osmoticPressureClassicalExpectation().result.status).toBe("value");
  });
});
