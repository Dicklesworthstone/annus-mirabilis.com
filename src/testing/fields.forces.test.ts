import { describe, expect, test } from "bun:test";
import { logField, logFieldFailure } from "../physics/reference/fields.log.ts";
import {
  C_SI,
  forceConsistency,
  lorentzForce,
  transformSI,
  transformVelocity3D,
  type Vec3,
} from "../physics/reference/fields.ts";
import { gamma } from "../physics/reference/kinematics.ts";
import { withinTolerance } from "../units/tolerance.ts";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("fields.forces.test.ts: Lorentz force law and force transformation consistency", () => {
  test("generic fixture with c=1, q=1, beta=0.6 matches exact analytical outputs by both routes", () => {
    const t0 = performance.now();
    const c = 1;
    const q = 1;
    const beta = 0.6;
    const E: Vec3 = { x: 0.3, y: 0.5, z: -0.2 };
    const B: Vec3 = { x: 0.1, y: -0.4, z: 0.6 };
    const u: Vec3 = { x: 0.2, y: 0.1, z: -0.3 };

    const res = forceConsistency(q, { E, B }, u, beta, c);

    // Initial force F = (0.24, 0.35, -0.29)
    expect(res.F_K.x).toBeCloseTo(0.24, 10);
    expect(res.F_K.y).toBeCloseTo(0.35, 10);
    expect(res.F_K.z).toBeCloseTo(-0.29, 10);

    // Transformed force F' = (0.15681818, 0.31818182, -0.26363636)
    const expectedX = 69 / 440; // 0.15681818...
    const expectedY = 7 / 22; // 0.31818181...
    const expectedZ = -29 / 110; // -0.26363636...

    expect(withinTolerance(res.F_prime_transformed.x, expectedX, { relative: 1e-12 }).ok).toBe(
      true,
    );
    expect(withinTolerance(res.F_prime_transformed.y, expectedY, { relative: 1e-12 }).ok).toBe(
      true,
    );
    expect(withinTolerance(res.F_prime_transformed.z, expectedZ, { relative: 1e-12 }).ok).toBe(
      true,
    );

    expect(withinTolerance(res.F_prime_direct.x, expectedX, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(res.F_prime_direct.y, expectedY, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(res.F_prime_direct.z, expectedZ, { relative: 1e-12 }).ok).toBe(true);

    expect(res.consistent).toBe(true);
    expect(res.maxRelError).toBeLessThan(1e-12);

    logField({
      testId: "fields-forces-generic-fixture",
      beta,
      resultStatus: "value",
      expected: [expectedX, expectedY, expectedZ],
      actual: [res.F_prime_transformed.x, res.F_prime_transformed.y, res.F_prime_transformed.z],
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Generic fixture reproduces exact rational transformed force components within 1e-12 relative.",
    });
  });

  test("500 seeded random configurations agree within 1e-12 relative between transformed force and direct force", () => {
    const t0 = performance.now();
    const rng = seededRandom(777);

    for (let i = 0; i < 500; i++) {
      const beta = rng() * 1.8 - 0.9; // between -0.9 and 0.9
      const q = (rng() - 0.5) * 10;
      const E: Vec3 = {
        x: (rng() - 0.5) * 100,
        y: (rng() - 0.5) * 100,
        z: (rng() - 0.5) * 100,
      };
      const B: Vec3 = {
        x: (rng() - 0.5) * 2,
        y: (rng() - 0.5) * 2,
        z: (rng() - 0.5) * 2,
      };
      // particle speed |u| < 0.95c
      const ux = (rng() - 0.5) * 0.8 * C_SI;
      const uy = (rng() - 0.5) * 0.8 * C_SI;
      const uz = (rng() - 0.5) * 0.8 * C_SI;
      const u: Vec3 = { x: ux, y: uy, z: uz };

      const res = forceConsistency(q, { E, B }, u, beta, C_SI);

      if (!res.consistent) {
        logFieldFailure("fields-force-consistency-fail", { i, beta, q, E, B, u, res });
      }

      expect(res.consistent).toBe(true);
      expect(res.maxRelError).toBeLessThan(1e-12);
    }

    logField({
      testId: "fields-forces-500-random-configurations",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "500 seeded random configurations verify force transformation consistency within 1e-12 relative.",
    });
  });

  test("transverse special case: charge at rest in moving frame under purely magnetic lab field has F_perp = F'_perp / gamma", () => {
    const t0 = performance.now();
    const q = 2.5;
    const beta = 0.6;
    const v = beta * C_SI;
    const E: Vec3 = { x: 0, y: 0, z: 0 };
    const B: Vec3 = { x: 0, y: 0, z: 1.2 };
    // particle comoving with the moving frame, so u = (v, 0, 0)
    const u: Vec3 = { x: v, y: 0, z: 0 };

    const gRes = gamma(beta);
    expect(gRes.status).toBe("value");
    const γ = (gRes as { status: "value"; value: number }).value;

    const FK = lorentzForce(q, E, B, u);
    // FK = q * (v x B) = (0, -q * v * Bz, 0)
    expect(FK.x).toBe(0);
    expect(FK.y).toBeCloseTo(-q * v * B.z, 10);
    expect(FK.z).toBe(0);

    // In comoving frame, charge is at rest (u' = 0)
    const uPrime = transformVelocity3D(u, v, C_SI);
    expect(Math.abs(uPrime.x)).toBeLessThan(1e-10);

    const tf = transformSI({ E, B, boost: v, c: C_SI });
    const FPrime = lorentzForce(q, tf.E, tf.B, uPrime);

    // F'_perp = q * E'_y = q * (-γ * v * Bz) = γ * FK_y
    expect(withinTolerance(FPrime.y, γ * FK.y, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(FK.y, FPrime.y / γ, { relative: 1e-12 }).ok).toBe(true);

    logField({
      testId: "fields-forces-transverse-special-case",
      beta,
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Transverse force relation F_perp = F'_perp / gamma verified for comoving charge under pure magnetic field.",
    });
  });

  test("adversarial raw-component equality assertion fails as the documented wrong test", () => {
    const q = 1;
    const beta = 0.6;
    const E: Vec3 = { x: 0.3, y: 0.5, z: -0.2 };
    const B: Vec3 = { x: 0.1, y: -0.4, z: 0.6 };
    const u: Vec3 = { x: 0.2, y: 0.1, z: -0.3 };

    const res = forceConsistency(q, { E, B }, u, beta, 1);

    // Raw force components in K are NOT equal to raw force components in K'
    const equalX = Math.abs(res.F_K.x - res.F_prime_transformed.x) < 1e-4;
    const equalY = Math.abs(res.F_K.y - res.F_prime_transformed.y) < 1e-4;
    const equalZ = Math.abs(res.F_K.z - res.F_prime_transformed.z) < 1e-4;

    // A naive test asserting raw equality must fail!
    expect(equalX).toBe(false);
    expect(equalY).toBe(false);
    expect(equalZ).toBe(false);
  });
});
