import { describe, expect, test } from "bun:test";
import { logField, logFieldFailure } from "../physics/reference/fields.log.ts";
import { C_SI, fieldInvariants, transformSI, type Vec3 } from "../physics/reference/fields.ts";
import { withinTolerance } from "../units/tolerance.ts";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("fields.invariants.test.ts: Field invariants property tests", () => {
  test("invariants are preserved under boosts within 1e-12 relative across 200 random fields and speeds", () => {
    const t0 = performance.now();
    const rng = seededRandom(999);
    const speeds = [-0.9, -0.6, -0.2, 0.1, 0.4, 0.6, 0.85, 0.95];

    for (const beta of speeds) {
      const boost = beta * C_SI;
      for (let i = 0; i < 25; i++) {
        const E: Vec3 = {
          x: (rng() - 0.5) * 2000,
          y: (rng() - 0.5) * 2000,
          z: (rng() - 0.5) * 2000,
        };
        const B: Vec3 = {
          x: (rng() - 0.5) * 0.01,
          y: (rng() - 0.5) * 0.01,
          z: (rng() - 0.5) * 0.01,
        };

        const inv0 = fieldInvariants(E, B, C_SI);
        const transformed = transformSI({ E, B, boost, c: C_SI });
        const invPrime = fieldInvariants(transformed.E, transformed.B, C_SI);

        // EDotB invariant check
        const _scaleDot = Math.max(Math.abs(inv0.eDotB), Math.abs(invPrime.eDotB), 1e-10);
        const dotVerdict = withinTolerance(invPrime.eDotB, inv0.eDotB, {
          relative: 1e-12,
          absolute: 1e-10,
        });

        // E^2 - c^2 B^2 invariant check
        const _scaleDiff = Math.max(
          Math.abs(inv0.e2MinusC2B2),
          Math.abs(invPrime.e2MinusC2B2),
          1e-6,
        );
        const diffVerdict = withinTolerance(invPrime.e2MinusC2B2, inv0.e2MinusC2B2, {
          relative: 1e-12,
          absolute: 1e-6,
        });

        if (!dotVerdict.ok || !diffVerdict.ok) {
          logFieldFailure("fields-invariants-fail", { beta, E, B, inv0, invPrime });
        }

        expect(dotVerdict.ok).toBe(true);
        expect(diffVerdict.ok).toBe(true);
      }
    }

    logField({
      testId: "fields-invariants-preservation",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Field invariants E^2 - c^2 B^2 and E.B are preserved under Lorentz boost within 1e-12 relative.",
    });
  });

  test("identity at zero boost", () => {
    const E: Vec3 = { x: 10, y: -20, z: 30 };
    const B: Vec3 = { x: 0.01, y: 0.02, z: -0.03 };
    const inv0 = fieldInvariants(E, B, C_SI);
    const trans = transformSI({ E, B, boost: 0, c: C_SI });
    const inv1 = fieldInvariants(trans.E, trans.B, C_SI);

    expect(inv1.eDotB).toBe(inv0.eDotB);
    expect(inv1.e2MinusC2B2).toBe(inv0.e2MinusC2B2);
  });
});
