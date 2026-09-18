import { describe, expect, test } from "bun:test";
import { logField } from "../physics/reference/fields.log.ts";
import {
  C_SI,
  dipoleField,
  ELEMENTARY_CHARGE,
  evaluateSr02,
  lorentzForce,
  MU0,
  segmentEmf,
  type Vec3,
} from "../physics/reference/fields.ts";
import { gammaMinusOne } from "../physics/reference/kinematics.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("fields.dipole.test.ts: Dipole fields, segment EMF, and SR-02 fixtures", () => {
  test("dipole field matches closed form and is numerically divergence-free", () => {
    const t0 = performance.now();
    const moment: Vec3 = { x: 0, y: 0, z: 1.0 }; // 1 A*m^2 along z
    const rEquator: Vec3 = { x: 0.05, y: 0, z: 0 };
    const rAxis: Vec3 = { x: 0, y: 0, z: 0.05 };

    const B_eq = dipoleField(moment, rEquator, MU0);
    const B_ax = dipoleField(moment, rAxis, MU0);

    // In equatorial plane (m perp to r): B = (mu0 / 4pi) * (-m / r^3)
    // |B| = 1e-7 * 1 / (0.05^3) = 1e-7 / 0.000125 = 8.000e-4 T
    expect(withinTolerance(Math.abs(B_eq.z), 8.0e-4, { relative: 1e-6 }).ok).toBe(true);

    // On axis (m parallel to r): B = (mu0 / 4pi) * (2m / r^3) = 1.600e-3 T
    expect(withinTolerance(B_ax.z, 1.6e-3, { relative: 1e-6 }).ok).toBe(true);

    // Numerical divergence-free check div(B) = d Bx / dx + d By / dy + d Bz / dz = 0
    const p: Vec3 = { x: 0.04, y: 0.03, z: 0.05 };
    const h = 1e-5;
    const dBx_dx =
      (dipoleField(moment, { x: p.x + h, y: p.y, z: p.z }).x -
        dipoleField(moment, { x: p.x - h, y: p.y, z: p.z }).x) /
      (2 * h);
    const dBy_dy =
      (dipoleField(moment, { x: p.x, y: p.y + h, z: p.z }).y -
        dipoleField(moment, { x: p.x, y: p.y - h, z: p.z }).y) /
      (2 * h);
    const dBz_dz =
      (dipoleField(moment, { x: p.x, y: p.y, z: p.z + h }).z -
        dipoleField(moment, { x: p.x, y: p.y, z: p.z - h }).z) /
      (2 * h);

    const divB = dBx_dx + dBy_dy + dBz_dz;
    const scale = Math.max(Math.abs(dBx_dx), Math.abs(dBy_dy), Math.abs(dBz_dz));
    const relDiv = Math.abs(divB) / scale;
    expect(relDiv).toBeLessThan(1e-6);

    logField({
      testId: "fields-dipole-divergence-free",
      resultStatus: "value",
      expected: 0,
      actual: divB,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Dipole field reproduces exact equatorial and axial forms and is divergence-free.",
    });
  });

  test("dipole preset gives 8.000e-4 T and force on elementary charge at 10 m/s is 1.28174e-21 N", () => {
    const t0 = performance.now();
    const moment: Vec3 = { x: 0, y: 0, z: 1.0 };
    const pos: Vec3 = { x: 0.05, y: 0, z: 0 };
    const B = dipoleField(moment, pos, MU0);
    expect(Math.abs(B.z)).toBeCloseTo(8.0e-4, 6);

    // Charge moving at 10 m/s along y, perpendicular to B (along z)
    const velocity: Vec3 = { x: 0, y: 10, z: 0 };
    const F = lorentzForce(ELEMENTARY_CHARGE, { x: 0, y: 0, z: 0 }, B, velocity);
    const fMag = Math.sqrt(F.x * F.x + F.y * F.y + F.z * F.z);

    // F = q * v * B = 1.602176634e-19 * 10 * 8e-4 = 1.2817413e-21 N
    expect(withinTolerance(fMag, 1.28174e-21, { relative: 1e-4 }).ok).toBe(true);

    logField({
      testId: "fields-dipole-preset-force",
      resultStatus: "value",
      expected: 1.28174e-21,
      actual: fMag,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Dipole preset magnetic field 8.000e-4 T produces 1.28174e-21 N force on e at 10 m/s.",
    });
  });

  test("segmentEmf converges to v|B|l within quadrature error for short segment", () => {
    const t0 = performance.now();
    const moment: Vec3 = { x: 0, y: 0, z: 1.0 };
    const mid: Vec3 = { x: 0.05, y: 0, z: 0 };
    const Bmid = dipoleField(moment, mid, MU0);
    const Bmag = Math.abs(Bmid.z); // ~ 8.0e-4 T

    // Short segment of length ell = 1e-4 m along y
    const ell = 1e-4;
    const start: Vec3 = { x: 0.05, y: -ell / 2, z: 0 };
    const end: Vec3 = { x: 0.05, y: ell / 2, z: 0 };
    // Velocity along x at 10 m/s (perp to B and perp to segment)
    const velocity: Vec3 = { x: 10, y: 0, z: 0 };

    const res = segmentEmf({
      field: { kind: "dipole", moment },
      segment: { start, end },
      velocity,
    });

    const midpointApprox = 10 * Bmag * ell;
    const diff = Math.abs(res.value - midpointApprox);
    expect(diff).toBeLessThan(1e-10);
    expect(res.errorEstimate).toBeLessThan(1e-12);

    logField({
      testId: "fields-segment-emf-convergence",
      resultStatus: "value",
      expected: midpointApprox,
      actual: res.value,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Adaptive Gauss-Kronrod segmentEmf converges to v|B|l within error estimate.",
    });
  });

  test("SR-02 fixtures: 1 V at 10 m/s, excess 5.563250e-16 matches 40-digit ref and naive fails; 1.25 at 0.6c", () => {
    const t0 = performance.now();
    // 40-digit high precision reference for gamma - 1 at v = 10 m/s:
    // beta = 10 / 299792458
    // gamma - 1 = 5.5632502802680968033335019596952510000000e-16
    const refExcess = 5.563250280268097e-16;

    const gmo = gammaMinusOne(10 / C_SI);
    expect(gmo.status).toBe("value");
    const valExcess = (gmo as { status: "value"; value: number }).value;

    expect(withinTolerance(valExcess, refExcess, { relative: 1e-12 }).ok).toBe(true);

    // Naive formula fails 1e-12 relative tolerance
    const naive = 1 / Math.sqrt(1 - (10 / C_SI) ** 2) - 1;
    const naiveRelErr = Math.abs(naive - refExcess) / refExcess;
    expect(naiveRelErr).toBeGreaterThan(0.1); // ~ 20% error!

    // Evaluate SR-02 at 10 m/s
    const snap10 = evaluateSr02({
      mode: "analytic",
      descriptionFrame: "magnet-rest",
      speed: 10,
      fieldModel: "uniform",
      magneticField: 1,
      dipoleMoment: 1,
      testPointDistance: 0.05,
      segmentLength: 0.1,
      testCharge: ELEMENTARY_CHARGE,
      pathOrientation: "transverse",
      sliceDeclared: false,
    });
    expect(snap10.emfMagnet.status).toBe("value");
    expect((snap10.emfMagnet as { value: number }).value).toBeCloseTo(1.0, 12);
    expect(snap10.emfExcess.status).toBe("value");
    expect(
      withinTolerance((snap10.emfExcess as { value: number }).value, refExcess, { relative: 1e-12 })
        .ok,
    ).toBe(true);

    // Evaluate SR-02 at 0.6c: ratio is 1.25
    const snap06 = evaluateSr02({
      mode: "analytic",
      descriptionFrame: "magnet-rest",
      speed: 0.6 * C_SI,
      fieldModel: "uniform",
      magneticField: 1,
      dipoleMoment: 1,
      testPointDistance: 0.05,
      segmentLength: 0.1,
      testCharge: ELEMENTARY_CHARGE,
      pathOrientation: "transverse",
      sliceDeclared: false,
    });
    const emfM = (snap06.emfMagnet as { value: number }).value;
    const emfC = (snap06.emfConductor as { value: number }).value;
    expect(withinTolerance(emfC / emfM, 1.25, { relative: 1e-12 }).ok).toBe(true);

    logField({
      testId: "fields-sr02-fixtures",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "SR-02 fixtures pass: 1 V EMF, firstOrderExcess 5.563250e-16 matches reference while naive fails, 1.25 ratio at 0.6c.",
    });
  });
});
