import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import {
  C_SI,
  dipoleField,
  ELEMENTARY_CHARGE,
  evaluateSr02,
  fieldInvariants,
  forceConsistency,
  MU0,
  PATH_REFUSAL_REASON,
  transformSI,
} from "./fields.ts";
import { gamma, gammaMinusOne } from "./kinematics.ts";

const uniform10 = {
  mode: "analytic" as const,
  descriptionFrame: "magnet-rest" as const,
  speed: 10,
  fieldModel: "uniform" as const,
  magneticField: 1,
  dipoleMoment: 1,
  testPointDistance: 0.05,
  segmentLength: 0.1,
  testCharge: ELEMENTARY_CHARGE,
  pathOrientation: "transverse" as const,
  sliceDeclared: false,
};

function val(result: { status: string; value?: number | Float64Array }): number {
  expect(result.status).toBe("value");
  return result.value as number;
}

describe("SR-02 field owner", () => {
  test("uniform 10 m/s: magnet-frame EMF is 1 V and the excess is 5.563e-16", () => {
    const snap = evaluateSr02(uniform10);
    expect(val(snap.emfMagnet)).toBeCloseTo(1, 12);
    const gmo = gammaMinusOne(10 / C_SI);
    expect(gmo.status).toBe("value");
    if (gmo.status === "value") {
      expect(val(snap.emfExcess)).toBe(gmo.value);
      expect(
        withinTolerance(gmo.value, 5.563e-16, { relative: 1e-3, relativeTo: "reference" }).ok,
      ).toBe(true);
    }
    const naive = 1 / Math.sqrt(1 - (10 / C_SI) ** 2) - 1;
    if (gmo.status === "value") {
      expect(Math.abs(naive - gmo.value) / gmo.value).toBeGreaterThan(0.1);
    }
  });

  test("uniform 0.6c: ratio is exactly 1.25 and the two EMFs are not equal", () => {
    const snap = evaluateSr02({ ...uniform10, speed: 0.6 * C_SI });
    expect(val(snap.lorentzFactor)).toBe(1.25);
    expect(val(snap.emfConductor) / val(snap.emfMagnet)).toBeCloseTo(1.25, 12);
    expect(val(snap.emfMagnet)).not.toBe(val(snap.emfConductor));
    expect(val(snap.endpointOffset)).toBe(0);
  });

  test("F_perp = F'_perp / gamma within 1e-12 relative", () => {
    const snap = evaluateSr02({ ...uniform10, speed: 0.6 * C_SI });
    expect(
      forceConsistency(val(snap.forceMagnet), val(snap.forceConductor), val(snap.lorentzFactor)),
    ).toBe(true);
  });

  test("invariants agree in both frames", () => {
    const snap = evaluateSr02(uniform10);
    expect(val(snap.invariantDot)).toBeCloseTo(0, 12);
    const E = { x: 0, y: 0, z: 0 };
    const B = { x: 0, y: 0, z: 1 };
    const primed = transformSI({ E, B, boost: 10 });
    const a = fieldInvariants(E, B);
    const b = fieldInvariants(primed.E, primed.B);
    expect(a.eDotB).toBeCloseTo(b.eDotB, 12);
    expect(
      withinTolerance(a.e2MinusC2B2, b.e2MinusC2B2, { relative: 1e-12, relativeTo: "reference" })
        .ok,
    ).toBe(true);
  });

  test("dipole equatorial B is 8.000e-4 T and |F| on e at 10 m/s is 1.2817e-21 N", () => {
    const B = dipoleField({ x: 0, y: 0, z: 1 }, { x: 0.05, y: 0, z: 0 }, MU0);
    expect(Math.abs(B.z)).toBeCloseTo(8e-4, 6);
    const snap = evaluateSr02({ ...uniform10, fieldModel: "dipole" });
    expect(val(snap.magneticFieldMagnet)).toBeCloseTo(8e-4, 6);
    expect(Math.abs(val(snap.forceMagnet))).toBeCloseTo(1.28174e-21, 6);
  });

  test("a path along the boost at 0.6c is not-applicable and the offset is 2.50173071e-10 s", () => {
    const snap = evaluateSr02({
      ...uniform10,
      speed: 0.6 * C_SI,
      pathOrientation: "along-motion",
    });
    expect(snap.emfConductor.status).toBe("not-applicable");
    if (snap.emfConductor.status === "not-applicable") {
      expect(snap.emfConductor.reason).toBe(PATH_REFUSAL_REASON);
    }
    expect(val(snap.endpointOffset)).toBeCloseTo(2.50173071e-10, 8);
    const g = gamma(0.6);
    if (g.status === "value") {
      expect(val(snap.endpointOffset)).toBeCloseTo((g.value * 0.6 * 0.1) / C_SI, 12);
    }
  });

  test("a transverse path has offset exactly 0 at a seeded list of speeds", () => {
    for (let i = 1; i <= 100; i++) {
      const beta = (0.9 * i) / 100;
      const snap = evaluateSr02({ ...uniform10, speed: beta * C_SI });
      expect(val(snap.endpointOffset)).toBe(0);
      expect(val(snap.pathParallel)).toBe(0);
    }
  });

  test("declaring the slice makes the along-motion comparison a named-frame value", () => {
    const snap = evaluateSr02({
      ...uniform10,
      speed: 0.6 * C_SI,
      pathOrientation: "along-motion",
      sliceDeclared: true,
    });
    expect(snap.emfConductor.status).toBe("value");
    expect(val(snap.lorentzFactor)).toBe(1.25);
  });

  test("apparatus mode publishes only symbolic outputs", () => {
    const snap = evaluateSr02({ ...uniform10, mode: "apparatus" });
    expect(snap.emfMagnet.status).toBe("symbolic");
    expect(snap.emfConductor.status).toBe("symbolic");
    expect(snap.circuitCurrent.status).toBe("symbolic");
  });

  test("a boost-parallel line integral is not gamma even though the pointwise force is", () => {
    const along = evaluateSr02({
      ...uniform10,
      speed: 0.6 * C_SI,
      pathOrientation: "along-motion",
    });
    expect(
      forceConsistency(val(along.forceMagnet), val(along.forceConductor), val(along.lorentzFactor)),
    ).toBe(true);
    expect(along.emfConductor.status).toBe("not-applicable");
  });
});
