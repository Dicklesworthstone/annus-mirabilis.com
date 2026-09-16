import { describe, expect, it } from "bun:test";
import {
  evaluateLedgers,
  evaluateMe01,
  evaluatePulseEnergies,
  evaluateSubtraction,
} from "./massEnergy.ts";

describe("ME-01 reference physics owner (massEnergy.ts)", () => {
  const TOLERANCE = 1e-12;

  function relativeError(actual: number, expected: number): number {
    return Math.abs((actual - expected) / expected);
  }

  function numVal(res: { status: string; value?: number | Float64Array }): number {
    if (res.status === "value" && typeof res.value === "number") return res.value;
    throw new Error(`Expected scalar numeric value, got ${res.status}`);
  }

  describe("Pulse fixtures at beta = 0.6 (gamma = 1.25)", () => {
    it("phi = 0 deg: pulse1 = 0.25L, pulse2 = 1.0L, sum = 1.25L", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.6,
        emissionAngle: 0,
        angleUnit: "degrees",
      });

      expect(snap.pulse1Moving.status).toBe("value");
      expect(snap.pulse2Moving.status).toBe("value");
      expect(snap.pulseSumMoving.status).toBe("value");

      expect(relativeError(numVal(snap.pulse1Moving), 0.25)).toBeLessThan(TOLERANCE);
      expect(relativeError(numVal(snap.pulse2Moving), 1.0)).toBeLessThan(TOLERANCE);
      expect(relativeError(numVal(snap.pulseSumMoving), 1.25)).toBeLessThan(TOLERANCE);
    });

    it("phi = 60 deg: pulse1 = 0.4375L, pulse2 = 0.8125L, sum = 1.25L", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.6,
        emissionAngle: 60,
        angleUnit: "degrees",
      });

      expect(snap.pulse1Moving.status).toBe("value");
      expect(snap.pulse2Moving.status).toBe("value");
      expect(snap.pulseSumMoving.status).toBe("value");

      expect(relativeError(numVal(snap.pulse1Moving), 0.4375)).toBeLessThan(TOLERANCE);
      expect(relativeError(numVal(snap.pulse2Moving), 0.8125)).toBeLessThan(TOLERANCE);
      expect(relativeError(numVal(snap.pulseSumMoving), 1.25)).toBeLessThan(TOLERANCE);
    });

    it("phi = 90 deg: pulse1 = 0.625L, pulse2 = 0.625L, sum = 1.25L", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.6,
        emissionAngle: 90,
        angleUnit: "degrees",
      });

      expect(snap.pulse1Moving.status).toBe("value");
      expect(snap.pulse2Moving.status).toBe("value");
      expect(snap.pulseSumMoving.status).toBe("value");

      expect(relativeError(numVal(snap.pulse1Moving), 0.625)).toBeLessThan(TOLERANCE);
      expect(relativeError(numVal(snap.pulse2Moving), 0.625)).toBeLessThan(TOLERANCE);
      expect(relativeError(numVal(snap.pulseSumMoving), 1.25)).toBeLessThan(TOLERANCE);
    });

    it("phi = 2 rad: pulse1 = 0.781055L, pulse2 = 0.468945L, sum = 1.25L", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.6,
        emissionAngle: 2,
        angleUnit: "radians",
      });

      expect(snap.pulse1Moving.status).toBe("value");
      expect(snap.pulse2Moving.status).toBe("value");
      expect(snap.pulseSumMoving.status).toBe("value");

      const expected1 = 0.5 * 1.25 * (1 - 0.6 * Math.cos(2));
      const expected2 = 0.5 * 1.25 * (1 + 0.6 * Math.cos(2));
      expect(relativeError(numVal(snap.pulse1Moving), expected1)).toBeLessThan(TOLERANCE);
      expect(relativeError(numVal(snap.pulse2Moving), expected2)).toBeLessThan(TOLERANCE);
      expect(relativeError(numVal(snap.pulseSumMoving), 1.25)).toBeLessThan(TOLERANCE);
    });
  });

  describe("Subtraction (The Move) and Balances", () => {
    it("calculates subtraction = 0.25L at beta = 0.6", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.6,
        emissionAngle: 0,
      });

      expect(snap.subtractionDifference.status).toBe("value");
      expect(relativeError(numVal(snap.subtractionDifference), 0.25)).toBeLessThan(TOLERANCE);
    });

    it("calculates subtraction = 0 and equal pulses at beta = 0", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.0,
        emissionAngle: 45,
      });

      expect(snap.subtractionDifference.status).toBe("value");
      expect(snap.pulse1Moving.status).toBe("value");
      expect(snap.pulse2Moving.status).toBe("value");
      expect(snap.pulseSumMoving.status).toBe("value");

      expect(numVal(snap.subtractionDifference)).toBe(0);
      expect(numVal(snap.pulse1Moving)).toBe(0.5);
      expect(numVal(snap.pulse2Moving)).toBe(0.5);
      expect(numVal(snap.pulseSumMoving)).toBe(1.0);
    });

    it("rest and moving balances contain correct light energies", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 2.0,
        frameSpeed: 0.6,
        emissionAngle: 30,
      });

      expect(snap.restBalanceLight.status).toBe("value");
      expect(snap.movingBalanceLight.status).toBe("value");

      expect(numVal(snap.restBalanceLight)).toBe(2.0);
      expect(relativeError(numVal(snap.movingBalanceLight), 2.5)).toBeLessThan(TOLERANCE);
    });
  });

  describe("Doppler frequency ratio and pulse energy ratio identity", () => {
    it("energy ratio equals Doppler frequency ratio within 10^-12 for sample beta and phi", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.37,
        emissionAngle: 1.1,
        angleUnit: "radians",
      });

      expect(snap.pulseEnergyRatio.status).toBe("value");
      expect(snap.dopplerFrequencyRatio.status).toBe("value");

      const cosPhi = Math.cos(1.1);
      const expectedRatio = (1 - 0.37 * cosPhi) / (1 + 0.37 * cosPhi);
      expect(relativeError(numVal(snap.pulseEnergyRatio), expectedRatio)).toBeLessThan(TOLERANCE);
      expect(relativeError(numVal(snap.dopplerFrequencyRatio), expectedRatio)).toBeLessThan(
        TOLERANCE,
      );
      expect(
        Math.abs(numVal(snap.pulseEnergyRatio) - numVal(snap.dopplerFrequencyRatio)),
      ).toBeLessThan(TOLERANCE);
    });
  });

  describe("Non-circularity doctrine", () => {
    it("body internal energies are symbolic representations and never initialized as numbers or Mc^2", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.6,
        emissionAngle: 0,
      });

      expect(snap.restBodyBefore.status).toBe("symbolic");
      expect(snap.restBodyAfter.status).toBe("symbolic");
      expect(snap.movingBodyBefore.status).toBe("symbolic");
      expect(snap.movingBodyAfter.status).toBe("symbolic");

      if (
        snap.restBodyBefore.status === "symbolic" &&
        snap.restBodyAfter.status === "symbolic" &&
        snap.movingBodyBefore.status === "symbolic" &&
        snap.movingBodyAfter.status === "symbolic"
      ) {
        expect(snap.restBodyBefore.expressionRef).toBe("symbol:E₀");
        expect(snap.restBodyAfter.expressionRef).toBe("symbol:E₁");
        expect(snap.movingBodyBefore.expressionRef).toBe("symbol:H₀");
        expect(snap.movingBodyAfter.expressionRef).toBe("symbol:H₁");
      }
    });
  });

  describe("Premise probe", () => {
    it("premise unchanged yields value for kinetic energy difference", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.6,
        emissionAngle: 0,
        premise: "unchanged",
      });

      expect(snap.kineticEnergyDifference.status).toBe("value");
      expect(relativeError(numVal(snap.kineticEnergyDifference), 0.25)).toBeLessThan(TOLERANCE);
    });

    it("premise relaxed yields underdetermined status with explanation", () => {
      const snap = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 0.6,
        emissionAngle: 0,
        premise: "relaxed",
      });

      expect(snap.kineticEnergyDifference.status).toBe("underdetermined");
      if (snap.kineticEnergyDifference.status === "underdetermined") {
        expect(snap.kineticEnergyDifference.compatibleFamily).toContain("kinetic-difference");
        expect(snap.kineticEnergyDifference.neededInformation).toContain(
          "additive-constant-invariance-under-emission",
        );
      }
    });
  });

  describe("Domain Refusals", () => {
    it("refuses |beta| >= 1 with outside-domain", () => {
      const snapSuperluminal = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 1.0,
        emissionAngle: 0,
      });
      expect(snapSuperluminal.pulseSumMoving.status).toBe("outside-domain");
      if (snapSuperluminal.pulseSumMoving.status === "outside-domain") {
        expect(snapSuperluminal.pulseSumMoving.condition).toBe("|beta| < 1");
        expect(snapSuperluminal.pulseSumMoving.reason).toContain("speed of light");
      }

      const snapExcess = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: 1.2,
        emissionAngle: 0,
      });
      expect(snapExcess.pulseSumMoving.status).toBe("outside-domain");

      const snapNegative = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: -1.05,
        emissionAngle: 0,
      });
      expect(snapNegative.pulseSumMoving.status).toBe("outside-domain");
    });

    it("refuses L <= 0 with outside-domain", () => {
      const snapZero = evaluateMe01({
        emittedEnergyRestFrame: 0,
        frameSpeed: 0.5,
        emissionAngle: 0,
      });
      expect(snapZero.pulseSumMoving.status).toBe("outside-domain");
      if (snapZero.pulseSumMoving.status === "outside-domain") {
        expect(snapZero.pulseSumMoving.condition).toBe("L > 0");
      }

      const snapNeg = evaluateMe01({
        emittedEnergyRestFrame: -5,
        frameSpeed: 0.5,
        emissionAngle: 0,
      });
      expect(snapNeg.pulseSumMoving.status).toBe("outside-domain");
    });

    it("refuses nonfinite inputs with outside-domain", () => {
      const snapNan = evaluateMe01({
        emittedEnergyRestFrame: Number.NaN,
        frameSpeed: 0.5,
        emissionAngle: 0,
      });
      expect(snapNan.pulseSumMoving.status).toBe("outside-domain");

      const snapInf = evaluateMe01({
        emittedEnergyRestFrame: 1.0,
        frameSpeed: Number.POSITIVE_INFINITY,
        emissionAngle: 0,
      });
      expect(snapInf.pulseSumMoving.status).toBe("outside-domain");
    });
  });

  describe("Kernel functions directly", () => {
    it("evaluatePulseEnergies computes exact moving pulse energies", () => {
      const res = evaluatePulseEnergies(1.0, 0.6, 0);
      expect(relativeError(res.lorentzFactor, 1.25)).toBeLessThan(TOLERANCE);
      expect(relativeError(res.pulse1Moving, 0.25)).toBeLessThan(TOLERANCE);
      expect(relativeError(res.pulse2Moving, 1.0)).toBeLessThan(TOLERANCE);
      expect(relativeError(res.pulseSumMoving, 1.25)).toBeLessThan(TOLERANCE);
    });

    it("evaluateLedgers computes balances", () => {
      const res = evaluateLedgers(1.0, 0.6, 0);
      expect(res.restBalanceLight).toBe(1.0);
      expect(relativeError(res.movingBalanceLight, 1.25)).toBeLessThan(TOLERANCE);
    });

    it("evaluateSubtraction computes difference", () => {
      const resUnchanged = evaluateSubtraction(1.0, 0.6, 0, "unchanged");
      expect(relativeError(resUnchanged.subtractionValue, 0.25)).toBeLessThan(TOLERANCE);
      expect(resUnchanged.kineticDifference).toBe(resUnchanged.subtractionValue);

      const resRelaxed = evaluateSubtraction(1.0, 0.6, 0, "relaxed");
      expect(resRelaxed.kineticDifference).toBeNull();
    });
  });
});
