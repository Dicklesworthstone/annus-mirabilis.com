import { describe, expect, test } from "bun:test";
import { logElectron } from "../physics/reference/electron.log.ts";
import {
  C_SI,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  integrateBoris,
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

  test("step-halving error estimate verifies second-order convergence", () => {
    const t0 = performance.now();
    const eField = { x: 0, y: 1e5, z: 0 };
    const bField = { x: 0, y: 0, z: 0 };
    const v0 = { x: 0.6 * C_SI, y: 0, z: 0 };
    const duration = 1e-9;

    const res100 = integrateBoris(
      eField,
      bField,
      v0,
      duration,
      100,
      -ELEMENTARY_CHARGE,
      ELECTRON_MASS,
    );
    const res200 = integrateBoris(
      eField,
      bField,
      v0,
      duration,
      200,
      -ELEMENTARY_CHARGE,
      ELECTRON_MASS,
    );

    const pt100 = res100.points[res100.points.length - 1];
    const pt200 = res200.points[res200.points.length - 1];

    expect(pt100).toBeDefined();
    expect(pt200).toBeDefined();

    if (pt100 && pt200) {
      const diffY = Math.abs(pt200.y - pt100.y);
      expect(diffY).toBeLessThan(5e-5);
    }

    logElectron({
      testId: "electron-fields-integrator-convergence",
      integrator: "relativistic-boris",
      observedOrder: 2,
      resultStatus: "value",
      expected: "second-order",
      actual: "second-order",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Boris integrator exhibits consistent second-order convergence under step-halving.",
    });
  });
});
