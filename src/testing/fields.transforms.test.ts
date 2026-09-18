import { describe, expect, test } from "bun:test";
import { logField, logFieldFailure } from "../physics/reference/fields.log.ts";
import { C_SI, transformSI, type Vec3 } from "../physics/reference/fields.ts";
import { withinTolerance } from "../units/tolerance.ts";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("fields.transforms.test.ts: SI transforms and round trips", () => {
  test("zero boost returns exact identity transform", () => {
    const t0 = performance.now();
    const E: Vec3 = { x: 12.5, y: -45.2, z: 89.1 };
    const B: Vec3 = { x: 0.003, y: -0.015, z: 0.042 };

    const res = transformSI({ E, B, boost: 0, c: C_SI });

    expect(res.gamma).toBe(1);
    expect(res.E.x).toBe(E.x);
    expect(res.E.y).toBe(E.y);
    expect(res.E.z).toBe(E.z);
    expect(res.B.x).toBe(B.x);
    expect(res.B.y).toBe(B.y);
    expect(res.B.z).toBe(B.z);

    logField({
      testId: "fields-si-zero-boost",
      beta: 0,
      unitSystem: "si",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Zero boost preserves all field components identically with gamma=1.",
    });
  });

  test("inverse round trips (v then -v) restore original fields within 1e-12 relative", () => {
    const t0 = performance.now();
    const rng = seededRandom(42);
    const betas = [0.001, 0.1, 0.5, 0.6, 0.8, 0.95];

    for (const beta of betas) {
      for (let i = 0; i < 20; i++) {
        const E: Vec3 = {
          x: (rng() - 0.5) * 1000,
          y: (rng() - 0.5) * 1000,
          z: (rng() - 0.5) * 1000,
        };
        const B: Vec3 = {
          x: ((rng() - 0.5) * 1000) / C_SI,
          y: ((rng() - 0.5) * 1000) / C_SI,
          z: ((rng() - 0.5) * 1000) / C_SI,
        };

        const fwd = transformSI({ E, B, boost: beta * C_SI, c: C_SI });
        const rev = transformSI({ E: fwd.E, B: fwd.B, boost: -beta * C_SI, c: C_SI });

        const checkEx = withinTolerance(rev.E.x, E.x, { relative: 1e-12, absolute: 1e-12 });
        const checkEy = withinTolerance(rev.E.y, E.y, { relative: 1e-12, absolute: 1e-12 });
        const checkEz = withinTolerance(rev.E.z, E.z, { relative: 1e-12, absolute: 1e-12 });
        const checkBx = withinTolerance(rev.B.x, B.x, { relative: 1e-12, absolute: 1e-12 });
        const checkBy = withinTolerance(rev.B.y, B.y, { relative: 1e-12, absolute: 1e-12 });
        const checkBz = withinTolerance(rev.B.z, B.z, { relative: 1e-12, absolute: 1e-12 });

        if (
          !checkEx.ok ||
          !checkEy.ok ||
          !checkEz.ok ||
          !checkBx.ok ||
          !checkBy.ok ||
          !checkBz.ok
        ) {
          logFieldFailure("fields-si-roundtrip-fail", { beta, E, B, rev });
        }

        expect(checkEx.ok).toBe(true);
        expect(checkEy.ok).toBe(true);
        expect(checkEz.ok).toBe(true);
        expect(checkBx.ok).toBe(true);
        expect(checkBy.ok).toBe(true);
        expect(checkBz.ok).toBe(true);
      }
    }

    logField({
      testId: "fields-si-roundtrips",
      unitSystem: "si",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Inverse round trip v -> -v restores fields within 1e-12 across 120 random configurations.",
    });
  });

  test("parallel components are invariant under boost", () => {
    const E: Vec3 = { x: 50.0, y: 100.0, z: -200.0 };
    const B: Vec3 = { x: 0.05, y: -0.02, z: 0.08 };

    const fwd = transformSI({ E, B, boost: 0.6 * C_SI, c: C_SI });
    expect(fwd.E.x).toBe(E.x);
    expect(fwd.B.x).toBe(B.x);
  });
});
