import { describe, expect, it } from "bun:test";
import { evaluatePhotonBox, photonInBox } from "./massEnergy.ts";

describe("massEnergy.box: 1906 photon-in-a-box thought experiment", () => {
  function val(res: { status: string; value?: number | Float64Array }): number {
    expect(res.status).toBe("value");
    return res.value as number;
  }

  describe("canonical fixture (E = 1 J, ell = 1 m, M = 1 kg)", () => {
    it("matches recoil speed, flight time, displacement, momentum, and domain ratio", () => {
      const box = photonInBox({ E: 1.0, ell: 1.0, M: 1.0, assignLightMass: true });

      expect(box.status).toBe("value");
      expect(val(box.boxMass)).toBe(1.0);
      expect(val(box.boxLength)).toBe(1.0);
      expect(val(box.pulseEnergy)).toBe(1.0);

      // Recoil speed: E / (M * c) = 1 / 299792458 = 3.33564095...e-9 m/s
      expect(val(box.recoilSpeed)).toBeCloseTo(3.335641e-9, 14);
      expect(box.recoilSpeedValue).toBeCloseTo(3.335641e-9, 14);

      // Pulse flight time: ell / c = 1 / 299792458 = 3.33564095...e-9 s
      expect(val(box.pulseFlightTime)).toBeCloseTo(3.335641e-9, 14);
      expect(box.flightTimeValue).toBeCloseTo(3.335641e-9, 14);

      // Pulse momentum: E / c = 3.335641e-9 kg·m/s
      expect(val(box.pulseMomentum)).toBeCloseTo(3.335641e-9, 14);

      // Box displacement: -E * ell / (M * c^2) = -1.112650056...e-17 m
      expect(val(box.boxDisplacement)).toBeCloseTo(-1.11265e-17, 22);
      expect(box.displacement).toBeCloseTo(-1.11265e-17, 22);

      // Domain ratio: E / (M * c^2) = 1.112650e-17
      expect(box.domainRatio).toBeCloseTo(1.11265e-17, 22);
      expect(box.domainBound).toBe(1e-3);

      // Approximations listed
      expect(box.approximations).toContain("nonrelativistic-box");
      expect(box.approximations).toContain("flight-time-l-over-c");
      expect(box.approximations).toContain("rigid-box");
    });
  });

  describe("exact rational center-of-mass change", () => {
    it("with light mass assigned: exact rational center-of-mass shift is IDENTICALLY ZERO", () => {
      const box = evaluatePhotonBox({ E: 1.0, ell: 1.0, M: 1.0, assignLightMass: true });

      expect(box.status).toBe("value");
      expect(val(box.centerOfMassShift)).toBe(0);
      expect(box.comShift).toBe(0);
      expect(val(box.lightMassAssigned)).toBeCloseTo(1.11265e-17, 22);

      // BigInt exact rational check
      expect(box.exactRationalCenterOfMassShift.isExactlyZero).toBe(true);
      expect(box.exactRationalCenterOfMassShift.numerator).toBe(0n);
      expect(box.exactRationalCenterOfMassShift.denominator).toBe(1n);
    });

    it("without light mass assigned: exact rational center-of-mass shift is NONZERO", () => {
      const box = evaluatePhotonBox({ E: 1.0, ell: 1.0, M: 1.0, assignLightMass: false });

      expect(box.status).toBe("value");
      expect(val(box.centerOfMassShift)).toBeCloseTo(-1.11265e-17, 22);
      expect(box.comShift).toBeCloseTo(-1.11265e-17, 22);
      expect(val(box.lightMassAssigned)).toBe(0);

      // BigInt exact rational check
      expect(box.exactRationalCenterOfMassShift.isExactlyZero).toBe(false);
      expect(box.exactRationalCenterOfMassShift.numerator).not.toBe(0n);
      expect(box.exactRationalCenterOfMassShift.numerator).toBe(-1n);
      expect(box.exactRationalCenterOfMassShift.denominator).toBe(89875517873681764n); // 299792458^2
    });
  });

  describe("domain bound enforcement", () => {
    it("refuses when E / (M * c^2) > 1e-3 with outside-domain", () => {
      // With M = 1 kg, c^2 ~ 9e16 J. Bound is 1e-3 * 9e16 = 9e13 J.
      // Set E = 1e14 J > 9e13 J
      const box = photonInBox({ E: 1e14, ell: 1.0, M: 1.0 });

      expect(box.status).toBe("outside-domain");
      expect(box.condition).toContain("E / (M * c^2) <=");
      expect(box.reason).toContain("nonrelativistic recoil approximation");
      expect(box.centerOfMassShift.status).toBe("outside-domain");
    });

    it("accepts when E / (M * c^2) <= 1e-3", () => {
      const box = photonInBox({ E: 1e13, ell: 1.0, M: 1.0 });
      expect(box.status).toBe("value");
    });

    it("custom domain bound is respected", () => {
      const box = photonInBox({ E: 1e8, ell: 1.0, M: 1.0, domainBound: 1e-10 });
      expect(box.status).toBe("outside-domain");
    });

    it("refuses nonpositive or nonfinite inputs", () => {
      expect(photonInBox({ E: 0 }).status).toBe("outside-domain");
      expect(photonInBox({ E: -1 }).status).toBe("outside-domain");
      expect(photonInBox({ M: 0 }).status).toBe("outside-domain");
      expect(photonInBox({ ell: -5 }).status).toBe("outside-domain");
      expect(photonInBox({ E: Number.NaN }).status).toBe("outside-domain");
    });
  });
});
