import { describe, expect, it } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import { pulseEnergies } from "./massEnergy.ts";

describe("massEnergy.pulses: pulse energies, angle sweep, and Doppler ratio", () => {
  const TOLERANCE = 1e-12;

  function numVal(res: { status: string; value?: number | Float64Array }): number {
    expect(res.status).toBe("value");
    return res.value as number;
  }

  describe("named angle fixtures at beta = 0.6 (gamma = 1.25)", () => {
    const L = 1.0;
    const beta = 0.6;

    it("phi = 0: pulse1 = 0.25L, pulse2 = 1.0L, sum = 1.25L", () => {
      const res = pulseEnergies(L, beta, 0);
      expect(res.status).toBe("value");
      expect(numVal(res.pulse1)).toBeCloseTo(0.25 * L, 12);
      expect(numVal(res.pulse2)).toBeCloseTo(1.0 * L, 12);
      expect(numVal(res.pulseSum)).toBeCloseTo(1.25 * L, 12);
      expect(res.pulse1Moving).toBeCloseTo(0.25 * L, 12);
      expect(res.pulse2Moving).toBeCloseTo(1.0 * L, 12);
      expect(res.pulseSumMoving).toBeCloseTo(1.25 * L, 12);
      expect(res.lorentzFactor).toBeCloseTo(1.25, 12);
    });

    it("phi = 60 deg (pi/3 rad): pulse1 = 0.4375L, pulse2 = 0.8125L, sum = 1.25L", () => {
      const resRad = pulseEnergies(L, beta, Math.PI / 3);
      const resDeg = pulseEnergies(L, beta, 60, "degrees");

      for (const res of [resRad, resDeg]) {
        expect(res.status).toBe("value");
        expect(numVal(res.pulse1)).toBeCloseTo(0.4375 * L, 12);
        expect(numVal(res.pulse2)).toBeCloseTo(0.8125 * L, 12);
        expect(numVal(res.pulseSum)).toBeCloseTo(1.25 * L, 12);
      }
    });

    it("phi = 90 deg (pi/2 rad): pulse1 = 0.625L, pulse2 = 0.625L, sum = 1.25L", () => {
      const resRad = pulseEnergies(L, beta, Math.PI / 2);
      const resDeg = pulseEnergies(L, beta, 90, "degrees");

      for (const res of [resRad, resDeg]) {
        expect(res.status).toBe("value");
        expect(numVal(res.pulse1)).toBeCloseTo(0.625 * L, 12);
        expect(numVal(res.pulse2)).toBeCloseTo(0.625 * L, 12);
        expect(numVal(res.pulseSum)).toBeCloseTo(1.25 * L, 12);
      }
    });

    it("phi = 2 rad: pulse1 = 0.781055L, pulse2 = 0.468945L, sum = 1.25L", () => {
      const res = pulseEnergies(L, beta, 2);
      expect(res.status).toBe("value");

      const expected1 = 0.5 * 1.25 * (1 - 0.6 * Math.cos(2)) * L;
      const expected2 = 0.5 * 1.25 * (1 + 0.6 * Math.cos(2)) * L;

      expect(numVal(res.pulse1)).toBeCloseTo(expected1, 12);
      expect(numVal(res.pulse2)).toBeCloseTo(expected2, 12);
      expect(numVal(res.pulseSum)).toBeCloseTo(1.25 * L, 12);
      expect(res.pulse1Moving).toBeCloseTo(0.781055 * L, 5);
      expect(res.pulse2Moving).toBeCloseTo(0.468945 * L, 5);
    });
  });

  describe("1 000-angle sum sweep confirming total moving energy is gamma * L", () => {
    const speeds = [0.01, 0.1, 0.3, 0.6, 0.8, 0.95];
    const NUM_ANGLES = 1000;

    for (const v of speeds) {
      it(`sweep at beta = ${v}: sum equals gamma * L within 1e-12 relative across 1 000 angles`, () => {
        const L = 2.5;
        const gammaVal = 1 / Math.sqrt(1 - v * v);
        const expectedSum = gammaVal * L;

        for (let i = 0; i < NUM_ANGLES; i++) {
          const phi = (i / NUM_ANGLES) * 2 * Math.PI;
          const res = pulseEnergies(L, v, phi);
          expect(res.status).toBe("value");

          const sum = numVal(res.pulseSum);
          const relErr = Math.abs(sum - expectedSum) / expectedSum;
          expect(relErr).toBeLessThan(TOLERANCE);

          // Component sum check
          const p1 = numVal(res.pulse1);
          const p2 = numVal(res.pulse2);
          const compSum = p1 + p2;
          const compRelErr = Math.abs(compSum - expectedSum) / expectedSum;
          expect(compRelErr).toBeLessThan(TOLERANCE);
        }
      });
    }
  });

  describe("Doppler-ratio identity and premise", () => {
    it("energy ratio equals Doppler frequency ratio within 1e-12", () => {
      const testAngles = [0.1, 0.5, 1.0, 1.5, 2.0, 2.8, 3.14];
      const testSpeeds = [0.05, 0.2, 0.5, 0.75, 0.9];

      for (const b of testSpeeds) {
        for (const phi of testAngles) {
          const res = pulseEnergies(1.0, b, phi);
          expect(res.status).toBe("value");

          const eRatio = numVal(res.pulseEnergyRatio);
          const dRatio = numVal(res.dopplerFrequencyRatio);
          expect(withinTolerance(eRatio, dRatio, { relative: 1e-12 }).ok).toBe(true);

          const expectedRatio = (1 - b * Math.cos(phi)) / (1 + b * Math.cos(phi));
          expect(withinTolerance(eRatio, expectedRatio, { relative: 1e-12 }).ok).toBe(true);
        }
      }
    });

    it("carries the imported light-energy transformation premise from Paper 3 §8", () => {
      const res = pulseEnergies(1.0, 0.6, 0);
      expect(res.premise).toBeDefined();
      expect(res.premise.id).toBe("premise-light-energy-transformation");
      expect(res.premise.provenance).toContain("ap-17-891 §8");
      expect(res.premise.sourceAnchor).toBe("ap-17-891#p3-s8");
      expect(res.premise.status).toBe("asserted");
    });
  });

  describe("refusal at |beta| >= 1, nonfinite, and L <= 0", () => {
    it("refuses beta >= 1 with outside-domain", () => {
      const res1 = pulseEnergies(1.0, 1.0, 0);
      expect(res1.status).toBe("outside-domain");
      expect(res1.pulseSum.status).toBe("outside-domain");

      const resSuper = pulseEnergies(1.0, 1.5, 0);
      expect(resSuper.status).toBe("outside-domain");
    });

    it("refuses beta <= -1 with outside-domain", () => {
      const resNeg = pulseEnergies(1.0, -1.0, 0);
      expect(resNeg.status).toBe("outside-domain");
    });

    it("refuses L <= 0 with outside-domain", () => {
      const resZero = pulseEnergies(0, 0.5, 0);
      expect(resZero.status).toBe("outside-domain");

      const resNegL = pulseEnergies(-5, 0.5, 0);
      expect(resNegL.status).toBe("outside-domain");
    });

    it("refuses nonfinite inputs with outside-domain", () => {
      expect(pulseEnergies(Number.NaN, 0.5, 0).status).toBe("outside-domain");
      expect(pulseEnergies(1.0, Number.POSITIVE_INFINITY, 0).status).toBe("outside-domain");
      expect(pulseEnergies(1.0, 0.5, Number.NaN).status).toBe("outside-domain");
    });
  });
});
