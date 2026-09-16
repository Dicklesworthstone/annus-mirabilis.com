import { describe, expect, test } from "bun:test";
import {
  alignedBoost,
  composeBoosts,
  composeCollinear,
  composedSpeedShortfall,
  composePrinted,
  compositionIncrement,
  generalBoost,
  speedOfLightMetresPerSecond,
} from "../../physics/reference/kinematics.ts";

const c = speedOfLightMetresPerSecond();

describe("composition", () => {
  test("collinear 0.6 ⊕ 0.6 is 15/17 and 0.99 ⊕ 0.99 is 0.9999495", () => {
    const a = composeCollinear(0.6, 0.6);
    const b = composeCollinear(0.99, 0.99);
    expect(a.status).toBe("value");
    expect(b.status).toBe("value");
    if (a.status === "value") expect(a.value).toBeCloseTo(15 / 17, 12);
    if (b.status === "value") expect(b.value).toBeCloseTo(0.9999495, 7);
  });

  test("shortfall at 0.99 ⊕ 0.99 is 1/19801; naive 1 - U misses 1e-12 relative", () => {
    const exact = 1 / 19801;
    const s = composedSpeedShortfall(0.99, 0.99);
    expect(s.status).toBe("value");
    if (s.status === "value") {
      expect(Math.abs(s.value / exact - 1)).toBeLessThan(1e-12);
    }
    const u = composeCollinear(0.99, 0.99);
    expect(u.status).toBe("value");
    if (u.status === "value" && s.status === "value") {
      const naive = 1 - u.value;
      const naiveRel = Math.abs(naive / exact - 1);
      const helperRel = Math.abs(s.value / exact - 1);
      expect(helperRel).toBeLessThan(1e-12);
      expect(naiveRel).toBeGreaterThan(helperRel);
    }
  });

  test("printed 90 degree formula at 0.6c gives 0.768375 c", () => {
    const u = composePrinted(0.6, 0.6, Math.PI / 2, 1);
    expect(u.status).toBe("value");
    if (u.status === "value") expect(u.value).toBeCloseTo(0.768375, 6);
  });

  test("perpendicular 0.6c x then y: gamma 1.5625, speed 0.768375c, Wigner 12.68038 deg", () => {
    const first = alignedBoost(0.6, 1);
    const second = generalBoost({ bx: 0, by: 0.6, bz: 0 }, 1);
    expect(first.status).toBe("value");
    expect(second.status).toBe("value");
    if (first.status !== "value" || second.status !== "value") return;
    const composed = composeBoosts(first.value, second.value);
    expect(composed.status).toBe("value");
    if (composed.status !== "value") return;
    expect(composed.value.boost.gamma).toBeCloseTo(1.5625, 12);
    expect(composed.value.resultantSpeed).toBeCloseTo(0.768375, 6);
    const deg = (composed.value.wignerAngle * 180) / Math.PI;
    expect(Math.abs(deg)).toBeCloseTo(12.68038, 4);
    const parallel = generalBoost(composed.value.boost.beta, 1);
    expect(parallel.status).toBe("value");
    if (parallel.status === "value") {
      let diff = 0;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          diff +=
            ((composed.value.product[i]?.[j] ?? 0) - (parallel.value.matrix[i]?.[j] ?? 0)) ** 2;
        }
      }
      expect(diff).toBeGreaterThan(1e-8);
    }
  });

  test("Fizeau increment 3.08676358 m/s; naive subtraction misses 1e-10 relative", () => {
    const n = 1.333;
    const u = c / n;
    const w = 7.06;
    const inc = compositionIncrement(u, w, c);
    expect(inc.status).toBe("value");
    if (inc.status !== "value") return;
    expect(Math.abs(inc.value / 3.08676358 - 1)).toBeLessThan(1e-8);
    const fresnel = (1 - 1 / (n * n)) * w;
    expect(Math.abs(fresnel / 3.08676363 - 1)).toBeLessThan(1e-8);
    const rel = (inc.value - fresnel) / fresnel;
    expect(Math.abs(rel / -1.767e-8 - 1)).toBeLessThan(1e-2);
    const composedBeta = composeCollinear(u / c, w / c);
    expect(composedBeta.status).toBe("value");
    if (composedBeta.status === "value") {
      const naive = composedBeta.value * c - u;
      expect(Math.abs(naive - inc.value) / inc.value).toBeGreaterThan(1e-10);
    }
  });
});
