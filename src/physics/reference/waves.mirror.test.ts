import { describe, expect, test } from "bun:test";
import { logWaves } from "./waves.log.ts";
import { movingMirror } from "./waves.ts";

describe("am-ref-waves-r53: waves.mirror.test.ts", () => {
  test("Normal incidence mirror fixtures at beta = 0.6 and approaching beta = -0.6", () => {
    const t0 = performance.now();
    // Normal incidence receding at beta = 0.6
    const resNorm = movingMirror(0.6, 0);
    expect(resNorm.status).toBe("value");
    if (resNorm.status === "value") {
      expect(resNorm.frequencyRatio).toBeCloseTo(0.25, 12);
      expect(resNorm.incidentPower).toBeCloseTo(0.4, 12);
      expect(resNorm.radiationForce).toBeCloseTo(0.5, 12);
      expect(resNorm.workRate).toBeCloseTo(0.3, 12);
      expect(resNorm.reflectedPower).toBeCloseTo(0.1, 12);
      expect(Math.abs(resNorm.energyBalanceResidual)).toBeLessThan(1e-12);
    }

    // Normal incidence approaching at beta = -0.6
    const resApp = movingMirror(-0.6, 0);
    expect(resApp.status).toBe("value");
    if (resApp.status === "value") {
      expect(resApp.frequencyRatio).toBeCloseTo(4.0, 12);
      expect(resApp.amplitudeRatio).toBeCloseTo(4.0, 12);
      expect(Math.abs(resApp.energyBalanceResidual)).toBeLessThan(1e-12);
    }

    logWaves({
      testId: "moving-mirror-normal-fixtures",
      beta: 0.6,
      thetaRad: 0,
      frame: "K",
      resultStatus: "value",
      expected: 0.25,
      actual: resNorm.status === "value" ? resNorm.frequencyRatio : undefined,
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Normal incidence fixtures pass: nu'''/nu = 0.25, Pi = 0.4, F = 0.5, W = 0.3, Pr = 0.1; approaching gives 4.0.",
    });
  });

  test("Oblique incidence fixture at phi = 30 deg, beta = 0.6", () => {
    const t0 = performance.now();
    const phi = Math.PI / 6; // 30 deg
    const beta = 0.6;
    const res = movingMirror(beta, phi);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      // Einstein §8 printed formula values:
      // frequencyRatio = (1 - 2*beta*cos(phi) + beta^2)/(1 - beta^2)
      // cos(30) = sqrt(3)/2 ~ 0.8660254
      // 1 - 2*0.6*0.8660254 + 0.36 = 1.36 - 1.0392305 = 0.3207695
      // denom = 1 - 0.36 = 0.64
      // frequencyRatio = 0.3207695 / 0.64 ~ 0.501202
      expect(res.frequencyRatio).toBeCloseTo(0.501202, 5);
      expect(res.cosPhiReflected).toBeCloseTo(0.0692256, 5);
      expect(res.incidentPower).toBeCloseTo(0.266025, 5);
      expect(res.reflectedPower).toBeCloseTo(0.133333, 5);
      expect(res.workRate).toBeCloseTo(0.132692, 5);
      expect(Math.abs(res.energyBalanceResidual)).toBeLessThan(1e-12);
      expect(res.explanation).toBeDefined();
    }

    logWaves({
      testId: "moving-mirror-oblique-fixture",
      beta,
      thetaRad: phi,
      frame: "K",
      resultStatus: "value",
      expected: 0.501202,
      actual: res.status === "value" ? res.frequencyRatio : undefined,
      tolerance: 1e-5,
      comparisonKind: "relative",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Oblique 30 deg fixture matches printed formula to 1e-5 and energy balance within 1e-12.",
    });
  });

  test("Stationary limit beta -> 0 recovers classical fixed mirror", () => {
    const t0 = performance.now();
    const phi = (45 * Math.PI) / 180;
    const res0 = movingMirror(0, phi, { u: 1.0, Am: 1.0, c: 1.0 });
    expect(res0.status).toBe("value");
    if (res0.status === "value") {
      expect(res0.frequencyRatio).toBeCloseTo(1.0, 12);
      expect(res0.cosPhiReflected).toBeCloseTo(-Math.cos(phi), 12);
      expect(res0.workRate).toBe(0);
      expect(res0.radiationForce).toBeCloseTo(2 * Math.cos(phi) ** 2, 12);
      expect(res0.incidentPower).toBeCloseTo(res0.reflectedPower, 12);
      expect(Math.abs(res0.energyBalanceResidual)).toBeLessThan(1e-12);
    }

    logWaves({
      testId: "moving-mirror-stationary-limit",
      beta: 0,
      thetaRad: phi,
      frame: "K",
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Stationary limit beta = 0 reproduces classical reflection with zero work and law of reflection.",
    });
  });

  test("Interception boundary and band: cos(phi) <= beta returns not-applicable or indeterminate", () => {
    const t0 = performance.now();
    const beta = 0.6;
    const phiCrit = Math.acos(beta); // ~53.13 deg

    // Exactly at critical angle: within tolerance band -> indeterminate
    const resCrit = movingMirror(beta, phiCrit);
    expect(resCrit.status).toBe("indeterminate");
    if (resCrit.status === "indeterminate") {
      expect(resCrit.reason).toContain("interception boundary");
    }

    // Beyond critical angle (e.g. 60 deg -> cos(60) = 0.5 < 0.6): receding light cannot catch mirror
    const resBeyond = movingMirror(beta, Math.PI / 3);
    expect(resBeyond.status).toBe("not-applicable");
    if (resBeyond.status === "not-applicable") {
      expect(resBeyond.reason).toContain("never reaches the receding mirror");
    }

    logWaves({
      testId: "moving-mirror-interception-boundary",
      beta,
      resultStatus: "not-applicable",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Interception boundary returns indeterminate in tolerance band and not-applicable beyond.",
    });
  });

  test("Energy balance property tests over 200 seeded admissible beta and phi", () => {
    const t0 = performance.now();
    let seed = 19050927;

    for (let i = 0; i < 200; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const beta = ((seed % 10000) / 10000) * 1.6 - 0.8; // beta in (-0.8, 0.8)

      // Choose phi such that cos(phi) > beta + 0.02 to ensure valid interception
      const minCos = Math.max(-0.99, beta + 0.05);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const cosPhi = minCos + ((seed % 10000) / 10000) * (1.0 - minCos);
      const phi = Math.acos(Math.max(-1, Math.min(1, cosPhi)));

      const res = movingMirror(beta, phi);
      expect(res.status).toBe("value");
      if (res.status === "value") {
        expect(Math.abs(res.energyBalanceResidual)).toBeLessThan(1e-12);
        expect(res.incidentPower - res.reflectedPower - res.workRate).toBeCloseTo(0, 12);
      }
    }

    logWaves({
      testId: "moving-mirror-energy-balance-seeded-property",
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Energy conservation residual Pi - Pr - W < 1e-12 across 200 seeded parameter configurations.",
    });
  });

  test("Adversarial case: omitting the velocity factor (1 - beta) in incident power breaks energy balance", () => {
    const t0 = performance.now();
    const beta = 0.6;
    const res = movingMirror(beta, 0);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      // True incident power is u * c * Am * (1 - beta) = 0.4
      // Adversarial: using static incident power u * c * Am = 1.0
      const adversarialIncidentPower = 1.0;
      const adversarialResidual = adversarialIncidentPower - res.reflectedPower - res.workRate;
      // 1.0 - 0.1 - 0.3 = 0.6 != 0
      expect(Math.abs(adversarialResidual)).toBeGreaterThan(0.5);
      expect(adversarialResidual).toBeCloseTo(0.6, 12);
    }

    logWaves({
      testId: "moving-mirror-adversarial-power-factor",
      beta,
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Adversarial check confirms omitting (1 - beta) breaks energy balance by 0.6.",
    });
  });
});
