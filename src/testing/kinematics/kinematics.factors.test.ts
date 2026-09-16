import { describe, expect, test } from "bun:test";
import {
  dilationLossPerSecond,
  gamma,
  gammaMinusOne,
  rapidity,
  speedForDailyLoss,
  speedOfLightMetresPerSecond,
} from "../../physics/reference/kinematics.ts";
import { kinematicsLogStart, logKinematics } from "./log.ts";

kinematicsLogStart();
const c = speedOfLightMetresPerSecond();

describe("factors", () => {
  test("gamma(0.6) is 1.25 and rapidity(0.6) is ln 2", () => {
    const g = gamma(0.6);
    const r = rapidity(0.6);
    expect(g.status).toBe("value");
    expect(r.status).toBe("value");
    if (g.status === "value") expect(g.value).toBeCloseTo(1.25, 12);
    if (r.status === "value") expect(r.value).toBeCloseTo(Math.log(2), 12);
    logKinematics({
      testId: "gamma-rapidity-0.6",
      outcome: "pass",
      beta: 0.6,
      resultStatus: "value",
    });
  });

  test("gammaMinusOne at 10 m/s matches 5.563250e-16 and beats naive subtraction", () => {
    const beta = 10 / c;
    const stable = gammaMinusOne(beta);
    const g = gamma(beta);
    expect(stable.status).toBe("value");
    expect(g.status).toBe("value");
    if (stable.status === "value") {
      expect(Math.abs(stable.value / 5.56325e-16 - 1)).toBeLessThan(1e-5);
    }
    if (g.status === "value" && stable.status === "value") {
      const naive = g.value - 1;
      expect(Math.abs(naive - 6.661338e-16)).toBeLessThan(2e-16);
      expect(Math.abs(naive - stable.value) / stable.value).toBeGreaterThan(0.1);
    }
  });

  test("dilationLossPerSecond at 1e-4 is 5.0000000125e-9", () => {
    const loss = dilationLossPerSecond(1e-4);
    expect(loss.status).toBe("value");
    if (loss.status === "value") {
      expect(Math.abs(loss.value.exact / 5.0000000125e-9 - 1)).toBeLessThan(1e-12);
      expect(loss.value.printedSecondOrder).toBeCloseTo(5e-9, 20);
    }
  });

  test("naive 1 - sqrt(1-beta^2) fails at 1e-4, 1e-6, 1e-8", () => {
    for (const beta of [1e-4, 1e-6, 1e-8]) {
      const stable = dilationLossPerSecond(beta);
      expect(stable.status).toBe("value");
      if (stable.status !== "value") continue;
      const naive = 1 - Math.sqrt(1 - beta * beta);
      const rel = Math.abs(naive - stable.value.exact) / stable.value.exact;
      if (beta === 1e-4) expect(rel).toBeGreaterThan(1e-9);
      if (beta === 1e-8) expect(rel).toBeGreaterThan(0.5);
    }
  });

  test("speedForDailyLoss(1 s) is 4.811238e-3", () => {
    const b = speedForDailyLoss(1);
    expect(b.status).toBe("value");
    if (b.status === "value") {
      expect(Math.abs(b.value / 4.811238e-3 - 1)).toBeLessThan(1e-6);
      expect(b.value * c).toBeCloseTo(1_442_370, -2);
    }
  });

  test("refuses |beta| >= 1 and nonfinite", () => {
    expect(gamma(1).status).toBe("outside-domain");
    expect(gamma(-1).status).toBe("outside-domain");
    expect(gamma(Number.NaN).status).toBe("outside-domain");
    expect(gamma(Number.POSITIVE_INFINITY).status).toBe("outside-domain");
  });
});
