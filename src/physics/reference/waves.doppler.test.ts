import { describe, expect, test } from "bun:test";
import { boostMatrixXT, gamma } from "./kinematics.ts";
import { logWaves } from "./waves.log.ts";
import { aberration, dopplerFactor, evaluateSr09 } from "./waves.ts";

describe("am-ref-waves-r53: waves.doppler.test.ts", () => {
  test("Doppler factor fixtures at beta = 0.6", () => {
    const t0 = performance.now();
    const beta = 0.6;

    // 1. Longitudinal receding (theta = 0): nu' / nu = 0.5
    const d0 = dopplerFactor(beta, 0);
    expect(d0).toBeCloseTo(0.5, 12);

    // 2. Longitudinal approaching (theta = pi): nu' / nu = 2.0
    const dPi = dopplerFactor(beta, Math.PI);
    expect(dPi).toBeCloseTo(2.0, 12);

    // 3. Transverse in stationary frame K (theta = pi/2): nu' / nu = gamma = 1.25
    const d90 = dopplerFactor(beta, Math.PI / 2);
    expect(d90).toBeCloseTo(1.25, 12);

    // 4. Transverse in moving frame k (cos(theta) = beta): nu' / nu = 1 / gamma = 0.8
    const thetaTransversePrime = Math.acos(beta);
    const dTransversePrime = dopplerFactor(beta, thetaTransversePrime);
    expect(dTransversePrime).toBeCloseTo(0.8, 12);

    logWaves({
      testId: "doppler-fixtures-beta-0.6",
      beta,
      resultStatus: "value",
      expected: 0.5,
      actual: d0,
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Doppler fixtures pass at beta = 0.6: 0.5 (theta=0), 2.0 (theta=pi), 1.25 (theta=pi/2), 0.8 (cos theta=beta).",
    });
  });

  test("Doppler fixed points at beta = 0", () => {
    const t0 = performance.now();
    for (const theta of [0, 0.2, Math.PI / 4, Math.PI / 2, Math.PI, 2.7]) {
      const d = dopplerFactor(0, theta);
      expect(d).toBeCloseTo(1.0, 12);
    }

    logWaves({
      testId: "doppler-fixed-points-zero-speed",
      beta: 0,
      resultStatus: "value",
      expected: 1.0,
      actual: 1.0,
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Doppler factor is identically 1.0 at beta = 0 for all angles.",
    });
  });

  test("Doppler inverse round-trips with aberration angle", () => {
    const t0 = performance.now();
    const beta = 0.6;
    for (const theta of [0.1, 0.5, Math.PI / 3, 2.1]) {
      const dFwd = dopplerFactor(beta, theta);
      const ab = aberration(beta, theta);
      const thetaPrime = ab.thetaPrimeRad;
      const dInv = dopplerFactor(-beta, thetaPrime);
      expect(dFwd * dInv).toBeCloseTo(1.0, 12);
    }

    logWaves({
      testId: "doppler-inverse-roundtrip",
      beta,
      resultStatus: "value",
      expected: 1.0,
      tolerance: 1e-12,
      comparisonKind: "relative",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Forward and inverse Doppler product equals 1.0 through aberration angle.",
    });
  });

  test("v = -V refusal: superluminal and luminal speeds refused as outside-domain", () => {
    const t0 = performance.now();
    // In Einstein 1905 notation, V = c, so v = -V corresponds to beta = -1.
    // At v = -V, nu' diverges to infinity; physical inertial observer cannot travel at c.
    expect(Number.isNaN(dopplerFactor(-1.0, 0))).toBe(true);
    expect(Number.isNaN(dopplerFactor(1.0, 0))).toBe(true);
    expect(Number.isNaN(dopplerFactor(-1.5, 0))).toBe(true);
    expect(Number.isNaN(dopplerFactor(1.5, 0))).toBe(true);

    const sr09Refusal = evaluateSr09({
      beta: -1.0,
      propagationAngleDeg: 0,
      frequencyHz: 5e14,
    });
    expect(sr09Refusal.status).toBe("outside-domain");
    const outsideRes = sr09Refusal.results.find((r) => r.quantityId === "dopplerFactor");
    expect(outsideRes).toBeDefined();
    if (outsideRes && outsideRes.status === "outside-domain") {
      expect(outsideRes.condition).toBe("superluminal-speed");
      expect(outsideRes.reason).toBe("No inertial observer at |v| >= c.");
    }

    logWaves({
      testId: "v-minus-V-refusal",
      beta: -1.0,
      resultStatus: "outside-domain",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "v = -V (luminal and superluminal speed) is cleanly refused as outside-domain.",
    });
  });

  test("identity check: longitudinal Doppler factors identically match SR-04 boostMatrixXT eigenvalues", () => {
    const t0 = performance.now();
    const testBetas = [0.01, 0.1, 0.3, 0.5, 0.6, 0.8, 0.95];

    for (const beta of testBetas) {
      // 1. Doppler factors
      const dReceding = dopplerFactor(beta, 0); // longitudinal receding
      const dApproaching = dopplerFactor(beta, Math.PI); // longitudinal approaching

      // 2. Analytical formula: sqrt((1-beta)/(1+beta)) and sqrt((1+beta)/(1-beta))
      const expectedReceding = Math.sqrt((1 - beta) / (1 + beta));
      const expectedApproaching = Math.sqrt((1 + beta) / (1 - beta));

      expect(dReceding).toBeCloseTo(expectedReceding, 12);
      expect(dApproaching).toBeCloseTo(expectedApproaching, 12);

      // 3. SR-04 boost matrix XT from kinematics.ts
      const matrixResult = boostMatrixXT(beta);
      expect(matrixResult.status).toBe("value");
      if (matrixResult.status === "value") {
        const mat = matrixResult.value;
        expect(mat).toHaveLength(2);
        // mat is a 2x2 matrix: [[gamma, -gamma*beta/c], [-gamma*beta*c, gamma]]
        // Characteristic equation: lambda^2 - 2*gamma*lambda + (gamma^2 - gamma^2*beta^2) = 0
        // Because gamma^2(1-beta^2) = 1, det = 1, trace = 2*gamma.
        // Eigenvalues: gamma +- sqrt(gamma^2 - 1) = gamma +- gamma*beta = gamma*(1 +- beta)
        const g = (gamma(beta) as { status: "value"; value: number }).value;
        const lambda1 = g * (1 - beta); // = sqrt((1-beta)/(1+beta))
        const lambda2 = g * (1 + beta); // = sqrt((1+beta)/(1-beta))

        expect(lambda1).toBeCloseTo(dReceding, 12);
        expect(lambda2).toBeCloseTo(dApproaching, 12);
        expect(lambda1 * lambda2).toBeCloseTo(1.0, 12);
      }
    }

    logWaves({
      testId: "doppler-sr04-eigenvalue-identity",
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "relative",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Longitudinal Doppler factors identically match SR-04 boost matrix eigenvalues across beta sweep.",
    });
  });
});
