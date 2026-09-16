import { describe, expect, test } from "bun:test";
import {
  C_SI,
  ELEMENTARY_CHARGE,
  evaluateSr08,
  fieldInvariants,
  lorentzForce,
  transformForce3D,
  transformGaussianHistorical,
  transformSI,
  transformVelocity3D,
  type Vec3,
} from "../physics/reference/fields.ts";
import { withinTolerance } from "../units/tolerance.ts";

function valVec(res: { status: string; value?: number | Float64Array }): [number, number, number] {
  expect(res.status).toBe("value");
  const arr = res.value as Float64Array;
  return [arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0];
}

function valScalar(res: { status: string; value?: number | Float64Array }): number {
  expect(res.status).toBe("value");
  return res.value as number;
}

describe("SR-08 field transformations and force consistency", () => {
  test("pure electric Ey = 1 V/m at 0.6c gives E'y = 1.25 V/m and B'z = -0.75/c", () => {
    const snap = evaluateSr08({
      unitLayer: "si",
      descriptionFrame: "stationary",
      electricField: { x: 0, y: 1, z: 0 },
      magneticField: { x: 0, y: 0, z: 0 },
      boost: 0.6 * C_SI,
      testCharge: ELEMENTARY_CHARGE,
      chargeVelocity: { x: 0, y: 0, z: 0 },
      decomposeComponents: true,
      detectorMotion: false,
      detectorSpeed: 0,
    });

    const Eprime = valVec(snap.electricFieldMoving);
    const Bprime = valVec(snap.magneticFieldMoving);

    expect(Eprime[0]).toBe(0);
    expect(Eprime[1]).toBeCloseTo(1.25, 12);
    expect(Eprime[2]).toBe(0);

    expect(Bprime[0]).toBe(0);
    expect(Bprime[1]).toBe(0);
    expect(Bprime[2]).toBeCloseTo(-0.75 / C_SI, 12);
    expect(Bprime[2]).toBeCloseTo(-2.5017307e-9, 6);

    // Invariants
    expect(valScalar(snap.fieldInvariantEDotB)).toBeCloseTo(0, 12);
    expect(valScalar(snap.fieldInvariantE2MinusC2B2)).toBeCloseTo(1.0, 12);
    expect(valScalar(snap.lorentzFactor)).toBeCloseTo(1.25, 12);
  });

  test("pure magnetic Bz = 1 T at 10 m/s gives E'y ≈ -10 V/m", () => {
    const snap = evaluateSr08({
      unitLayer: "si",
      descriptionFrame: "stationary",
      electricField: { x: 0, y: 0, z: 0 },
      magneticField: { x: 0, y: 0, z: 1 },
      boost: 10,
      testCharge: ELEMENTARY_CHARGE,
      chargeVelocity: { x: 0, y: 0, z: 0 },
      decomposeComponents: true,
      detectorMotion: false,
      detectorSpeed: 0,
    });

    const Eprime = valVec(snap.electricFieldMoving);
    expect(Eprime[1]).toBeCloseTo(-10, 8);
  });

  test("historical Gaussian transform matches Einstein 1905 §6", () => {
    const E: Vec3 = { x: 10, y: 20, z: 30 };
    const B: Vec3 = { x: 5, y: 15, z: 25 };
    const res = transformGaussianHistorical({ E, B, boost: 0.6 * C_SI });

    const β = 1.25;
    const vOverC = 0.6;
    expect(res.beta).toBeCloseTo(β, 12);
    expect(res.E.x).toBeCloseTo(E.x, 12);
    expect(res.E.y).toBeCloseTo(β * (E.y - vOverC * B.z), 12);
    expect(res.E.z).toBeCloseTo(β * (E.z + vOverC * B.y), 12);
    expect(res.B.x).toBeCloseTo(B.x, 12);
    expect(res.B.y).toBeCloseTo(β * (B.y + vOverC * E.z), 12);
    expect(res.B.z).toBeCloseTo(β * (B.z - vOverC * E.y), 12);
  });

  test("boost inverse round-trip v -> -v recovers original fields within 1e-12", () => {
    const E0: Vec3 = { x: 12.34, y: -56.78, z: 90.12 };
    const B0: Vec3 = { x: 1.23e-4, y: -4.56e-5, z: 7.89e-4 };
    const boost = 0.8 * C_SI;

    const fwd = transformSI({ E: E0, B: B0, boost });
    const bwd = transformSI({ E: fwd.E, B: fwd.B, boost: -boost });

    expect(withinTolerance(bwd.E.x, E0.x, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(bwd.E.y, E0.y, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(bwd.E.z, E0.z, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(bwd.B.x, B0.x, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(bwd.B.y, B0.y, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(bwd.B.z, B0.z, { relative: 1e-12 }).ok).toBe(true);
  });

  test("generic moving charge: force from transformed fields matches relativistic force law", () => {
    const E0: Vec3 = { x: 100, y: 200, z: -150 };
    const B0: Vec3 = { x: 1e-3, y: -2e-3, z: 3e-3 };
    const u0: Vec3 = { x: 0.3 * C_SI, y: -0.2 * C_SI, z: 0.1 * C_SI };
    const boost = 0.5 * C_SI;
    const q = ELEMENTARY_CHARGE;

    // Direct Lorentz force in lab frame
    const F_lab = lorentzForce(q, E0, B0, u0);

    // Transform force directly via relativistic transformation
    const F_transformed = transformForce3D(F_lab, u0, boost, C_SI);

    // Transformed fields and velocity
    const primed = transformSI({ E: E0, B: B0, boost, c: C_SI });
    const u_prime = transformVelocity3D(u0, boost, C_SI);

    // Lorentz force computed in primed frame from transformed fields
    const F_comoving = lorentzForce(q, primed.E, primed.B, u_prime);

    expect(withinTolerance(F_comoving.x, F_transformed.x, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(F_comoving.y, F_transformed.y, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(F_comoving.z, F_transformed.z, { relative: 1e-12 }).ok).toBe(true);
  });

  test("500 random fields and velocities preserve invariants and satisfy force law", () => {
    let seed = 123456789;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    for (let i = 0; i < 500; i++) {
      const Ex = (rand() - 0.5) * 1000;
      const Ey = (rand() - 0.5) * 1000;
      const Ez = (rand() - 0.5) * 1000;
      const Bx = (rand() - 0.5) * 0.1;
      const By = (rand() - 0.5) * 0.1;
      const Bz = (rand() - 0.5) * 0.1;

      const ux = (rand() - 0.5) * 0.5 * C_SI;
      const uy = (rand() - 0.5) * 0.5 * C_SI;
      const uz = (rand() - 0.5) * 0.5 * C_SI;

      const boost = (rand() - 0.5) * 1.6 * C_SI; // |boost| < 0.8c
      const q = (rand() - 0.5) * 1e-6;

      const E: Vec3 = { x: Ex, y: Ey, z: Ez };
      const B: Vec3 = { x: Bx, y: By, z: Bz };
      const u: Vec3 = { x: ux, y: uy, z: uz };

      const inv0 = fieldInvariants(E, B, C_SI);
      const primed = transformSI({ E, B, boost, c: C_SI });
      const inv1 = fieldInvariants(primed.E, primed.B, C_SI);

      // Invariant preservation
      const dotDiff = Math.abs(inv0.eDotB - inv1.eDotB);
      const dotScale = Math.max(Math.abs(inv0.eDotB), Math.abs(inv1.eDotB), 1e-10);
      expect(dotDiff / dotScale).toBeLessThan(1e-9);

      const diffDiff = Math.abs(inv0.e2MinusC2B2 - inv1.e2MinusC2B2);
      const diffScale = Math.max(Math.abs(inv0.e2MinusC2B2), Math.abs(inv1.e2MinusC2B2), 1e-6);
      expect(diffDiff / diffScale).toBeLessThan(1e-9);

      // Force law consistency
      const F_lab = lorentzForce(q, E, B, u);
      const F_law = transformForce3D(F_lab, u, boost, C_SI);
      const u_prime = transformVelocity3D(u, boost, C_SI);
      const F_primed = lorentzForce(q, primed.E, primed.B, u_prime);

      const fxDiff = Math.abs(F_primed.x - F_law.x);
      const fxScale = Math.max(Math.abs(F_primed.x), Math.abs(F_law.x), 1e-25);
      expect(fxDiff / fxScale).toBeLessThan(1e-10);

      const fyDiff = Math.abs(F_primed.y - F_law.y);
      const fyScale = Math.max(Math.abs(F_primed.y), Math.abs(F_law.y), 1e-25);
      expect(fyDiff / fyScale).toBeLessThan(1e-10);

      const fzDiff = Math.abs(F_primed.z - F_law.z);
      const fzScale = Math.max(Math.abs(F_primed.z), Math.abs(F_law.z), 1e-25);
      expect(fzDiff / fzScale).toBeLessThan(1e-10);
    }
  });

  test("superluminal inputs produce typed outside-domain status", () => {
    const snap = evaluateSr08({
      unitLayer: "si",
      descriptionFrame: "stationary",
      electricField: { x: 0, y: 1, z: 0 },
      magneticField: { x: 0, y: 0, z: 0 },
      boost: 1.05 * C_SI,
      testCharge: ELEMENTARY_CHARGE,
      chargeVelocity: { x: 0, y: 0, z: 0 },
      decomposeComponents: true,
      detectorMotion: false,
      detectorSpeed: 0,
    });

    expect(snap.electricFieldMoving.status).toBe("outside-domain");
    expect(snap.lorentzFactor.status).toBe("outside-domain");
  });
});
