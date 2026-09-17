import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { withinTolerance } from "../../units/tolerance.ts";
import { gammaMinusOne } from "./kinematics.ts";
import {
  C_SI,
  evaluateLedgers,
  evaluateMe01,
  evaluateMe02,
  initializeMassEnergyLedger,
  MASS_ENERGY_PRINTED_FACTOR_SCENARIO,
  naiveGammaMinusOne,
  PRINTED_FACTOR_WORDING,
  printedMassConversion,
  proxyEqualsLimit,
} from "./massEnergy.ts";

function val(result: { status: string; value?: number | Float64Array }): number {
  expect(result.status).toBe("value");
  return result.value as number;
}

describe("ME-02 coefficient owner", () => {
  test("at 0.6c, exact is 0.25 L, quadratic is 0.18 L, proxy is 1.3888889 L/c^2, and signs agree", () => {
    const plus = evaluateMe02({ beta: 0.6, emittedEnergy: 1, speedOfLight: 1 });
    const minus = evaluateMe02({ beta: -0.6, emittedEnergy: 1, speedOfLight: 1 });
    expect(val(plus.exactDifference)).toBeCloseTo(0.25, 12);
    expect(val(plus.quadraticApproximation)).toBeCloseTo(0.18, 12);
    expect(val(plus.finiteSpeedProxy)).toBeCloseTo(1.3888889, 6);
    expect(val(minus.exactDifference)).toBe(val(plus.exactDifference));
    expect(val(minus.quadraticApproximation)).toBe(val(plus.quadraticApproximation));
    expect(val(minus.finiteSpeedProxy)).toBe(val(plus.finiteSpeedProxy));
    expect(val(plus.quadraticDiscrepancy)).toBeCloseTo(0.28, 10);
  });

  test("proxy excess matches 3/4 beta^2 at small speed", () => {
    const at01 = evaluateMe02({ beta: 0.1, emittedEnergy: 1, speedOfLight: 1 });
    const at001 = evaluateMe02({ beta: 0.01, emittedEnergy: 1, speedOfLight: 1 });
    expect(val(at01.proxyExcess)).toBeCloseTo(0.0075631, 6);
    expect(0.75 * 0.01).toBeCloseTo(0.0075, 12);
    expect(val(at001.proxyExcess)).toBeCloseTo(7.50063e-5, 9);
    expect(0.75 * 0.0001).toBeCloseTo(7.5e-5, 12);
  });

  test("stable gamma-1 holds at tiny speeds; naive is a labeled diagnostic", () => {
    const tiny = evaluateMe02({ beta: 1e-6, emittedEnergy: 1, speedOfLight: 1 });
    const series = 0.5 * 1e-12 + (3 / 8) * 1e-24;
    expect(val(tiny.exactDifference)).toBeCloseTo(5.00000000000375e-13, 15);
    expect(
      withinTolerance(val(tiny.exactDifference), series, {
        relative: 1e-12,
        relativeTo: "reference",
      }).ok,
    ).toBe(true);
    const naiveTiny = naiveGammaMinusOne(1e-6);
    expect(naiveTiny.semanticKind).toBe("naive-gamma-minus-one");
    expect(val(naiveTiny)).toBeCloseTo(5.00044e-13, 5);
    const smaller = evaluateMe02({ beta: 1e-8, emittedEnergy: 1, speedOfLight: 1 });
    expect(val(smaller.exactDifference)).toBeCloseTo(5.0e-17, 2);
    expect(val(naiveGammaMinusOne(1e-8))).toBeCloseTo(2.220446e-16, 6);
    expect(smaller.naive.semanticKind).toBe("naive-gamma-minus-one");
    expect(smaller.naive.ownerId).toBe("massEnergy.naiveGammaMinusOne");
    expect(smaller.finiteSpeedProxy.ownerId).not.toBe(smaller.naive.ownerId);
  });

  test("stable result agrees with the series within 1e-12 relative for beta <= 1e-3", () => {
    for (const beta of [1e-3, 1e-4, 1e-5, 1e-6]) {
      const snap = evaluateMe02({ beta, emittedEnergy: 1, speedOfLight: 1 });
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

  test("v = 0 returns analytic-limit L/c^2 with no division", () => {
    const snap = evaluateMe02({ beta: 0, emittedEnergy: 4, speedOfLight: 2 });
    expect(snap.limitingCoefficient.status).toBe("analytic-limit");
    if (
      snap.limitingCoefficient.status === "analytic-limit" &&
      snap.limitingCoefficient.representation.kind === "coefficient"
    ) {
      expect(snap.limitingCoefficient.representation.kind).toBe("coefficient");
      expect(snap.limitingCoefficient.representation.value).toBe(1);
    }
    expect(snap.finiteSpeedProxy.status).toBe("not-applicable");
    expect(val(snap.inertialMassDecrease)).toBe(1);
    expect(val(snap.massChangeSigned)).toBe(-1);
    expect(val(snap.exactDifference)).toBe(0);
  });

  test("adversarial: the low-speed proxy is not the exact mass coefficient at 0.6c", () => {
    const snap = evaluateMe02({ beta: 0.6, emittedEnergy: 1, speedOfLight: 1 });
    expect(proxyEqualsLimit(snap)).toBe(false);
    expect(val(snap.finiteSpeedProxy)).toBeCloseTo(1.3888889, 6);
    if (
      snap.limitingCoefficient.status === "analytic-limit" &&
      snap.limitingCoefficient.representation.kind === "coefficient"
    ) {
      expect(snap.limitingCoefficient.representation.value).toBe(1);
    }
  });

  test("|beta| >= 1 is outside-domain", () => {
    const snap = evaluateMe02({ beta: 1, emittedEnergy: 1, speedOfLight: 1 });
    expect(snap.exactDifference.status).toBe("outside-domain");
    expect(snap.finiteSpeedProxy.status).toBe("outside-domain");
  });

  test("printed-factor readout uses the owner wording and does not mix sets", () => {
    const nine = printedMassConversion({ emittedEnergyErg: 9e20 });
    expect(nine.scenarioId).toBe(MASS_ENERGY_PRINTED_FACTOR_SCENARIO);
    expect(nine.printed.value).toBe(1);
    expect(nine.printed.constantSetId).toBe("einstein-1905-mass-energy-printed");
    expect(nine.modern.value).toBeCloseTo(1.0013851, 6);
    expect(nine.modern.constantSetId).toBe("modern-si-2019");
    expect(nine.comparison.wording).toBe(PRINTED_FACTOR_WORDING);
    expect(nine.comparison.ratioModernToPrinted).toBeCloseTo(1.00138505, 8);
    const small = printedMassConversion({ emittedEnergyErg: 1e7 });
    expect(small.printed.value).toBeCloseTo(1.1111111e-14, 6);
    expect(small.modern.value).toBeCloseTo(1.1126501e-14, 6);
    expect(nine.printed.constantSetId).not.toBe(nine.modern.constantSetId);
  });

  test("the owner source never initializes a body energy as M c^2", () => {
    const source = readFileSync(fileURLToPath(new URL("./massEnergy.ts", import.meta.url)), "utf8");
    const start = source.indexOf("export function evaluateMe02");
    const end = source.indexOf("export function printedMassConversion");
    const me02 = source.slice(start, end);
    expect(me02.includes("M*c*c")).toBe(false);
    expect(me02.includes("M * c * c")).toBe(false);
    expect(me02.includes("Mc^2")).toBe(false);
    expect(me02.includes("gamma*M")).toBe(false);
    expect(me02.includes("gamma * M")).toBe(false);
    expect(me02.includes("restEnergy")).toBe(false);
  });

  test("paper 4 printed glyph for the Lorentz factor is UNKNOWN until a facsimile is pinned", () => {
    const source = readFileSync(fileURLToPath(new URL("./massEnergy.ts", import.meta.url)), "utf8");
    expect(source.includes("UNKNOWN")).toBe(true);
    expect(source.includes("facsimile")).toBe(true);
    const gmo = gammaMinusOne(0.6);
    expect(gmo.status).toBe("value");
  });

  test("modern SI c is the exact defined speed of light, not a measured 3e8", () => {
    expect(C_SI).toBe(299792458);
  });

  describe("circularity ban on mass-energy ledger", () => {
    test("the mass-energy ledger must NEVER initialise a body's energy with Mc^2 or gamma Mc^2 (negative tests)", () => {
      // 1. Direct string attempt with Mc^2 must throw circularity violation
      expect(() => initializeMassEnergyLedger({ restEnergyBefore: "Mc^2" })).toThrow(
        "Circularity violation: the mass-energy ledger must NEVER initialise a body's energy with Mc^2 or gamma Mc^2.",
      );
      expect(() => initializeMassEnergyLedger({ restEnergyBefore: "M*c^2" })).toThrow(
        "Circularity violation",
      );
      expect(() => initializeMassEnergyLedger({ restEnergyBefore: "M c²" })).toThrow(
        "Circularity violation",
      );

      // 2. gamma Mc^2 attempt must throw
      expect(() => initializeMassEnergyLedger({ movingEnergyBefore: "gamma*Mc^2" })).toThrow(
        "Circularity violation",
      );
      expect(() => initializeMassEnergyLedger({ movingEnergyBefore: "γMc²" })).toThrow(
        "Circularity violation",
      );

      // 3. Structured numericFrom / formula objects must throw
      expect(() =>
        initializeMassEnergyLedger({ restEnergyBefore: { numericFrom: "mc2" } }),
      ).toThrow("Circularity violation");
      expect(() =>
        initializeMassEnergyLedger({ restEnergyBefore: { formula: "E₀ = Mc²" } }),
      ).toThrow("Circularity violation");
      expect(() =>
        initializeMassEnergyLedger({ movingEnergyBefore: { numericFrom: "gamma-mc2" } }),
      ).toThrow("Circularity violation");

      // 4. evaluateLedgers rejects initial body energy with Mc^2
      expect(() => evaluateLedgers(1.0, 0.6, 0, "Mc^2")).toThrow("Circularity violation");

      // 5. evaluateMe01 rejects initial body energy with Mc^2
      expect(() =>
        evaluateMe01({
          emittedEnergyRestFrame: 1.0,
          frameSpeed: 0.6,
          emissionAngle: 0,
          initialBodyEnergy: "Mc^2",
        }),
      ).toThrow("Circularity violation");

      // 6. Valid ledger initialization retains symbolic status without numeric Mc^2 seeding
      const validLedger = initializeMassEnergyLedger();
      expect(validLedger.restBodyBefore.status).toBe("symbolic");
      expect(validLedger.restBodyAfter.status).toBe("symbolic");
      expect(validLedger.movingBodyBefore.status).toBe("symbolic");
      expect(validLedger.movingBodyAfter.status).toBe("symbolic");
    });
  });

  describe("adversarial fixture: low-speed proxy is not the exact mass coefficient at every speed", () => {
    test("low-speed proxy fails as exact mass coefficient at 0.6c and all finite speeds", () => {
      // True physics: finiteSpeedProxy = (2 * L * (gamma - 1)) / (beta^2 * c^2)
      // Series: (L / c^2) * (1 + (3/4)beta^2 + (5/8)beta^4 + ...)
      // Limiting mass coefficient: L / c^2
      // Naive claim: finiteSpeedProxy === limitingCoefficient at all speeds
      const snap60 = evaluateMe02({ beta: 0.6, emittedEnergy: 1, speedOfLight: 1 });
      expect(proxyEqualsLimit(snap60)).toBe(false);
      expect(val(snap60.finiteSpeedProxy)).toBeCloseTo(1.3888889, 6);
      expect(val(snap60.proxyExcess)).toBeCloseTo(0.3888889, 6);

      // At 0.1c, excess is still positive (~0.00756 > 0)
      const snap10 = evaluateMe02({ beta: 0.1, emittedEnergy: 1, speedOfLight: 1 });
      expect(proxyEqualsLimit(snap10)).toBe(false);
      expect(val(snap10.proxyExcess)).toBeGreaterThan(0.0075);

      // Adversarial claim asserting proxy equals limit at finite speed MUST FAIL
      const proxyEqualsExactMass = (beta: number) => {
        const snap = evaluateMe02({ beta, emittedEnergy: 1, speedOfLight: 1 });
        if (Math.abs(val(snap.finiteSpeedProxy) - 1.0) > 1e-6) {
          throw new Error(
            `Adversarial fixture failed as expected: proxy ${val(snap.finiteSpeedProxy)} exceeds exact mass coefficient 1.0 at beta = ${beta}.`,
          );
        }
      };

      expect(() => proxyEqualsExactMass(0.6)).toThrow(
        "Adversarial fixture failed as expected: proxy",
      );
      expect(() => proxyEqualsExactMass(0.1)).toThrow(
        "Adversarial fixture failed as expected: proxy",
      );
    });
  });
});
