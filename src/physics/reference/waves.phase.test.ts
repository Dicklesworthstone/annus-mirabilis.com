import { describe, expect, test } from "bun:test";
import { gamma } from "./kinematics.ts";
import { logWaves } from "./waves.log.ts";
import { C_SI, detectorCrossingCount, phaseAtEvent, transformWaveVector } from "./waves.ts";

describe("am-ref-waves-r53: waves.phase.test.ts", () => {
  test("wave-vector transform obeys Lorentz boost and preserves null 4-vector norm", () => {
    const t0 = performance.now();
    const beta = 0.6;
    const c = C_SI;
    const omega = 5e14 * 2 * Math.PI;
    const kMag = omega / c;
    const theta = Math.PI / 3;
    const k = { x: kMag * Math.cos(theta), y: kMag * Math.sin(theta), z: 0 };

    const boosted = transformWaveVector(omega, k, beta, c);
    const g = gamma(beta);
    expect(g.status).toBe("value");
    const gammaVal = (g as { status: "value"; value: number }).value;

    const expectedOmegaPrime = gammaVal * (omega - beta * c * k.x);
    const expectedKxPrime = gammaVal * (k.x - (beta * omega) / c);

    expect(boosted.omegaPrime).toBeCloseTo(expectedOmegaPrime, 10);
    expect(boosted.kPrime.x).toBeCloseTo(expectedKxPrime, 10);
    expect(boosted.kPrime.y).toBeCloseTo(k.y, 10);
    expect(boosted.kPrime.z).toBeCloseTo(k.z, 10);

    // Invariant null norm: -(omega/c)^2 + kx^2 + ky^2 + kz^2 = 0
    const normOrig = -((omega / c) ** 2) + k.x * k.x + k.y * k.y + k.z * k.z;
    const normBoosted =
      -((boosted.omegaPrime / c) ** 2) +
      boosted.kPrime.x * boosted.kPrime.x +
      boosted.kPrime.y * boosted.kPrime.y +
      boosted.kPrime.z * boosted.kPrime.z;

    expect(Math.abs(normOrig) / (omega / c) ** 2).toBeLessThan(1e-12);
    expect(Math.abs(normBoosted) / (boosted.omegaPrime / c) ** 2).toBeLessThan(1e-12);

    // Inverse transform with -beta recovers original
    const recovered = transformWaveVector(boosted.omegaPrime, boosted.kPrime, -beta, c);
    expect(recovered.omegaPrime / omega).toBeCloseTo(1.0, 12);
    expect(recovered.kPrime.x / k.x).toBeCloseTo(1.0, 12);
    expect(recovered.kPrime.y / k.y).toBeCloseTo(1.0, 12);

    logWaves({
      testId: "wave-vector-transform-lorentz",
      beta,
      thetaRad: theta,
      resultStatus: "value",
      expected: expectedOmegaPrime,
      actual: boosted.omegaPrime,
      tolerance: 1e-10,
      comparisonKind: "relative",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Wave 4-vector transforms correctly under standard Lorentz boost.",
    });
  });

  test("phase invariance between independently boosted events and waves", () => {
    const t0 = performance.now();
    const betas = [-0.95, -0.6, 0, 0.6, 0.95];
    const thetas = [0, Math.PI / 6, Math.PI / 2, Math.PI];

    for (const beta of betas) {
      const gRes = gamma(beta);
      if (gRes.status !== "value") continue;
      const g = gRes.value;

      for (const theta of thetas) {
        const omega = 6e14 * 2 * Math.PI;
        const kMag = omega / C_SI;
        const kx = kMag * Math.cos(theta);
        const ky = kMag * Math.sin(theta);
        const kz = 0;

        const eventK = { t: 1.5e-15, x: 2.5e-7, y: 1.0e-7, z: 0 };
        const event_k = {
          t: g * (eventK.t - (beta * eventK.x) / C_SI),
          x: g * (eventK.x - beta * C_SI * eventK.t),
          y: eventK.y,
          z: eventK.z,
        };

        const waveK = { omega, kx, ky, kz };
        const trans = transformWaveVector(omega, { x: kx, y: ky, z: kz }, beta, C_SI);
        const wave_k = {
          omega: trans.omegaPrime,
          kx: trans.kPrime.x,
          ky: trans.kPrime.y,
          kz: trans.kPrime.z,
        };

        const resK = phaseAtEvent(eventK, waveK);
        const res_k = phaseAtEvent(event_k, wave_k);

        expect(resK.status).toBe("value");
        expect(res_k.status).toBe("value");

        if (resK.status === "value" && res_k.status === "value") {
          const valK = resK.value as number;
          const val_k = res_k.value as number;
          const diff = Math.abs(valK - val_k);
          expect(diff).toBeLessThan(1e-12);
        }
      }
    }

    logWaves({
      testId: "phase-invariance-multicase",
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Phase invariance verified across sweep of speeds and angles within 1e-12.",
    });
  });

  test("detector crossing count matches frequency within one crossing per window", () => {
    const t0 = performance.now();
    const nu = 1000; // 1 kHz
    const omega = 2 * Math.PI * nu;
    const c = 1.0;
    const k = { x: omega / c, y: 0, z: 0 };

    // Stationary detector
    const countStationary = detectorCrossingCount({
      omega,
      k,
      detectorVelocity: { x: 0, y: 0, z: 0 },
      window: 1.0,
    });
    expect(Math.abs(countStationary - 1000)).toBeLessThan(1e-12);

    // Moving detector receding at v = 0.5c -> encounters half the frequency
    const countMoving = detectorCrossingCount({
      omega,
      k,
      detectorVelocity: { x: 0.5, y: 0, z: 0 },
      window: 2.0,
    });
    // Expected: 500 Hz * 2 s = 1000 crossings
    expect(Math.abs(countMoving - 1000)).toBeLessThan(1e-12);

    // Moving detector approaching at v = -0.5c -> encounters 1.5x frequency
    const countApproaching = detectorCrossingCount({
      omega,
      k,
      detectorVelocity: { x: -0.5, y: 0, z: 0 },
      window: 1.0,
    });
    expect(Math.abs(countApproaching - 1500)).toBeLessThan(1e-12);

    logWaves({
      testId: "detector-crossing-counts",
      resultStatus: "value",
      expected: 1000,
      actual: countMoving,
      tolerance: 1.0,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Detector crossing count matches wave frequency within one crossing per window.",
    });
  });
});
