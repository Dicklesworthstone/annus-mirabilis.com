import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { encodeResult, parseResult } from "../experiments/results/codec.ts";
import type { ScientificResult } from "../experiments/results/types.ts";
import { SR13_DEFAULTS, SR13_OUTPUTS } from "../experiments/sr13/definition.ts";
import { createSr13Session } from "../experiments/sr13/session.ts";
import type { PublishedResult } from "../experiments/store/instanceStore.ts";
import {
  C_SI,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  electricRadius,
  initialTrajectoryCurvature,
  integrateBoris,
  magneticRadius,
  type Sr13Input,
  type Vec3,
} from "../physics/reference/electron.ts";

const moving = (settings: Partial<Sr13Input> = {}): Sr13Input => ({
  ...SR13_DEFAULTS,
  electricFieldX: 0,
  electricFieldY: 0,
  electricFieldZ: 0,
  magneticFieldX: 0,
  magneticFieldY: 0,
  magneticFieldZ: 0,
  ...settings,
});

function value(result: ScientificResult | PublishedResult | undefined): number {
  assert.ok(result?.status === "value" && typeof result.value === "number");
  assert.ok(Number.isFinite(result.value));
  return result.value;
}

function close(actual: number, expected: number, relative = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= relative * Math.max(Math.abs(expected), Number.MIN_VALUE),
    `Expected ${actual} to agree with ${expected} within ${relative} relative error`,
  );
}

describe("SR-13 actual initial spatial curvature", () => {
  test("a separate transverse field recovers the reciprocal of its reference radius", () => {
    for (const initialSpeed of [-0.6, 0.1, 0.6, 0.95]) {
      close(
        value(initialTrajectoryCurvature(moving({ initialSpeed, electricFieldY: 1e5 }))),
        1 / value(electricRadius(initialSpeed, 1e5).exact),
      );
      close(
        value(initialTrajectoryCurvature(moving({ initialSpeed, magneticFieldZ: 0.01 }))),
        1 / value(magneticRadius(initialSpeed, 0.01).exact),
      );
    }
  });

  test("parallel fields and neutral particles have zero initial bending, including axis directions", () => {
    for (const [
      initialDirectionDeg,
      electricFieldX,
      electricFieldY,
      magneticFieldX,
      magneticFieldY,
    ] of [
      [0, 1e5, 0, 0.01, 0],
      [90, 0, 1e5, 0, 0.01],
      [180, -1e5, 0, -0.01, 0],
      [270, 0, -1e5, 0, -0.01],
      [360, 1e5, 0, 0.01, 0],
    ] as const) {
      for (const initialSpeed of [-0.6, 0.6]) {
        const result = initialTrajectoryCurvature(
          moving({
            initialSpeed,
            initialDirectionDeg,
            electricFieldX,
            electricFieldY,
            magneticFieldX,
            magneticFieldY,
          }),
        );
        expect(value(result)).toBe(0);
      }
    }
    expect(
      value(
        initialTrajectoryCurvature(
          moving({
            electricFieldY: 1e5,
            magneticFieldZ: 0.01,
          }),
          0,
        ),
      ),
    ).toBe(0);
  });

  test("a helical spatial path differs from both the transverse reference circle and gyroradius", () => {
    const result = initialTrajectoryCurvature(
      moving({
        magneticFieldX: 0.03,
        magneticFieldZ: 0.04,
      }),
    );
    // A 3-4-5 field makes the velocity's pitch sine 4/5. The helix has
    // gyroradius (4/5) R_reference, but spatial curvature (4/5) / R_reference.
    const referenceRadius = value(magneticRadius(0.6, 0.05).exact);
    const gyroradius = 0.8 * referenceRadius;
    close(value(result), 0.8 / referenceRadius);
    close(value(result) * gyroradius, 0.64);
    expect(value(result)).not.toBe(1 / referenceRadius);
    expect(value(result)).not.toBe(1 / gyroradius);
  });

  test("crossed fields can cancel even when both separate reference radii are finite", () => {
    const balanced = moving({
      initialSpeed: 0.5,
      electricFieldY: 149896.229,
      magneticFieldZ: 0.001,
    });
    expect(value(initialTrajectoryCurvature(balanced))).toBe(0);
    const electricOnly = value(initialTrajectoryCurvature({ ...balanced, magneticFieldZ: 0 }));
    const magneticOnly = value(initialTrajectoryCurvature({ ...balanced, electricFieldY: 0 }));
    close(electricOnly, magneticOnly);
    // Reversing entry velocity reverses v cross B, so the same fields reinforce instead.
    close(value(initialTrajectoryCurvature({ ...balanced, initialSpeed: -0.5 })), 2 * electricOnly);
  });

  test("out-of-plane bending survives a straight initial x-y projection", () => {
    const electric = moving({ electricFieldZ: 1e5 });
    const cross = moving({ magneticFieldY: 0.001 });
    close(
      value(initialTrajectoryCurvature(electric)),
      value(initialTrajectoryCurvature(moving({ electricFieldY: 1e5 }))),
    );
    close(
      value(initialTrajectoryCurvature({ ...electric, magneticFieldY: 0.001 })),
      value(initialTrajectoryCurvature(electric)) + value(initialTrajectoryCurvature(cross)),
    );
  });

  test("rotating fields and entry together preserves curvature and changing charge sign preserves its magnitude", () => {
    const original = moving({
      electricFieldX: 2e5,
      electricFieldY: -3e5,
      electricFieldZ: 4e5,
      magneticFieldX: 0.02,
      magneticFieldY: -0.01,
      magneticFieldZ: 0.03,
    });
    const rotated = {
      ...original,
      initialDirectionDeg: 90,
      electricFieldX: -original.electricFieldY,
      electricFieldY: original.electricFieldX,
      magneticFieldX: -original.magneticFieldY,
      magneticFieldY: original.magneticFieldX,
    };
    close(value(initialTrajectoryCurvature(rotated)), value(initialTrajectoryCurvature(original)));
    close(
      value(initialTrajectoryCurvature(original, ELEMENTARY_CHARGE)),
      value(initialTrajectoryCurvature(original, -ELEMENTARY_CHARGE)),
    );
    close(
      value(initialTrajectoryCurvature(original, ELEMENTARY_CHARGE, 2 * ELECTRON_MASS)),
      value(initialTrajectoryCurvature(original)) / 2,
    );
  });

  test("the curvature agrees with geometry of independently integrated three-dimensional positions", () => {
    const input = moving({
      initialSpeed: 0.4,
      initialDirectionDeg: 30,
      electricFieldX: 2e5,
      electricFieldY: -3e5,
      electricFieldZ: 4e5,
      magneticFieldX: 0.02,
      magneticFieldY: -0.01,
      magneticFieldZ: 0.03,
    });
    const charge = 2e-19;
    const mass = 2e-30;
    const speed = input.initialSpeed * C_SI;
    const angle = (input.initialDirectionDeg * Math.PI) / 180;
    const integrated = integrateBoris(
      { x: input.electricFieldX, y: input.electricFieldY, z: input.electricFieldZ },
      { x: input.magneticFieldX, y: input.magneticFieldY, z: input.magneticFieldZ },
      { x: speed * Math.cos(angle), y: speed * Math.sin(angle), z: 0 },
      1e-13,
      16,
      charge,
      mass,
    );
    assert.ok(integrated.status === "value");
    const [a, b, c] = integrated.points;
    assert.ok(a && b && c);
    const subtract = (p: Vec3, q: Vec3) => ({ x: p.x - q.x, y: p.y - q.y, z: p.z - q.z });
    const length = (p: Vec3) => Math.hypot(p.x, p.y, p.z);
    const ab = subtract(b, a);
    const ac = subtract(c, a);
    const bc = subtract(c, b);
    const cross = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x,
    };
    // Reciprocal of the circle through three adjacent spatial points, independently
    // measured from the trajectory rather than recomputing its Lorentz-force formula.
    const observed = (2 * length(cross)) / (length(ab) * length(ac) * length(bc));
    close(value(initialTrajectoryCurvature(input, charge, mass)), observed, 5e-5);
  });

  test("a particle at rest has no initial tangent, and no infinite radius is serialized", () => {
    const rest = initialTrajectoryCurvature(moving({ initialSpeed: 0, electricFieldY: 1e5 }));
    expect(rest.status).toBe("not-applicable");
    expect(rest).not.toHaveProperty("value");
    if (rest.status === "not-applicable") expect(rest.reason).toContain("starts at rest");
    expect(parseResult(encodeResult(rest))).toEqual(rest);
    const straight = initialTrajectoryCurvature(moving());
    expect(value(parseResult(encodeResult(straight)))).toBe(0);
  });

  test("invalid and unresolved inputs retain the new quantity identity without numeric placeholders", () => {
    for (const input of [
      moving({ initialSpeed: 1 }),
      moving({ initialSpeed: Number.NaN }),
      moving({ initialDirectionDeg: Number.POSITIVE_INFINITY }),
      moving({ magneticFieldZ: Number.NaN }),
      moving({ initialSpeed: Number.MIN_VALUE, electricFieldY: 1e5 }),
    ]) {
      const result = initialTrajectoryCurvature(input);
      expect(result.quantityId).toBe("initialTrajectoryCurvature");
      expect(result.status).toBe("outside-domain");
      expect(result).not.toHaveProperty("value");
    }
    expect(initialTrajectoryCurvature(moving(), ELEMENTARY_CHARGE, 0).status).toBe(
      "outside-domain",
    );
  });

  test("the accepted session publishes the diagnostic, preserves it across conventions, and admits rest", () => {
    const session = createSr13Session("sr13-actual-curvature");
    const find = () =>
      session
        .getSnapshot()
        .accepted?.outputs.find((output) => output.quantityId === "initialTrajectoryCurvature");
    close(value(find()), 1 / value(electricRadius(SR13_DEFAULTS.initialSpeed, 1e5).exact));
    const before = session.getSnapshot().accepted;
    assert.ok(before);
    expect(SR13_OUTPUTS.initialTrajectoryCurvature?.unit).toBe("m^-1");
    expect(session.apply({ ...SR13_DEFAULTS, forceConvention: "laboratory" }).kind).toBe(
      "accepted",
    );
    expect(session.getSnapshot().accepted?.runId).toBe(before.runId);
    expect(find()).toEqual(
      before.outputs.find((output) => output.quantityId === "initialTrajectoryCurvature"),
    );
    expect(session.apply({ ...SR13_DEFAULTS, initialSpeed: 0 }).kind).toBe("accepted");
    expect(find()?.status).toBe("not-applicable");
    expect(session.apply({ ...SR13_DEFAULTS, particle: "custom", customCharge: 0 }).kind).toBe(
      "accepted",
    );
    expect(value(find())).toBe(0);
  });

  test("an admitted nonzero transverse force cannot underflow into a claim of zero bending", () => {
    const session = createSr13Session("sr13-curvature-underflow");
    // The normal parallel component keeps every reference scalar finite. This whole
    // setup is admitted by the real session, including the tiny nonzero transverse field.
    const settings = {
      ...SR13_DEFAULTS,
      electricFieldX: 1e5,
      electricFieldY: Number.MIN_VALUE,
    };
    expect(session.apply(settings).kind).toBe("accepted");
    const result = session
      .getSnapshot()
      .accepted?.outputs.find((output) => output.quantityId === "initialTrajectoryCurvature");
    assert.ok(result?.status === "outside-domain");
    expect(result.domainKind).toBe("numerical");
    expect(result.condition).toBe("unresolved-curvature");
    expect(result).not.toHaveProperty("value");
    // A genuinely zero force still receives the ordinary finite-zero result.
    expect(session.apply({ ...settings, electricFieldY: 0 }).kind).toBe("accepted");
    expect(
      value(
        session
          .getSnapshot()
          .accepted?.outputs.find((output) => output.quantityId === "initialTrajectoryCurvature"),
      ),
    ).toBe(0);
  });
});
