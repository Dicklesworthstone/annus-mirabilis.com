import { describe, expect, test } from "bun:test";
import { logElectron } from "../physics/reference/electron.log.ts";
import {
  C_SI,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  integrateBoris,
  integrateBorisChecked,
  MAX_BORIS_STEPS,
  type TrajectoryPoint,
  type Vec3,
} from "../physics/reference/electron.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("electron.fields.test.ts: Boris numerical integrator and work-energy balance (AC4)", () => {
  test("Boris integrator preserves speed exactly in pure magnetic field", () => {
    const t0 = performance.now();
    const eField = { x: 0, y: 0, z: 0 };
    const bField = { x: 0, y: 0, z: 0.05 }; // 0.05 T along z
    const v0 = { x: 0.6 * C_SI, y: 0, z: 0 };
    const duration = 1e-9;

    const res = integrateBoris(
      eField,
      bField,
      v0,
      duration,
      200,
      -ELEMENTARY_CHARGE,
      ELECTRON_MASS,
    );

    expect(res.points.length).toBe(201);
    for (const pt of res.points) {
      expect(withinTolerance(pt.speedRatio, 0.6, { relative: 1e-10 }).ok).toBe(true);
      expect(withinTolerance(pt.gamma, 1.25, { relative: 1e-10 }).ok).toBe(true);
    }

    logElectron({
      testId: "electron-fields-boris-speed-conservation",
      fieldCase: "pure-magnetic",
      integrator: "relativistic-boris",
      stepCount: 200,
      resultStatus: "value",
      expected: 0.6,
      actual: res.points[res.points.length - 1]?.speedRatio,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Boris integrator preserves speed in pure magnetic field to numerical precision.",
    });
  });

  test("closes work-energy balance Delta W = q int E . dx", () => {
    const t0 = performance.now();
    const eField = { x: 5e4, y: 5e4, z: 0 };
    const bField = { x: 0, y: 0, z: 0.01 };
    const v0 = { x: 0.3 * C_SI, y: 0, z: 0 };
    const duration = 2e-9;

    const res = integrateBoris(
      eField,
      bField,
      v0,
      duration,
      1000,
      -ELEMENTARY_CHARGE,
      ELECTRON_MASS,
    );

    expect(res.energyResidual).toBeDefined();
    // Energy residual should be within integrator tolerance (relative to kinetic energy)
    const finalKE = res.points[res.points.length - 1]?.kineticEnergy ?? 0;
    const relResidual = (res.energyResidual ?? 0) / Math.max(finalKE, 1e-15);
    expect(relResidual).toBeLessThan(1e-3);

    logElectron({
      testId: "electron-fields-work-energy-balance",
      fieldCase: "mixed-e-and-b",
      integrator: "relativistic-boris",
      stepCount: 1000,
      resultStatus: "value",
      expected: 0,
      actual: relResidual,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Work-energy balance closed with relative residual below 1e-3.",
    });
  });

  test("three resolutions measure second-order position convergence", () => {
    const t0 = performance.now();
    const duration = 1e-9;
    const y = (steps: number) => {
      const result = integrateBoris(
        { x: 0, y: 1e5, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0.6 * C_SI, y: 0, z: 0 },
        duration,
        steps,
      );
      expect(result.status).toBe("value");
      const point = result.points.at(-1);
      if (!point) throw new Error("Expected a final trajectory point");
      return point.y;
    };
    const y100 = y(100);
    const y200 = y(200);
    const y400 = y(400);
    const coarseChange = Math.abs(y100 - y200);
    const fineChange = Math.abs(y200 - y400);
    const measuredOrder = Math.log2(coarseChange / fineChange);
    expect(coarseChange).toBeGreaterThan(0);
    expect(fineChange).toBeGreaterThan(0);
    expect(measuredOrder).toBeGreaterThan(1.95);
    expect(measuredOrder).toBeLessThan(2.05);

    logElectron({
      testId: "electron-fields-integrator-convergence",
      integrator: "relativistic-boris",
      observedOrder: measuredOrder,
      resultStatus: "value",
      expected: 2,
      actual: measuredOrder,
      tolerance: { absolute: 0.05 },
      comparisonKind: "tolerance",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Observed order is measured from three position resolutions.",
    });
  });

  test("velocity and energy belong to the same time as every published position", () => {
    const field = 1e5;
    const result = integrateBoris(
      { x: field, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      2e-9,
      8,
    );
    expect(result.status).toBe("value");
    expect(result.points.at(-1)?.t).toBe(2e-9);
    for (const point of result.points) {
      const momentum = (-ELEMENTARY_CHARGE * field * point.t) / (ELECTRON_MASS * C_SI);
      const expectedGamma = Math.hypot(1, momentum);
      const expectedVelocity = (C_SI * momentum) / expectedGamma;
      const expectedEnergy =
        ELECTRON_MASS * C_SI ** 2 * momentum * (momentum / (expectedGamma + 1));
      expect(
        withinTolerance(point.vx, expectedVelocity, { relative: 1e-13, absolute: 1e-8 }).ok,
      ).toBe(true);
      expect(
        withinTolerance(point.kineticEnergy, expectedEnergy, {
          relative: 1e-13,
          absolute: 1e-30,
        }).ok,
      ).toBe(true);
    }
    // A single fixed-resolution run has measured neither a bound nor an order.
    expect(result).not.toHaveProperty("errorBound");
    expect(result).not.toHaveProperty("observedOrder");
  });

  test("checked magnetic motion resolves phase as well as conserving speed", () => {
    const duration = 1e-8;
    const speed = 0.6 * C_SI;
    const field = 0.01;
    const checked = integrateBorisChecked(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: field },
      { x: speed, y: 0, z: 0 },
      duration,
    );
    expect(checked.status).toBe("value");
    if (checked.status !== "value") throw new Error(checked.reason);
    expect(checked.stepCount).toBeGreaterThan(240);
    expect(checked.observedOrder).toBeGreaterThan(1.95);
    expect(checked.observedOrder).toBeLessThan(2.05);
    const omega = (ELEMENTARY_CHARGE * field) / (1.25 * ELECTRON_MASS);
    const radius = speed / omega;
    for (const point of checked.points) {
      const theta = omega * point.t;
      const positionError = Math.hypot(
        point.x - radius * Math.sin(theta),
        point.y - radius * (1 - Math.cos(theta)),
      );
      const velocityError = Math.hypot(
        point.vx - speed * Math.cos(theta),
        point.vy - speed * Math.sin(theta),
      );
      expect(positionError).toBeLessThanOrEqual(checked.positionErrorEstimate + 1e-11);
      expect(velocityError).toBeLessThanOrEqual(checked.velocityErrorEstimate + 1e-3);
      expect(withinTolerance(point.speedRatio, 0.6, { relative: 1e-10 }).ok).toBe(true);
    }
  });

  test("crossed three-dimensional fields agree with an independently integrated Lorentz equation", () => {
    const electric = { x: 2e5, y: -3e5, z: 4e5 };
    const magnetic = { x: 0.02, y: -0.01, z: 0.03 };
    const velocity = { x: 0.35 * C_SI, y: 0.2 * C_SI, z: 0.1 * C_SI };
    const duration = 8e-10;
    const checked = integrateBorisChecked(electric, magnetic, velocity, duration);
    expect(checked.status).toBe("value");
    if (checked.status !== "value") throw new Error(checked.reason);
    const point = checked.points.at(-1);
    if (!point) throw new Error("Expected the checked final state");
    const reference = lorentzRk4(electric, magnetic, velocity, duration, 2048);
    const halfResolution = lorentzRk4(electric, magnetic, velocity, duration, 1024);
    const referenceDifference = Math.hypot(
      reference.x - halfResolution.x,
      reference.y - halfResolution.y,
      reference.z - halfResolution.z,
    );
    expect(referenceDifference).toBeLessThan(1e-9);
    expect(Math.hypot(
      point.x - reference.x, point.y - reference.y, point.z - reference.z,
    )).toBeLessThanOrEqual(checked.positionErrorEstimate + 1e-9);
    expect(Math.hypot(
      point.vx - reference.vx, point.vy - reference.vy, point.vz - reference.vz,
    )).toBeLessThanOrEqual(checked.velocityErrorEstimate + 0.1);
  });

  test("metres of z travel do not conceal error in a micrometre-scale x-y arc", () => {
    // Parallel E and B leave the transverse momentum magnitude unchanged. Integrating
    // omega/gamma(t) gives theta = (omega/alpha) asinh(alpha t/gamma0).
    const velocity = 0.0001 * C_SI;
    const electric = 1e7;
    const magnetic = 0.01;
    const gamma0 = 1 / Math.sqrt(1 - 0.0001 ** 2);
    const alpha = (-ELEMENTARY_CHARGE * electric) / (ELECTRON_MASS * C_SI);
    const omega = (-ELEMENTARY_CHARGE * magnetic) / ELECTRON_MASS;
    const radius = (gamma0 * velocity) / omega;
    const checked = integrateBorisChecked(
      { x: 0, y: 0, z: electric },
      { x: 0, y: 0, z: magnetic },
      { x: velocity, y: 0, z: 0 },
      1e-8,
    );
    expect(checked.status).toBe("value");
    if (checked.status !== "value") throw new Error(checked.reason);
    let maximumProjectionError = 0;
    let maximumZ = 0;
    let maximumProjection = 0;
    for (const point of checked.points) {
      const theta = (omega / alpha) * Math.asinh((alpha * point.t) / gamma0);
      const exactX = radius * Math.sin(theta);
      const exactY = -2 * radius * Math.sin(theta / 2) ** 2;
      maximumProjectionError = Math.max(
        maximumProjectionError,
        Math.hypot(point.x - exactX, point.y - exactY),
      );
      maximumZ = Math.max(maximumZ, Math.abs(point.z));
      maximumProjection = Math.max(maximumProjection, Math.hypot(point.x, point.y));
    }
    expect(maximumZ).toBeGreaterThan(1);
    expect(maximumProjection).toBeLessThan(1e-4);
    expect(maximumProjectionError).toBeLessThan(5e-6 * Math.abs(radius) + 1e-12);
  });

  test("a long, strong magnetic request refuses without publishing an aliased trajectory", () => {
    const checked = integrateBorisChecked(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 10 },
      { x: 0.6 * C_SI, y: 0, z: 0 },
      1e-6,
    );
    expect(checked.status).toBe("outside-domain");
    if (checked.status !== "outside-domain") throw new Error("Expected unresolved gyromotion");
    expect(checked.domainKind).toBe("numerical");
    expect(checked.condition).toBe("trajectory-not-converged");
    expect(checked.stepCount).toBeLessThanOrEqual(MAX_BORIS_STEPS);
    expect(checked.points).toEqual([]);
    expect(checked.reason).toContain("Shorten the duration");
  });

  test("force-free motion has no invented convergence order", () => {
    const checked = integrateBorisChecked(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 0 },
      1e-6,
    );
    expect(checked.status).toBe("value");
    if (checked.status !== "value") throw new Error(checked.reason);
    expect(checked.observedOrder).toBeUndefined();
    expect(checked.positionErrorEstimate).toBe(0);
    expect(checked.energyResidual).toBe(0);
    expect(checked.points.every((point) => point.x === 0 && point.y === 0 && point.z === 0)).toBe(
      true,
    );
  });

  test("invalid and unrepresentable inputs never produce a trajectory", () => {
    const zero = { x: 0, y: 0, z: 0 };
    for (const result of [
      integrateBoris(zero, zero, zero, 0),
      integrateBoris(zero, zero, { x: C_SI, y: 0, z: 0 }, 1e-9),
      integrateBoris({ x: Number.NaN, y: 0, z: 0 }, zero, zero, 1e-9),
      integrateBoris(zero, zero, zero, 1e-9, 0),
      integrateBoris(zero, zero, zero, 1e-9, MAX_BORIS_STEPS + 1),
      integrateBoris(zero, zero, zero, Number.MIN_VALUE),
      integrateBoris(zero, zero, zero, 1e-9, 200, 1, Number.MIN_VALUE),
    ]) {
      expect(result.status).toBe("outside-domain");
      expect(result.points).toEqual([]);
    }
  });
});

/**
 * Test-only independent classical RK4 integration of dx/dt = c u/gamma and
 * du/dt = (q/m)(E/c + (u/gamma) cross B), with u = p/(mc).
 * It shares physical constants, but no Boris push or analytic trajectory code.
 */
function lorentzRk4(
  electric: Vec3,
  magnetic: Vec3,
  velocity: Vec3,
  duration: number,
  steps: number,
): Pick<TrajectoryPoint, "x" | "y" | "z" | "vx" | "vy" | "vz"> {
  type State = readonly [number, number, number, number, number, number];
  const beta = Math.hypot(velocity.x, velocity.y, velocity.z) / C_SI;
  const gamma0 = 1 / Math.sqrt(1 - beta * beta);
  let state: State = [
    0, 0, 0,
    (gamma0 * velocity.x) / C_SI,
    (gamma0 * velocity.y) / C_SI,
    (gamma0 * velocity.z) / C_SI,
  ];
  const dt = duration / steps;
  const rate = -ELEMENTARY_CHARGE / ELECTRON_MASS;
  const derivative = (value: State): State => {
    const [, , , ux, uy, uz] = value;
    const g = Math.hypot(1, ux, uy, uz);
    const vx = ux / g;
    const vy = uy / g;
    const vz = uz / g;
    return [
      C_SI * vx, C_SI * vy, C_SI * vz,
      rate * (electric.x / C_SI + vy * magnetic.z - vz * magnetic.y),
      rate * (electric.y / C_SI + vz * magnetic.x - vx * magnetic.z),
      rate * (electric.z / C_SI + vx * magnetic.y - vy * magnetic.x),
    ];
  };
  const offset = (value: State, change: State, amount: number): State => [
    value[0] + amount * change[0], value[1] + amount * change[1],
    value[2] + amount * change[2], value[3] + amount * change[3],
    value[4] + amount * change[4], value[5] + amount * change[5],
  ];
  for (let i = 0; i < steps; i++) {
    const k1 = derivative(state);
    const k2 = derivative(offset(state, k1, dt / 2));
    const k3 = derivative(offset(state, k2, dt / 2));
    const k4 = derivative(offset(state, k3, dt));
    const combined: State = [
      k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0],
      k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1],
      k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2],
      k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3],
      k1[4] + 2 * k2[4] + 2 * k3[4] + k4[4],
      k1[5] + 2 * k2[5] + 2 * k3[5] + k4[5],
    ];
    state = offset(state, combined, dt / 6);
  }
  const g = Math.hypot(1, state[3], state[4], state[5]);
  return {
    x: state[0], y: state[1], z: state[2],
    vx: (C_SI * state[3]) / g,
    vy: (C_SI * state[4]) / g,
    vz: (C_SI * state[5]) / g,
  };
}
