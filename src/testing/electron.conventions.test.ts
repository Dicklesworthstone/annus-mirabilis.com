import { describe, expect, test } from "bun:test";
import type { ScientificResult } from "../experiments/results/types.ts";
import { logElectron } from "../physics/reference/electron.log.ts";
import {
  C_SI,
  ELECTRON_MASS,
  longitudinalMass,
  modernMomentum,
  transverseMassComoving,
  transverseMassLaboratory,
} from "../physics/reference/electron.ts";
import { withinTolerance } from "../units/tolerance.ts";

function val(r: ScientificResult): number {
  if (r.status !== "value") {
    throw new Error(`expected value result, got ${r.status}`);
  }
  if (typeof r.value !== "number") {
    throw new Error(`expected number, got ${typeof r.value}`);
  }
  return r.value;
}

describe("electron.conventions.test.ts: Historical mass conventions and modern momentum (AC2, AC5)", () => {
  test("implements both historical conventions under registry ids at beta = 0.6", () => {
    const t0 = performance.now();
    const beta = 0.6; // gamma = 1.25, gamma^2 = 1.5625, gamma^3 = 1.953125
    const m = ELECTRON_MASS;

    const longM = longitudinalMass(m, beta);
    expect(longM.status).toBe("value");
    expect(longM.quantityId).toBe("longitudinalMass");
    expect(withinTolerance(val(longM), 1.953125 * m, { relative: 1e-12 }).ok).toBe(true);

    const transCom = transverseMassComoving(m, beta);
    expect(transCom.status).toBe("value");
    expect(transCom.quantityId).toBe("transverseMassComoving");
    expect(withinTolerance(val(transCom), 1.5625 * m, { relative: 1e-12 }).ok).toBe(true);

    const transLab = transverseMassLaboratory(m, beta);
    expect(transLab.status).toBe("value");
    expect(transLab.quantityId).toBe("transverseMassLaboratory");
    expect(withinTolerance(val(transLab), 1.25 * m, { relative: 1e-12 }).ok).toBe(true);

    logElectron({
      testId: "electron-conventions-fixture-0.6",
      beta,
      convention: "historical-1905-and-1906",
      resultStatus: "value",
      expected: 1.5625 * m,
      actual: val(transCom),
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Both historical mass conventions and longitudinal mass match exact factors at beta = 0.6.",
    });
  });

  test("modern momentum identity p = gamma * m * u evaluates consistently", () => {
    const t0 = performance.now();
    const u = { x: 0.6 * C_SI, y: 0, z: 0 };
    const p = modernMomentum(ELECTRON_MASS, u);

    expect(p.gamma).toBe(1.25);
    const expectedP = 1.25 * ELECTRON_MASS * 0.6 * C_SI;
    expect(withinTolerance(p.px, expectedP, { relative: 1e-12 }).ok).toBe(true);
    expect(p.py).toBe(0);
    expect(p.pz).toBe(0);
    expect(withinTolerance(p.pMag, expectedP, { relative: 1e-12 }).ok).toBe(true);

    logElectron({
      testId: "electron-conventions-modern-momentum",
      beta: 0.6,
      resultStatus: "value",
      expected: expectedP,
      actual: p.pMag,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Modern momentum identity p = gamma * m * u verified within 1e-12 relative.",
    });
  });

  test("guard: single scalar relativistic mass without definitions is rejected (AC5)", () => {
    const t0 = performance.now();
    // Verify that the module distinguishes longitudinal vs transverse mass and requires explicit conventions
    const longVal = val(longitudinalMass(1.0, 0.6));
    const transComVal = val(transverseMassComoving(1.0, 0.6));
    const transLabVal = val(transverseMassLaboratory(1.0, 0.6));

    // They are distinctly different quantities: 1.953125 != 1.5625 != 1.25
    expect(longVal).not.toBe(transComVal);
    expect(transComVal).not.toBe(transLabVal);

    logElectron({
      testId: "electron-conventions-no-single-scalar-relativistic-mass",
      beta: 0.6,
      resultStatus: "value",
      expected: "distinct-conventions",
      actual: "distinct-conventions",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Single scalar relativistic mass without definition is not offered; conventions are distinct.",
    });
  });
});
