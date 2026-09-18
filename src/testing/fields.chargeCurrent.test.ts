import { describe, expect, test } from "bun:test";
import { logField } from "../physics/reference/fields.log.ts";
import {
  C_SI,
  continuityResidual,
  fourCurrentInvariants,
  loopChargeInFrame,
  movingSphereTotalCharge,
  transformChargeCurrent,
  type Vec3,
} from "../physics/reference/fields.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("fields.chargeCurrent.test.ts: Charge and current transformations (paper 3 §9, SR-12)", () => {
  test("neutral conductor fixture (c=1, beta=0.6, rho=0, Jx=1) gives rho'=-0.75, J'x=1.25, invariant=-1", () => {
    const t0 = performance.now();
    const c = 1;
    const beta = 0.6;
    const boost = beta * c;
    const rho = 0;
    const J: Vec3 = { x: 1.0, y: 0, z: 0 };

    const res = transformChargeCurrent({ rho, J, boost, c });

    expect(res.gamma).toBe(1.25);
    // rho' = gamma * (rho - v * Jx / c^2) = 1.25 * (0 - 0.6 * 1) = -0.75
    expect(withinTolerance(res.rho, -0.75, { relative: 1e-12 }).ok).toBe(true);
    // J'_x = gamma * (Jx - v * rho) = 1.25 * (1 - 0) = 1.25
    expect(withinTolerance(res.J.x, 1.25, { relative: 1e-12 }).ok).toBe(true);
    expect(res.J.y).toBe(0);
    expect(res.J.z).toBe(0);

    // Invariant: c^2 rho^2 - J^2 = 1 * 0 - 1 = -1 in unprimed
    // In primed: 1 * (-0.75)^2 - 1.25^2 = 0.5625 - 1.5625 = -1.0
    const inv0 = fourCurrentInvariants(rho, J, c);
    const invPrime = fourCurrentInvariants(res.rho, res.J, c);
    expect(inv0.si).toBe(-1.0);
    expect(withinTolerance(invPrime.si, -1.0, { relative: 1e-12 }).ok).toBe(true);

    logField({
      testId: "fields-charge-current-neutral-conductor",
      beta,
      resultStatus: "value",
      expected: [-0.75, 1.25, -1.0],
      actual: [res.rho, res.J.x, invPrime.si],
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Neutral conductor rho=0, Jx=1 at beta=0.6 yields rho'=-0.75, J'x=1.25 and invariant -1 in both frames.",
    });
  });

  test("convection current fixture: ux=0.5c at beta=0.6 gives rho' = 0.875 rho", () => {
    const t0 = performance.now();
    const c = C_SI;
    const rho0 = 2.0; // C/m^3
    const ux = 0.5 * c;
    const J: Vec3 = { x: rho0 * ux, y: 0, z: 0 };
    const beta = 0.6;
    const boost = beta * c;

    const res = transformChargeCurrent({ rho: rho0, J, boost, c });

    // rho' = gamma * (rho - v * Jx / c^2) = gamma * rho * (1 - v * ux / c^2)
    // = 1.25 * rho * (1 - 0.6 * 0.5) = 1.25 * 0.7 * rho = 0.875 * rho
    const expectedRho = 0.875 * rho0;
    expect(withinTolerance(res.rho, expectedRho, { relative: 1e-12 }).ok).toBe(true);

    logField({
      testId: "fields-charge-current-convection",
      beta,
      resultStatus: "value",
      expected: expectedRho,
      actual: res.rho,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Convection current with ux=0.5c at beta=0.6 transforms to rho' = 0.875 rho.",
    });
  });

  test("current loop total charge is exactly zero in moving frames at beta in {0.1, 0.6, 0.95}", () => {
    const t0 = performance.now();
    const I = 5.0; // Amperes
    const lx = 0.2; // meters
    const ly = 0.1; // meters
    const betas = [0.1, 0.6, 0.95];

    for (const beta of betas) {
      const loop = loopChargeInFrame({ current: I, lengthX: lx, lengthY: ly, beta, c: C_SI });

      // Opposite legs acquire opposite charges, summing to zero
      expect(Math.abs(loop.totalCharge)).toBeLessThan(1e-15);
      expect(loop.legChargePositive + loop.legChargeNegative).toBeCloseTo(0, 15);

      // Contracted length lx' = lx / gamma
      expect(withinTolerance(loop.contractedLengthX, lx / loop.gamma, { relative: 1e-14 }).ok).toBe(
        true,
      );
    }

    logField({
      testId: "fields-current-loop-zero-total-charge",
      resultStatus: "value",
      expected: 0,
      actual: 0,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Current loop total charge stays exactly zero in moving frames at beta in {0.1, 0.6, 0.95}.",
    });
  });

  test("moving sphere total charge is 4.188790 C in all frames and matches quadrature cross-check", () => {
    const t0 = performance.now();
    const rho0 = 1.0; // C/m^3
    const radius = 1.0; // m
    const u = 0.6 * C_SI;

    // Measured in lab frame where sphere moves at 0.6c (observerBeta = 0)
    const labView = movingSphereTotalCharge({ rho0, radius, u, observerBeta: 0, c: C_SI });
    expect(labView.observedDensity).toBeCloseTo(1.25, 10);
    expect(labView.observedVolume).toBeCloseTo(3.351032, 5);
    expect(withinTolerance(labView.totalChargeAnalytic, 4.18879, { relative: 1e-4 }).ok).toBe(true);
    expect(labView.consistent).toBe(true);
    expect(labView.quadratureError).toBeLessThan(1e-10);

    // Described from frame with observerBeta = -0.6
    // sphere relative speed = (0.6 - (-0.6)) / (1 + 0.36) = 1.2 / 1.36 c ~ 0.882353c, gamma = 2.125
    const movingView = movingSphereTotalCharge({ rho0, radius, u, observerBeta: -0.6, c: C_SI });
    expect(movingView.relativeBeta).toBeCloseTo(0.882353, 5);
    expect(movingView.relativeGamma).toBeCloseTo(2.125, 10);
    expect(movingView.observedVolume).toBeCloseTo(1.971195, 5);
    expect(withinTolerance(movingView.totalChargeAnalytic, 4.18879, { relative: 1e-4 }).ok).toBe(
      true,
    );
    expect(movingView.consistent).toBe(true);
    expect(movingView.quadratureError).toBeLessThan(1e-10);

    // Total charges in both frames match within 1e-12 relative
    expect(
      withinTolerance(labView.totalChargeAnalytic, movingView.totalChargeAnalytic, {
        relative: 1e-12,
      }).ok,
    ).toBe(true);

    logField({
      testId: "fields-moving-sphere-total-charge",
      resultStatus: "value",
      expected: 4.18879,
      actual: movingView.totalChargeAnalytic,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Moving sphere total charge 4.188790 C is invariant across frames and verified by quadrature within 1e-10.",
    });
  });

  test("continuity residual evaluates to < 1e-12 relative for moving Gaussian pulse", () => {
    const t0 = performance.now();
    const config = {
      kind: "gaussian-pulse" as const,
      rho0: 10.0,
      u: 0.3 * C_SI,
      sigma: 2.5,
    };
    const events = [
      { x: 0, t: 0 },
      { x: 1.0, t: 2e-9 },
      { x: -1.5, t: 5e-9 },
      { x: 3.0, t: 1e-8 },
    ];

    const res = continuityResidual(config, events, 0.6, C_SI);
    expect(res.passed).toBe(true);
    expect(res.relativeResidualStationary).toBeLessThan(1e-12);
    expect(res.relativeResidualMoving).toBeLessThan(1e-12);

    logField({
      testId: "fields-charge-continuity-residual",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Continuity residual dRho/dt + div(J) = 0 evaluates to zero within 1e-12 in both stationary and moving frames.",
    });
  });

  test("adversarial validator: net densities with |J/rho| >= c (like neutral conductor rho=0, J!=0) must NOT be rejected", () => {
    // A wrong validator asserting |J / rho| < c would reject neutral conductor (division by zero)
    const rho = 0;
    const Jx = 5.0;

    // Ensure our transform accepts it without throwing or rejecting
    const res = transformChargeCurrent({
      rho,
      J: { x: Jx, y: 0, z: 0 },
      boost: 0.5 * C_SI,
      c: C_SI,
    });
    expect(Number.isFinite(res.rho)).toBe(true);
    expect(Number.isFinite(res.J.x)).toBe(true);
    expect(res.rho).not.toBe(0); // acquiring moving net charge density!
  });
});
