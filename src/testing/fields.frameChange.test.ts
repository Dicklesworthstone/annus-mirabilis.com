import { describe, expect, test } from "bun:test";
import { logField } from "../physics/reference/fields.log.ts";
import { C_SI, fieldInvariants, transformSI, type Vec3 } from "../physics/reference/fields.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("fields.frameChange.test.ts: SR-08 electric and magnetic frame change fixtures", () => {
  test("Ey = 1 V/m at beta=0.6 gives E'y = 1.25 V/m and B'z = -2.5017307e-9 T with invariant E^2 - c^2 B^2 = 1", () => {
    const t0 = performance.now();
    const E: Vec3 = { x: 0, y: 1.0, z: 0 };
    const B: Vec3 = { x: 0, y: 0, z: 0 };
    const beta = 0.6;
    const boost = beta * C_SI;

    const res = transformSI({ E, B, boost, c: C_SI });

    expect(res.gamma).toBe(1.25);
    expect(res.E.x).toBe(0);
    expect(withinTolerance(res.E.y, 1.25, { relative: 1e-12 }).ok).toBe(true);
    expect(res.E.z).toBe(0);

    // B'_z = -gamma * v * E_y / c^2 = -1.25 * 0.6 * c * 1 / c^2 = -0.75 / c
    const expectedBz = -0.75 / C_SI; // -2.50173072552e-9 T
    expect(withinTolerance(res.B.z, expectedBz, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(res.B.z, -2.5017307e-9, { relative: 1e-6 }).ok).toBe(true);

    const inv0 = fieldInvariants(E, B, C_SI);
    const invPrime = fieldInvariants(res.E, res.B, C_SI);

    expect(withinTolerance(inv0.e2MinusC2B2, 1.0, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(invPrime.e2MinusC2B2, 1.0, { relative: 1e-12 }).ok).toBe(true);

    logField({
      testId: "fields-frame-change-sr08-ey-fixture",
      beta: 0.6,
      resultStatus: "value",
      expected: [1.25, expectedBz],
      actual: [res.E.y, res.B.z],
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Ey = 1 V/m at beta=0.6 transforms to E'y = 1.25 V/m and B'z = -2.5017307e-9 T with invariant 1.0.",
    });
  });

  test("Bz = 1 T at 10 m/s gives E'y = -10 V/m", () => {
    const t0 = performance.now();
    const E: Vec3 = { x: 0, y: 0, z: 0 };
    const B: Vec3 = { x: 0, y: 0, z: 1.0 };
    const boost = 10; // 10 m/s

    const res = transformSI({ E, B, boost, c: C_SI });

    // E'_y = gamma * (E_y - v * B_z) = gamma * (-10 * 1)
    // gamma for 10 m/s is 1 + 5.56e-16 ~ 1.0
    expect(withinTolerance(res.E.y, -10.0, { relative: 1e-10 }).ok).toBe(true);

    logField({
      testId: "fields-frame-change-sr08-bz-fixture",
      resultStatus: "value",
      expected: -10.0,
      actual: res.E.y,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Bz = 1 T at 10 m/s induces E'y = -10 V/m in conductor frame.",
    });
  });

  test("round trip v -> -v restores original fields exactly", () => {
    const E: Vec3 = { x: 120, y: -45, z: 80 };
    const B: Vec3 = { x: 0.001, y: 0.004, z: -0.002 };
    const boost = 0.6 * C_SI;

    const fwd = transformSI({ E, B, boost, c: C_SI });
    const bwd = transformSI({ E: fwd.E, B: fwd.B, boost: -boost, c: C_SI });

    expect(withinTolerance(bwd.E.x, E.x, { relative: 1e-12, absolute: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(bwd.E.y, E.y, { relative: 1e-12, absolute: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(bwd.E.z, E.z, { relative: 1e-12, absolute: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(bwd.B.x, B.x, { relative: 1e-12, absolute: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(bwd.B.y, B.y, { relative: 1e-12, absolute: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(bwd.B.z, B.z, { relative: 1e-12, absolute: 1e-12 }).ok).toBe(true);
  });
});
