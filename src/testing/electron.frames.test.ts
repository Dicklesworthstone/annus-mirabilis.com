import { describe, expect, test } from "bun:test";
import { logElectron } from "../physics/reference/electron.log.ts";
import {
  addAccelerations,
  addForces,
  FrameMismatchError,
  transformAcceleration,
  transformForce,
} from "../physics/reference/electron.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("electron.frames.test.ts: Frame-tagged forces and accelerations (AC1, AC5)", () => {
  test("frame-tagged types reject cross-frame arithmetic without transformation", () => {
    const t0 = performance.now();
    const fLab = { frame: "laboratory" as const, components: { x: 10, y: 20, z: 30 } };
    const fCom = { frame: "comoving" as const, components: { x: 10, y: 25, z: 37.5 } };

    expect(() => addForces(fLab, fCom)).toThrow(FrameMismatchError);

    const aLab = { frame: "laboratory" as const, components: { x: 1, y: 2, z: 3 } };
    const aCom = { frame: "comoving" as const, components: { x: 1, y: 2, z: 3 } };

    expect(() => addAccelerations(aLab, aCom)).toThrow(FrameMismatchError);

    // Valid same-frame additions succeed
    const fLab2 = { frame: "laboratory" as const, components: { x: 5, y: 5, z: 5 } };
    const fSum = addForces(fLab, fLab2);
    expect(fSum.frame).toBe("laboratory");
    expect(fSum.components.x).toBe(15);
    expect(fSum.components.y).toBe(25);
    expect(fSum.components.z).toBe(35);

    logElectron({
      testId: "electron-frames-cross-frame-rejected",
      resultStatus: "value",
      expected: "FrameMismatchError",
      actual: "FrameMismatchError",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Cross-frame force and acceleration addition rejected with FrameMismatchError.",
    });
  });

  test("transforms forces between laboratory and comoving frames with gamma factors", () => {
    const t0 = performance.now();
    const beta = 0.6; // gamma = 1.25
    const fLab = { frame: "laboratory" as const, components: { x: 10, y: 20, z: 30 } };

    const fCom = transformForce(fLab, beta, "comoving");
    expect(fCom.frame).toBe("comoving");
    expect(fCom.components.x).toBe(10); // parallel unchanged
    expect(withinTolerance(fCom.components.y, 25, { relative: 1e-12 }).ok).toBe(true); // 20 * 1.25
    expect(withinTolerance(fCom.components.z, 37.5, { relative: 1e-12 }).ok).toBe(true); // 30 * 1.25

    // Round trip restores laboratory components
    const fBack = transformForce(fCom, beta, "laboratory");
    expect(fBack.frame).toBe("laboratory");
    expect(withinTolerance(fBack.components.y, 20, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(fBack.components.z, 30, { relative: 1e-12 }).ok).toBe(true);

    logElectron({
      testId: "electron-frames-force-transform",
      beta,
      frame: "comoving",
      resultStatus: "value",
      expected: 25,
      actual: fCom.components.y,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Transverse forces transform with gamma factor between frames.",
    });
  });

  test("transforms accelerations with gamma^3 (longitudinal) and gamma^2 (transverse)", () => {
    const t0 = performance.now();
    const beta = 0.6; // gamma = 1.25, gamma^2 = 1.5625, gamma^3 = 1.953125
    const aLab = { frame: "laboratory" as const, components: { x: 2, y: 3, z: 4 } };

    const aCom = transformAcceleration(aLab, beta, "comoving");
    expect(aCom.frame).toBe("comoving");
    expect(withinTolerance(aCom.components.x, 2 * 1.953125, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(aCom.components.y, 3 * 1.5625, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(aCom.components.z, 4 * 1.5625, { relative: 1e-12 }).ok).toBe(true);

    const aBack = transformAcceleration(aCom, beta, "laboratory");
    expect(aBack.frame).toBe("laboratory");
    expect(withinTolerance(aBack.components.x, 2, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(aBack.components.y, 3, { relative: 1e-12 }).ok).toBe(true);

    logElectron({
      testId: "electron-frames-acceleration-transform",
      beta,
      frame: "comoving",
      resultStatus: "value",
      expected: 3.90625,
      actual: aCom.components.x,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Accelerations transform with longitudinal gamma^3 and transverse gamma^2.",
    });
  });

  test("adversarial check: raw components equality across frames fails as required (AC5)", () => {
    const t0 = performance.now();
    const beta = 0.6;
    const fLab = { frame: "laboratory" as const, components: { x: 10, y: 20, z: 30 } };
    const fCom = transformForce(fLab, beta, "comoving");

    // Transverse forces are NOT numerically equal in different frames!
    const rawEquality = fLab.components.y === fCom.components.y;
    expect(rawEquality).toBe(false);

    logElectron({
      testId: "electron-frames-adversarial-raw-equality-fails",
      beta,
      resultStatus: "value",
      expected: false,
      actual: rawEquality,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Adversarial assertion that forces have equal numerical components in different frames fails.",
    });
  });
});
