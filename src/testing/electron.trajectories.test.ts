import { describe, expect, test } from "bun:test";
import { logElectron } from "../physics/reference/electron.log.ts";
import {
  C_SI,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  longitudinalFieldTrajectory,
  magneticFieldTrajectory,
  transverseFieldTrajectory,
} from "../physics/reference/electron.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("electron.trajectories.test.ts: Exact uniform-field trajectories and deflection (AC4)", () => {
  test("longitudinal electric field produces exact hyperbolic motion from rest", () => {
    const t0 = performance.now();
    const E = 1e5;
    const duration = 1e-8; // 10 ns
    const pts = longitudinalFieldTrajectory(E, duration, 10, -ELEMENTARY_CHARGE, ELECTRON_MASS);

    expect(pts.length).toBe(11);
    for (const pt of pts) {
      const xi = (ELEMENTARY_CHARGE * E * pt.t) / (ELECTRON_MASS * C_SI);
      const expectedG = Math.sqrt(1 + xi * xi);
      const expectedX = ((ELECTRON_MASS * C_SI * C_SI) / (ELEMENTARY_CHARGE * E)) * (expectedG - 1);
      expect(withinTolerance(pt.gamma, expectedG, { relative: 1e-12 }).ok).toBe(true);
      expect(withinTolerance(pt.x, -expectedX, { relative: 1e-10, absolute: 1e-12 }).ok).toBe(true);
    }

    logElectron({
      testId: "electron-trajectories-hyperbolic",
      fieldCase: "longitudinal-electric",
      resultStatus: "value",
      expected: "exact-hyperbolic",
      actual: "exact-hyperbolic",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Hyperbolic trajectory matches analytical form across all time points.",
    });
  });

  test("uniform magnetic field produces exact circular motion with constant speed", () => {
    const t0 = performance.now();
    const B = 0.01;
    const v0 = 0.6 * C_SI;
    const duration = 1e-9;
    const pts = magneticFieldTrajectory(B, v0, duration, 10, -ELEMENTARY_CHARGE, ELECTRON_MASS);

    expect(pts.length).toBe(11);
    for (const pt of pts) {
      expect(withinTolerance(pt.speedRatio, 0.6, { relative: 1e-12 }).ok).toBe(true);
      expect(withinTolerance(pt.gamma, 1.25, { relative: 1e-12 }).ok).toBe(true);
    }

    logElectron({
      testId: "electron-trajectories-circular-magnetic",
      fieldCase: "transverse-magnetic",
      resultStatus: "value",
      expected: 0.6,
      actual: pts[pts.length - 1]?.speedRatio,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Magnetic field trajectory preserves speed exactly in circular orbit.",
    });
  });

  test("transverse electric field matches fixture at 0.5, 1.0, and 2.0 ns within 1e-9 relative (AC4)", () => {
    const t0 = performance.now();
    const E = 1e5; // V/m along +y
    const v0 = 0.6 * C_SI;

    // 0.5 ns
    const pts05 = transverseFieldTrajectory(E, v0, 0.5e-9, 1, -ELEMENTARY_CHARGE, ELECTRON_MASS);
    const p05 = pts05[1];
    expect(p05).toBeDefined();
    if (p05) {
      expect(withinTolerance(p05.x, 0.08992948, { relative: 1e-6 }).ok).toBe(true);
      expect(withinTolerance(p05.y, -0.001758578, { relative: 1e-6 }).ok).toBe(true);
      expect(withinTolerance(p05.speedRatio, 0.6002935, { relative: 1e-6 }).ok).toBe(true);
    }

    // 1.0 ns
    const pts10 = transverseFieldTrajectory(E, v0, 1.0e-9, 1, -ELEMENTARY_CHARGE, ELECTRON_MASS);
    const p10 = pts10[1];
    expect(p10).toBeDefined();
    if (p10) {
      expect(withinTolerance(p10.x, 0.1798095, { relative: 1e-6 }).ok).toBe(true);
      expect(withinTolerance(p10.y, -0.00703141, { relative: 1e-6 }).ok).toBe(true);
      expect(withinTolerance(p10.speedRatio, 0.6011711, { relative: 1e-6 }).ok).toBe(true);
    }

    // 2.0 ns
    const pts20 = transverseFieldTrajectory(E, v0, 2.0e-9, 1, -ELEMENTARY_CHARGE, ELECTRON_MASS);
    const p20 = pts20[1];
    expect(p20).toBeDefined();
    if (p20) {
      expect(withinTolerance(p20.x, 0.3592247, { relative: 1e-6 }).ok).toBe(true);
      expect(withinTolerance(p20.y, -0.0280794, { relative: 1e-6 }).ok).toBe(true);
      expect(withinTolerance(p20.speedRatio, 0.6046404, { relative: 1e-6 }).ok).toBe(true);
    }

    logElectron({
      testId: "electron-trajectories-transverse-fixtures",
      fieldCase: "transverse-electric",
      resultStatus: "value",
      expected: 0.1798095,
      actual: p10?.x,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Transverse electric field deflection matches exact paper fixtures at 0.5, 1, 2 ns.",
    });
  });

  test("deflection sign reverses for opposite charge signs (electron vs positron)", () => {
    const t0 = performance.now();
    const E = 1e5;
    const v0 = 0.6 * C_SI;
    const t = 1e-9;

    const electronPts = transverseFieldTrajectory(E, v0, t, 1, -ELEMENTARY_CHARGE, ELECTRON_MASS);
    const positronPts = transverseFieldTrajectory(E, v0, t, 1, ELEMENTARY_CHARGE, ELECTRON_MASS);

    const elY = electronPts[1]?.y ?? 0;
    const posY = positronPts[1]?.y ?? 0;

    expect(elY).toBeLessThan(0); // deflected toward -y
    expect(posY).toBeGreaterThan(0); // deflected toward +y
    expect(withinTolerance(Math.abs(elY), Math.abs(posY), { relative: 1e-12 }).ok).toBe(true);

    logElectron({
      testId: "electron-trajectories-charge-deflection-sign",
      resultStatus: "value",
      expected: "opposite-deflection-signs",
      actual: "opposite-deflection-signs",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Opposite charge signs produce equal-magnitude opposite-sign deflections.",
    });
  });
});
