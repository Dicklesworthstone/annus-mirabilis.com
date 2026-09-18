import { describe, expect, it } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import {
  evaluateMe02,
  exactDifference,
  finiteSpeedProxy,
  limitingCoefficient,
  naiveGammaMinusOne,
  proxyEqualsLimit,
  quadraticApproximation,
} from "./massEnergy.ts";

describe("massEnergy.coefficient: exact difference, quadratic approximation, proxy, and limit", () => {
  function val(res: { status: string; value?: number | Float64Array }): number {
    expect(res.status).toBe("value");
    return res.value as number;
  }

  function coeffVal(res: {
    status: string;
    representation?: { kind: string; value: number };
  }): number {
    expect(res.status).toBe("analytic-limit");
    expect(res.representation?.kind).toBe("coefficient");
    return res.representation?.value as number;
  }

  describe("0.6c fixture (exact 0.25L, quadratic 0.18L, proxy 1.388889 L/c^2)", () => {
    it("matches all four quantities at beta = 0.6 with c = 1", () => {
      const snap = evaluateMe02({ beta: 0.6, emittedEnergy: 1.0, speedOfLight: 1.0 });

      expect(val(snap.exactDifference)).toBeCloseTo(0.25, 12);
      expect(val(snap.quadraticApproximation)).toBeCloseTo(0.18, 12);
      expect(val(snap.finiteSpeedProxy)).toBeCloseTo(1.3888889, 6);
      expect(coeffVal(snap.limitingCoefficient)).toBeCloseTo(1.0, 12);

      // Discrepancy (exact - quadratic) / exact = (0.25 - 0.18) / 0.25 = 0.07 / 0.25 = 0.28 (28%)
      expect(val(snap.quadraticDiscrepancy)).toBeCloseTo(0.28, 12);
    });

    it("standalone functions match evaluateMe02 output", () => {
      const exact = exactDifference(1.0, 0.6, 1.0);
      const quad = quadraticApproximation(1.0, 0.6, 1.0);
      const proxy = finiteSpeedProxy(1.0, 0.6, 1.0);
      const limit = limitingCoefficient(1.0, 1.0);

      expect(val(exact)).toBeCloseTo(0.25, 12);
      expect(val(quad)).toBeCloseTo(0.18, 12);
      expect(val(proxy)).toBeCloseTo(1.3888889, 6);
      expect(coeffVal(limit)).toBeCloseTo(1.0, 12);
    });
  });

  describe("proxy excess at small speed (3/4 beta^2)", () => {
    it("at beta = 0.1: proxy excess is 7.5631e-3 vs 3/4 beta^2 = 7.5e-3", () => {
      const snap = evaluateMe02({ beta: 0.1, emittedEnergy: 1.0, speedOfLight: 1.0 });
      expect(val(snap.proxyExcess)).toBeCloseTo(0.0075631, 6);
      const leadingOrder = 0.75 * 0.1 * 0.1;
      expect(leadingOrder).toBeCloseTo(0.0075, 12);
      expect(val(snap.proxyExcess)).toBeGreaterThan(leadingOrder);
    });

    it("at beta = 0.01: proxy excess is 7.50063e-5 vs 3/4 beta^2 = 7.5e-5", () => {
      const snap = evaluateMe02({ beta: 0.01, emittedEnergy: 1.0, speedOfLight: 1.0 });
      expect(val(snap.proxyExcess)).toBeCloseTo(7.50063e-5, 9);
      const leadingOrder = 0.75 * 0.01 * 0.01;
      expect(leadingOrder).toBeCloseTo(7.5e-5, 12);
      expect(val(snap.proxyExcess)).toBeGreaterThan(leadingOrder);
    });
  });

  describe("stable gamma - 1 at tiny speeds vs series and naive form", () => {
    it("at beta = 1e-6: stable exactDifference matches 5.00000000000375e-13 where naive gives 5.00044e-13", () => {
      const snap = evaluateMe02({ beta: 1e-6, emittedEnergy: 1.0, speedOfLight: 1.0 });
      const series = 0.5 * 1e-12 + (3 / 8) * 1e-24;

      expect(val(snap.exactDifference)).toBeCloseTo(5.00000000000375e-13, 15);
      expect(
        withinTolerance(val(snap.exactDifference), series, {
          relative: 1e-12,
          relativeTo: "reference",
        }).ok,
      ).toBe(true);

      const naive = naiveGammaMinusOne(1e-6);
      expect(naive.semanticKind).toBe("naive-gamma-minus-one");
      expect(val(naive)).toBeCloseTo(5.00044e-13, 5);
      // Naive has noticeable floating round-off cancellation
      expect(Math.abs(val(naive) - series) / series).toBeGreaterThan(1e-5);
    });

    it("at beta = 1e-8: stable exactDifference gives 5.0e-17 where naive gives ~2.2e-16", () => {
      const snap = evaluateMe02({ beta: 1e-8, emittedEnergy: 1.0, speedOfLight: 1.0 });
      expect(val(snap.exactDifference)).toBeCloseTo(5.0e-17, 2);

      const naive = naiveGammaMinusOne(1e-8);
      expect(val(naive)).toBeCloseTo(2.220446e-16, 6);
      // Naive error exceeds 300%
      const naiveError = Math.abs(val(naive) - 5e-17) / 5e-17;
      expect(naiveError).toBeGreaterThan(3.0);
    });

    it("stable result agrees with Taylor series within 1e-12 relative for beta <= 1e-3", () => {
      for (const beta of [1e-3, 1e-4, 1e-5, 1e-6]) {
        const snap = evaluateMe02({ beta, emittedEnergy: 1.0, speedOfLight: 1.0 });
        const b2 = beta * beta;
        const series = 0.5 * b2 + (3 / 8) * b2 * b2;
        expect(
          withinTolerance(val(snap.exactDifference), series, {
            relative: 1e-12,
            relativeTo: "reference",
          }).ok,
        ).toBe(true);
      }
    });
  });

  describe("analytic limit at v = 0 with no 0/0 division", () => {
    it("returns analytic-limit L/c^2 with tagged representation", () => {
      const snap = evaluateMe02({ beta: 0, emittedEnergy: 4.0, speedOfLight: 2.0 });

      expect(snap.limitingCoefficient.status).toBe("analytic-limit");
      if (snap.limitingCoefficient.status === "analytic-limit") {
        expect(snap.limitingCoefficient.representation.kind).toBe("coefficient");
        if (snap.limitingCoefficient.representation.kind === "coefficient") {
          expect(snap.limitingCoefficient.representation.value).toBe(1.0); // 4 / 2^2 = 1
        }
      }

      // finiteSpeedProxy is not applicable at v = 0
      expect(snap.finiteSpeedProxy.status).toBe("not-applicable");
      expect(snap.proxyExcess.status).toBe("not-applicable");
      expect(snap.quadraticDiscrepancy.status).toBe("not-applicable");

      // Masses
      expect(val(snap.inertialMassDecrease)).toBe(1.0);
      expect(val(snap.massChangeSigned)).toBe(-1.0);
      expect(val(snap.exactDifference)).toBe(0);
      expect(val(snap.quadraticApproximation)).toBe(0);
    });

    it("limitingCoefficient standalone returns analytic-limit", () => {
      const lim = limitingCoefficient(10.0, 1.0);
      expect(lim.status).toBe("analytic-limit");
      if (lim.status === "analytic-limit" && lim.representation.kind === "coefficient") {
        expect(lim.representation.value).toBe(10.0);
      }
    });
  });

  describe("adversarial: low-speed proxy is NOT exact at 0.6c", () => {
    it("fails exact equality: proxy differs from limit by 38.89%", () => {
      const snap = evaluateMe02({ beta: 0.6, emittedEnergy: 1.0, speedOfLight: 1.0 });
      expect(proxyEqualsLimit(snap)).toBe(false);
      expect(val(snap.finiteSpeedProxy)).toBeCloseTo(1.3888889, 6);
      expect(coeffVal(snap.limitingCoefficient)).toBe(1.0);
      expect(val(snap.proxyExcess)).toBeCloseTo(0.3888889, 6);
    });
  });
});
