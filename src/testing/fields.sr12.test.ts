import { describe, expect, test } from "bun:test";
import {
  C_SI,
  currentLoopCharges,
  evaluateSr12,
  fourCurrentInvariants,
  gaussianPulseContinuity,
  sphereTotalCharge,
  transformChargeCurrent,
  type Vec3,
} from "../physics/reference/fields.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "instrument-sr-12";
const suiteLogger = new TestLogger(SUITE, newRunIdentity());

function valScalar(res: { status: string; value?: number | Float64Array }): number {
  expect(res.status).toBe("value");
  return res.value as number;
}

function valVec(res: { status: string; value?: number | Float64Array }): [number, number, number] {
  expect(res.status).toBe("value");
  const arr = res.value as Float64Array;
  return [arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0];
}

describe("SR-12 charge and current density transformations (§9)", () => {
  test("neutral conductor at beta = 0.6 gives rho' ≈ -2.5017e-9 C/m^3 and J'x = 1.25 A/m^2", async () => {
    const startTime = Date.now();
    const snap = evaluateSr12({
      unitLayer: "si",
      descriptionFrame: "stationary",
      mode: "neutral-conductor",
      chargeDensity: 0,
      currentDensity: { x: 1, y: 0, z: 0 },
      boost: 0.6 * C_SI,
      carrierVelocity: { x: 0, y: 0, z: 0 },
      sphereRadius: 1,
      sphereCharge: (4 / 3) * Math.PI,
      loopCurrent: 1,
      loopLengthX: 1,
      loopLengthY: 0.5,
      pulseWidth: 1,
      pulseAmplitude: 1,
    });

    const rhoPrime = valScalar(snap.chargeDensityMoving);
    const jPrime = valVec(snap.currentDensityMoving);
    const gamma = valScalar(snap.lorentzFactor);
    const invSI = valScalar(snap.fourCurrentInvariant);
    const invNorm = valScalar(snap.fourCurrentInvariantNormalized);

    expect(gamma).toBeCloseTo(1.25, 12);
    expect(rhoPrime).toBeCloseTo(-0.75 / C_SI, 12);
    expect(rhoPrime).toBeCloseTo(-2.50171804e-9, 6);
    expect(jPrime[0]).toBeCloseTo(1.25, 12);
    expect(jPrime[1]).toBe(0);
    expect(jPrime[2]).toBe(0);

    // Invariant (c rho)^2 - J^2 = -1 (A/m^2)^2
    expect(invSI).toBeCloseTo(-1.0, 10);
    expect(invNorm).toBeCloseTo(-1.0 / (C_SI * C_SI), 20);

    suiteLogger.log({
      testId: "sr12-neutral-conductor-0.6c",
      beadId: "am-sr-12-charge-current-bgq0",
      paper: "special-relativity",
      outcome: "passed",
      durationMs: Date.now() - startTime,
      message: "Verified neutral conductor at beta=0.6: rho'= -0.75/c, J'x = 1.25, invariant = -1.",
      extra: {
        rho: 0,
        Jx: 1,
        beta: 0.6,
        rhoPrime,
        jPrimeX: jPrime[0],
        invariant: invSI,
      },
    });
    await suiteLogger.flush();
  });

  test("convection case ux = 0.5c, beta = 0.6 gives rho' = 0.875 rho in both unit layers", async () => {
    const startTime = Date.now();
    const rho0 = 1.0;
    const snap = evaluateSr12({
      unitLayer: "si",
      descriptionFrame: "stationary",
      mode: "convection",
      chargeDensity: rho0,
      currentDensity: { x: 0.5 * C_SI, y: 0, z: 0 },
      boost: 0.6 * C_SI,
      carrierVelocity: { x: 0.5 * C_SI, y: 0, z: 0 },
      sphereRadius: 1,
      sphereCharge: (4 / 3) * Math.PI,
      loopCurrent: 1,
      loopLengthX: 1,
      loopLengthY: 0.5,
      pulseWidth: 1,
      pulseAmplitude: 1,
    });

    const rhoPrime = valScalar(snap.chargeDensityMoving);
    const jPrime = valVec(snap.currentDensityMoving);

    // rho' = gamma * (rho - v Jx / c^2) = 1.25 * (1 - 0.6 * 0.5) = 1.25 * 0.7 = 0.875
    expect(rhoPrime).toBeCloseTo(0.875 * rho0, 12);
    // J'x = gamma * (Jx - v rho) = 1.25 * (0.5c - 0.6c) = -0.125c
    expect(jPrime[0]).toBeCloseTo(-0.125 * C_SI, 4);

    // Transformed carrier velocity u'x = J'x / rho' = -0.125c / 0.875 = -c / 7
    const uPrime = jPrime[0] / rhoPrime;
    expect(uPrime).toBeCloseTo(-C_SI / 7, 4);

    suiteLogger.log({
      testId: "sr12-convection-0.5c",
      beadId: "am-sr-12-charge-current-bgq0",
      paper: "special-relativity",
      outcome: "passed",
      durationMs: Date.now() - startTime,
      message: "Verified convection current transformation at ux=0.5c, beta=0.6: rho' = 0.875 rho.",
      extra: { rho0, rhoPrime, uPrime },
    });
    await suiteLogger.flush();
  });

  test("uniformly charged sphere moving at 0.6c has equal total charge in both frames", async () => {
    const startTime = Date.now();
    const R = 1.2;
    const rho0 = 3.5;
    const Q0 = sphereTotalCharge(R, rho0);

    const boost = 0.6 * C_SI;
    const snap = evaluateSr12({
      unitLayer: "si",
      descriptionFrame: "stationary",
      mode: "moving-sphere",
      chargeDensity: rho0,
      currentDensity: { x: 0, y: 0, z: 0 },
      boost,
      carrierVelocity: { x: 0, y: 0, z: 0 },
      sphereRadius: R,
      sphereCharge: Q0,
      loopCurrent: 1,
      loopLengthX: 1,
      loopLengthY: 0.5,
      pulseWidth: 1,
      pulseAmplitude: 1,
    });

    const Q_stat = valScalar(snap.sphereTotalChargeStationary);
    const Q_mov = valScalar(snap.sphereTotalChargeMoving);

    expect(Q_stat).toBeCloseTo(Q0, 12);
    expect(Q_mov).toBeCloseTo(Q0, 12);
    expect(Math.abs(Q_mov - Q_stat) / Q_stat).toBeLessThan(1e-12);

    suiteLogger.log({
      testId: "sr12-moving-sphere-total-charge",
      beadId: "am-sr-12-charge-current-bgq0",
      paper: "special-relativity",
      outcome: "passed",
      durationMs: Date.now() - startTime,
      message: "Verified total charge invariance for moving sphere at 0.6c within 1e-12 relative.",
      extra: { Q0, Q_stat, Q_mov },
    });
    await suiteLogger.flush();
  });

  test("rectangular current loop gives leg charges ∓2.0014e-9 C and total charge zero within 1e-24 C", async () => {
    const startTime = Date.now();
    const I = 1.0;
    const lx = 1.0;
    const ly = 0.5;
    const boost = 0.6 * C_SI;

    const loop = currentLoopCharges(I, lx, ly, boost);

    // gamma = 1.25, contracted length = 0.8 m
    expect(loop.gamma).toBeCloseTo(1.25, 12);
    expect(loop.contractedLengthX).toBeCloseTo(0.8, 12);

    // Line densities: lambda' = -/+ gamma * v * I / c^2 = -/+ 1.25 * 0.6 / c = -/+ 0.75 / c ≈ -/+ 2.5017e-9 C/m
    expect(loop.lineDensityPositive).toBeCloseTo(-0.75 / C_SI, 12);
    expect(loop.lineDensityNegative).toBeCloseTo(+0.75 / C_SI, 12);

    // Leg charges: q' = lambda' * l'x = (-0.75 / c) * 0.8 = -0.6 / c ≈ -2.00137443e-9 C
    expect(loop.legChargePositive).toBeCloseTo(-0.6 / C_SI, 12);
    expect(loop.legChargePositive).toBeCloseTo(-2.00137443e-9, 6);
    expect(loop.legChargeNegative).toBeCloseTo(+0.6 / C_SI, 12);
    expect(loop.legChargeNegative).toBeCloseTo(+2.00137443e-9, 6);

    // Total charge: exactly 0
    expect(Math.abs(loop.totalCharge)).toBeLessThan(1e-24);

    // Also verify via evaluateSr12 snapshot
    const snap = evaluateSr12({
      unitLayer: "si",
      descriptionFrame: "stationary",
      mode: "current-loop",
      chargeDensity: 0,
      currentDensity: { x: 1, y: 0, z: 0 },
      boost,
      carrierVelocity: { x: 0, y: 0, z: 0 },
      sphereRadius: 1,
      sphereCharge: 1,
      loopCurrent: I,
      loopLengthX: lx,
      loopLengthY: ly,
      pulseWidth: 1,
      pulseAmplitude: 1,
    });

    expect(valScalar(snap.loopLegChargePositive)).toBeCloseTo(-0.6 / C_SI, 12);
    expect(valScalar(snap.loopLegChargeNegative)).toBeCloseTo(+0.6 / C_SI, 12);
    expect(Math.abs(valScalar(snap.loopTotalCharge))).toBeLessThan(1e-24);

    suiteLogger.log({
      testId: "sr12-current-loop-charges",
      beadId: "am-sr-12-charge-current-bgq0",
      paper: "special-relativity",
      outcome: "passed",
      durationMs: Date.now() - startTime,
      message: "Verified loop leg charges ∓2.0014e-9 C and total charge = 0 within 1e-24 C.",
      extra: {
        legPositive: loop.legChargePositive,
        legNegative: loop.legChargeNegative,
        total: loop.totalCharge,
      },
    });
    await suiteLogger.flush();
  });

  test("analytic continuity equation residuals satisfy zero criterion in both frames", async () => {
    const pulse = gaussianPulseContinuity(1.0, 0.5 * C_SI, 1.0, 0.2, 0.1, 0.6 * C_SI);
    expect(pulse.stationaryResidual).toBeLessThan(1e-14);
    expect(pulse.movingResidual).toBeLessThan(1e-14);
  });

  test("boost inverse round-trip v -> -v recovers original charge and current density within 1e-12", () => {
    const rho0 = 12.34;
    const J0: Vec3 = { x: 56.78, y: -90.12, z: 34.56 };
    const boost = 0.85 * C_SI;

    const fwd = transformChargeCurrent({ rho: rho0, J: J0, boost });
    const bwd = transformChargeCurrent({ rho: fwd.rho, J: fwd.J, boost: -boost });

    expect(bwd.rho).toBeCloseTo(rho0, 10);
    expect(bwd.J.x).toBeCloseTo(J0.x, 5);
    expect(bwd.J.y).toBeCloseTo(J0.y, 12);
    expect(bwd.J.z).toBeCloseTo(J0.z, 12);
  });

  test("property test: four-current invariant preserved over 500 seeded configurations", () => {
    let seed = 19050926;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 500; i++) {
      const rho = (rand() - 0.5) * 20;
      const J: Vec3 = {
        x: (rand() - 0.5) * 1e8,
        y: (rand() - 0.5) * 1e8,
        z: (rand() - 0.5) * 1e8,
      };
      const beta = (rand() - 0.5) * 1.8; // within [-0.9, 0.9]
      const boost = beta * C_SI;

      const fwd = transformChargeCurrent({ rho, J, boost });
      const inv0 = fourCurrentInvariants(rho, J);
      const invPrime = fourCurrentInvariants(fwd.rho, fwd.J);

      const maxScale = Math.max(1.0, Math.abs(inv0.si), Math.abs(invPrime.si));
      expect(Math.abs(invPrime.si - inv0.si) / maxScale).toBeLessThan(1e-10);
    }
  });

  test("adversarial: a validator that enforces |J/rho| < c rejects neutral conductors and fails", () => {
    const rho = 0;
    const Jx = 1.0;

    // Buggy check that enforces single-carrier convection |J/rho| < c
    const buggyConvectionValidator = (r: number, j: number) => {
      if (r === 0 && j !== 0) return { kind: "refused", reason: "|J/rho| is infinite" };
      if (Math.abs(j / r) >= C_SI) return { kind: "refused", reason: "|J/rho| >= c" };
      return { kind: "accepted" };
    };

    const buggyCheck = buggyConvectionValidator(rho, Jx);
    expect(buggyCheck.kind).toBe("refused"); // Proves the buggy validator rejects neutral conductors

    // Real model must accept neutral conductors without ratio check
    const realEvaluation = evaluateSr12({
      unitLayer: "si",
      descriptionFrame: "stationary",
      mode: "neutral-conductor",
      chargeDensity: rho,
      currentDensity: { x: Jx, y: 0, z: 0 },
      boost: 0.6 * C_SI,
      carrierVelocity: { x: 0, y: 0, z: 0 },
      sphereRadius: 1,
      sphereCharge: 1,
      loopCurrent: 1,
      loopLengthX: 1,
      loopLengthY: 0.5,
      pulseWidth: 1,
      pulseAmplitude: 1,
    });

    expect(realEvaluation.chargeDensityMoving.status).toBe("value");
    expect(valScalar(realEvaluation.chargeDensityMoving)).toBeCloseTo(-0.75 / C_SI, 12);
  });

  test("adversarial: uncontracted loop leg length produces wrong leg charges", () => {
    const I = 1.0;
    const lx = 1.0;
    const boost = 0.6 * C_SI;
    const gamma = 1.25;

    // Wrong calculation: fails to contract leg length in moving frame
    const uncontractedLegCharge = ((-gamma * (boost * I)) / (C_SI * C_SI)) * lx;
    expect(uncontractedLegCharge).toBeCloseTo(-0.75 / C_SI, 12); // -2.5017e-9 C (WRONG!)

    // Correct physical calculation with Lorentz contracted length lx / gamma:
    const correctLoop = currentLoopCharges(I, lx, 0.5, boost);
    expect(correctLoop.legChargePositive).toBeCloseTo(-0.6 / C_SI, 12); // -2.0014e-9 C (CORRECT!)
    expect(Math.abs(correctLoop.legChargePositive - uncontractedLegCharge)).toBeGreaterThan(1e-10);
  });
});
