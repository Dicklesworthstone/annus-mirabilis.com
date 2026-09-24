import { describe, expect, test } from "bun:test";
import { C_SI, evaluateSr11, mirrorFrameLedger, movingMirror } from "../physics/reference/waves.ts";

describe("SR-11 Reference Physics: Moving Mirror Reflection & Radiation Pressure", () => {
  test("Normal incidence receding mirror at beta = 0.6", () => {
    const res = movingMirror(0.6, 0, { u: 1.0, c: 1.0, Am: 1.0 });
    expect(res.status).toBe("value");
    if (res.status !== "value") return;

    // nu''' / nu = (1 - 2*0.6 + 0.36) / (1 - 0.36) = 0.16 / 0.64 = 0.25
    expect(res.frequencyRatio).toBeCloseTo(0.25, 10);
    // cos(phi''') = -((1 + 0.36)*1 - 1.2) / 0.16 = -1
    expect(res.cosPhiReflected).toBeCloseTo(-1.0, 10);
    expect(res.amplitudeRatio).toBeCloseTo(0.25, 10);
    // Radiation pressure P = 2*u*(1 - 0.6)^2 / (1 - 0.36) = 2*0.16 / 0.64 = 0.5
    expect(res.radiationPressure).toBeCloseTo(0.5, 10);
    expect(res.radiationForce).toBeCloseTo(0.5, 10);
    // Incident power = u * c * Am * (1 - 0.6) = 0.4
    expect(res.incidentPower).toBeCloseTo(0.4, 10);
    // Reflected power = u * (0.25)^2 * c * Am * (0.6 - (-1)) = 0.0625 * 1.6 = 0.1
    expect(res.reflectedPower).toBeCloseTo(0.1, 10);
    // Work rate = P * v * Am = 0.5 * 0.6 * 1 = 0.3
    expect(res.workRate).toBeCloseTo(0.3, 10);
    // Exact balance: 0.4 - 0.1 - 0.3 = 0
    expect(Math.abs(res.energyBalanceResidual)).toBeLessThan(1e-12);
  });

  test("Approaching mirror at beta = -0.6 (head-on collision)", () => {
    const res = movingMirror(-0.6, 0, { u: 1.0, c: 1.0, Am: 1.0 });
    expect(res.status).toBe("value");
    if (res.status !== "value") return;

    // nu''' / nu = (1 - 2*(-0.6) + 0.36) / (1 - 0.36) = 2.56 / 0.64 = 4.0
    expect(res.frequencyRatio).toBeCloseTo(4.0, 10);
    expect(res.cosPhiReflected).toBeCloseTo(-1.0, 10);
    expect(res.radiationPressure).toBeCloseTo(8.0, 10);
    expect(res.incidentPower).toBeCloseTo(1.6, 10);
    expect(res.reflectedPower).toBeCloseTo(6.4, 10);
    // Mirror does work on the light: work rate = -4.8
    expect(res.workRate).toBeCloseTo(-4.8, 10);
    // Balance: 1.6 - 6.4 - (-4.8) = 0
    expect(Math.abs(res.energyBalanceResidual)).toBeLessThan(1e-12);
  });

  test("Oblique incidence at phi = 30 deg, beta = 0.6", () => {
    const phiRad = (30 * Math.PI) / 180;
    const res = movingMirror(0.6, phiRad, { u: 1.0, c: 1.0, Am: 1.0 });
    expect(res.status).toBe("value");
    if (res.status !== "value") return;

    // cos(30 deg) = sqrt(3)/2 ≈ 0.866025
    // numerator = 1 - 2*0.6*0.866025 + 0.36 = 1.36 - 1.03923 = 0.32077
    // denom = 0.64
    // freqRatio ≈ 0.32077 / 0.64 ≈ 0.50120
    expect(res.frequencyRatio).toBeCloseTo(0.5012, 4);
    // cosPhiReflected ≈ +0.06923
    expect(res.cosPhiReflected).toBeCloseTo(0.06923, 4);
    expect(res.explanation).toBeDefined();
    expect(res.explanation).toContain("keeps a positive x-component");
    expect(Math.abs(res.energyBalanceResidual)).toBeLessThan(1e-12);
  });

  test("Mirror-frame description at normal incidence", () => {
    const ledger = mirrorFrameLedger(0.6, 0, { I: 1.0, Am: 1.0, c: 1.0 });
    expect(ledger.frame).toBe("mirror-rest");
    // In mirror frame, frequency factor q = gamma*(1 - beta) = 1.25 * 0.4 = 0.5
    expect(ledger.frequencyFactor).toBeCloseTo(0.5, 10);
    // Intensity' = q^2 * I = 0.25 * 1.0 = 0.25
    expect(ledger.intensityPrime).toBeCloseTo(0.25, 10);
    expect(ledger.incidentPower).toBeCloseTo(0.25, 10);
    expect(ledger.reflectedPower).toBeCloseTo(0.25, 10);
    expect(ledger.workRate).toBe(0);
    // Force in mirror frame = 2 * I' * Am / c = 0.5
    expect(ledger.forcePrime).toBeCloseTo(0.5, 10);
    expect(ledger.reproducedForceK).toBeCloseTo(0.5, 10);
  });

  test("Interception horizon: cos(phi) <= beta returns not-applicable", () => {
    // At beta = 0.6, arccos(0.6) ≈ 53.1301 deg
    // For phi = 60 deg, cos(60) = 0.5 < 0.6 -> not-applicable
    const phi60Rad = (60 * Math.PI) / 180;
    const res = movingMirror(0.6, phi60Rad);
    expect(res.status).toBe("not-applicable");
    if (res.status === "not-applicable") {
      expect(res.reason).toContain("never reaches the receding mirror");
    }
  });

  test("Stationary mirror limit (beta = 0)", () => {
    const phiRad = (45 * Math.PI) / 180;
    const res = movingMirror(0, phiRad, { u: 1.0, c: 1.0, Am: 1.0 });
    expect(res.status).toBe("value");
    if (res.status !== "value") return;

    expect(res.frequencyRatio).toBeCloseTo(1.0, 10);
    expect(res.cosPhiReflected).toBeCloseTo(-Math.cos(phiRad), 10);
    expect(res.workRate).toBe(0);
    expect(res.incidentPower).toBeCloseTo(res.reflectedPower, 10);
    expect(Math.abs(res.energyBalanceResidual)).toBeLessThan(1e-12);
  });

  test("Energy balance property test over 500 admissible parameter pairs", () => {
    // Seeded deterministic pseudo-random generator
    let seed = 42;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    let testedCount = 0;
    for (let i = 0; i < 1000 && testedCount < 500; i++) {
      const beta = -0.9 + rand() * 1.8; // beta in (-0.9, 0.9)
      const phiDeg = rand() * 85; // phi in (0, 85 deg)
      const phiRad = (phiDeg * Math.PI) / 180;
      const cosPhi = Math.cos(phiRad);

      if (cosPhi <= beta + 0.01) continue; // skip non-intercepting

      const res = movingMirror(beta, phiRad, {
        u: 0.5 + rand() * 5.0,
        c: 1.0,
        Am: 0.2 + rand() * 3.0,
      });

      if (res.status === "value") {
        expect(Math.abs(res.energyBalanceResidual)).toBeLessThan(1e-12);
        testedCount++;
      }
    }
    expect(testedCount).toBe(500);
  });

  test("Adversarial test: fixed-surface power formula breaks energy balance", () => {
    const beta = 0.6;
    const phiRad = 0;
    const u = 1.0;
    const c = 1.0;
    const Am = 1.0;

    const res = movingMirror(beta, phiRad, { u, c, Am });
    expect(res.status).toBe("value");
    if (res.status !== "value") return;

    // Plausible wrong formula: incident power evaluated without the (1 - beta) factor
    const naiveFixedSurfaceIncidentPower = u * c * Am; // 1.0 instead of 0.4
    const naiveResidual = naiveFixedSurfaceIncidentPower - res.reflectedPower - res.workRate;

    // 1.0 - 0.1 - 0.3 = 0.6 != 0
    expect(Math.abs(naiveResidual)).toBeGreaterThan(0.5);
    expect(naiveResidual).toBeCloseTo(0.6, 10);
  });
});

describe("SR-11 publishes its powers in watts, with the speed of light in m/s", () => {
  test("the accepted snapshot's powers carry c = 299 792 458 m/s, not c = 1", () => {
    // 1 J/m³ meeting a 1 m² mirror receding at 0.6c: the light arrives at (c − v) per second, so
    // 0.4c joules each second, 1.199 × 10⁸ W. Before the fix the snapshot published 0.4 "W".
    const snap = evaluateSr11({
      beta: 0.6,
      incidentAngleDeg: 0,
      incidentEnergyDensity: 1,
      mirrorArea: 1,
    });
    const read = (id: string) => {
      const r = snap.results.find((o) => o.quantityId === id);
      return r?.status === "value" && typeof r.value === "number" ? r.value : Number.NaN;
    };
    expect(read("incidentPower") / C_SI).toBeCloseTo(0.4, 12);
    expect(read("reflectedPower") / C_SI).toBeCloseTo(0.1, 12);
    expect(read("workRate") / C_SI).toBeCloseTo(0.3, 12);
    // The pressure does not involve c and stays 0.5 Pa.
    expect(read("radiationPressure")).toBeCloseTo(0.5, 12);
    expect(Math.abs(read("energyBalanceResidual")) / read("incidentPower")).toBeLessThan(1e-12);
  });
});
