import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aberration,
  detectorCrossingCount,
  dopplerFactor,
  lightComplexFactors,
  lightComplexMaterialContractionCountermodel,
  lightComplexVolumeNumeric,
  mirrorFrameLedger,
  movingMirror,
  phaseAtEvent,
  secondOrderShift,
  transformWaveVector,
} from "../physics/reference/waves.ts";

describe("Waves Reference Physics Evaluator (am-ref-waves-r53)", () => {
  describe("phaseAtEvent & Independence Rule", () => {
    test("evaluates phase at origin and downstream events correctly", () => {
      const wave = { omega: 2 * Math.PI, kx: 2 * Math.PI, ky: 0, kz: 0 };
      const origin = { t: 0, x: 0, y: 0, z: 0 };
      const p0 = phaseAtEvent(origin, wave);
      expect(p0.status).toBe("value");
      if (p0.status === "value") {
        expect(p0.value).toBe(0);
        expect(p0.quantityId).toBe("wavePhase");
        expect(p0.unit).toBe("rad");
      }

      // One full wavelength downstream at t = 0
      const oneCycle = { t: 0, x: 1, y: 0, z: 0 };
      const p1 = phaseAtEvent(oneCycle, wave);
      expect(p1.status).toBe("value");
      if (p1.status === "value") {
        expect(p1.value).toBeCloseTo(2 * Math.PI, 12);
      }

      // 10 cycles downstream (unwrapped)
      const tenCycles = { t: 0, x: 10, y: 0, z: 0 };
      const p10 = phaseAtEvent(tenCycles, wave);
      expect(p10.status).toBe("value");
      if (p10.status === "value") {
        expect(p10.value).toBeCloseTo(20 * Math.PI, 12);
      }
    });

    test("refuses nonfinite coordinates and wave components", () => {
      const badCoord = { t: Number.NaN, x: 0, y: 0, z: 0 };
      const wave = { omega: 1, kx: 1, ky: 0, kz: 0 };
      const res = phaseAtEvent(badCoord, wave);
      expect(res.status).toBe("outside-domain");
    });

    test("enforces independence rule on phaseAtEvent call graph", () => {
      const sourcePath = resolve(process.cwd(), "src/physics/reference/waves.ts");
      const source = readFileSync(sourcePath, "utf-8");

      // Extract the body of phaseAtEvent
      const match = source.match(/export function phaseAtEvent[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      const body = match?.[0] ?? "";

      const forbiddenCallees = [
        "dopplerFactor",
        "aberration",
        "transformWaveVector",
        "lightComplexFactors",
      ];
      for (const callee of forbiddenCallees) {
        // Must not call callee() in phaseAtEvent body
        const regex = new RegExp(`\\b${callee}\\s*\\(`, "g");
        expect(regex.test(body)).toBe(false);
      }
    });

    test("phase invariance holds between frames for diverse beta and theta", () => {
      const betas = [0, 0.6, -0.6, 0.95, -0.95];
      const thetas = [0, Math.PI / 6, Math.PI / 2, Math.PI];

      for (const beta of betas) {
        for (const theta of thetas) {
          const omega = 1.0;
          const k = { x: Math.cos(theta), y: Math.sin(theta), z: 0 };
          const waveStationary = { omega, kx: k.x, ky: k.y, kz: k.z };

          // Transform wave vector to moving frame
          const boosted = transformWaveVector(omega, k, beta, 1.0);
          const waveMoving = {
            omega: boosted.omegaPrime,
            kx: boosted.kPrime.x,
            ky: boosted.kPrime.y,
            kz: boosted.kPrime.z,
          };

          // Arbitrary event in K
          const eventK = { t: 2.5, x: 1.2, y: -0.8, z: 0.5 };
          const g = 1 / Math.sqrt(1 - beta * beta);
          // Standard Lorentz transform to get event in k
          const event_k = {
            t: g * (eventK.t - beta * eventK.x),
            x: g * (eventK.x - beta * eventK.t),
            y: eventK.y,
            z: eventK.z,
          };

          const phiK = phaseAtEvent(eventK, waveStationary);
          const phi_k = phaseAtEvent(event_k, waveMoving);

          expect(phiK.status).toBe("value");
          expect(phi_k.status).toBe("value");
          if (
            phiK.status === "value" &&
            typeof phiK.value === "number" &&
            phi_k.status === "value" &&
            typeof phi_k.value === "number"
          ) {
            expect(Math.abs(phiK.value - phi_k.value)).toBeLessThan(1e-12);
          }
        }
      }
    });
  });

  describe("Doppler & Aberration", () => {
    test("Doppler factors match standard fixtures at beta = 0.6", () => {
      const beta = 0.6;
      // Along boost (theta = 0): factor = gamma*(1-beta) = 1.25 * 0.4 = 0.5
      expect(dopplerFactor(beta, 0)).toBeCloseTo(0.5, 12);
      // Receding / opposite ray (theta = pi): factor = gamma*(1+beta) = 1.25 * 1.6 = 2.0
      expect(dopplerFactor(beta, Math.PI)).toBeCloseTo(2.0, 12);
      // Transverse ray in K (theta = pi/2): factor = gamma = 1.25
      expect(dopplerFactor(beta, Math.PI / 2)).toBeCloseTo(1.25, 12);
    });

    test("Aberration fixtures and trigonometric identity", () => {
      const beta = 0.6;
      // Fixed points: theta = 0 -> theta' = 0; theta = pi -> theta' = pi
      const ab0 = aberration(beta, 0);
      expect(ab0.cosThetaPrime).toBeCloseTo(1.0, 12);
      expect(ab0.thetaPrimeRad).toBeCloseTo(0, 12);

      const abPi = aberration(beta, Math.PI);
      expect(abPi.cosThetaPrime).toBeCloseTo(-1.0, 12);
      expect(Math.abs(abPi.thetaPrimeRad)).toBeCloseTo(Math.PI, 12);

      // Transverse ray in K (theta = 90 deg)
      const ab90 = aberration(beta, Math.PI / 2);
      expect(ab90.cosThetaPrime).toBeCloseTo(-0.6, 12);
      expect(ab90.sinThetaPrime).toBeCloseTo(0.8, 12);
      expect(ab90.thetaPrimeRad * (180 / Math.PI)).toBeCloseTo(126.8698976458, 8);

      // cos^2 + sin^2 = 1
      for (const theta of [0.1, 0.5, 1.2, 2.3]) {
        const ab = aberration(beta, theta);
        expect(
          ab.cosThetaPrime * ab.cosThetaPrime + ab.sinThetaPrime * ab.sinThetaPrime,
        ).toBeCloseTo(1.0, 12);
      }
    });

    test("Inverse aberration round-trips", () => {
      const beta = 0.6;
      const theta = 0.84;
      const fwd = aberration(beta, theta);
      const inv = aberration(-beta, fwd.thetaPrimeRad);
      expect(inv.thetaPrimeRad).toBeCloseTo(theta, 12);
    });

    test("Second order shift helper", () => {
      const shift = secondOrderShift(0.005);
      expect(shift).toBeCloseTo(1.250023438e-5, 12);
    });

    test("Detector crossing count matches frequency", () => {
      const omega = 10 * 2 * Math.PI; // 10 Hz
      const k = { x: omega, y: 0, z: 0 };
      const detectorVelocity = { x: 0.5, y: 0, z: 0 };
      const window = 2.0; // 2 seconds
      const crossings = detectorCrossingCount({ omega, k, detectorVelocity, window });
      // Effective angular frequency = |10*(0.5 - 1)*2pi| = 5 * 2pi rad/s -> 5 Hz * 2 s = 10 crossings
      expect(crossings).toBeCloseTo(10.0, 12);
    });
  });

  describe("Light Complex (Einstein §8)", () => {
    test("factors and adversarial countermodel comparison at beta = 0.6", () => {
      const beta = 0.6;
      // 1. Longitudinal ray (theta = 0): q = 0.5
      const lc0 = lightComplexFactors(beta, 0);
      expect(lc0.amplitudeFactor).toBeCloseTo(0.5, 12);
      expect(lc0.energyDensityFactor).toBeCloseTo(0.25, 12);
      expect(lc0.volumeFactor).toBeCloseTo(2.0, 12);
      expect(lc0.energyFactor).toBeCloseTo(0.5, 12);

      const cm0 = lightComplexMaterialContractionCountermodel(beta, 0);
      expect(cm0.factor).toBeCloseTo(0.2, 12);
      expect(cm0.volumeFactor).toBeCloseTo(0.8, 12);
      expect(Math.abs(lc0.energyFactor - cm0.factor)).toBeCloseTo(0.3, 12);

      // 2. Opposite ray (theta = pi): q = 2.0
      const lcPi = lightComplexFactors(beta, Math.PI);
      expect(lcPi.energyFactor).toBeCloseTo(2.0, 12);
      const cmPi = lightComplexMaterialContractionCountermodel(beta, Math.PI);
      expect(cmPi.factor).toBeCloseTo(3.2, 12);
      expect(cmPi.volumeFactor).toBeCloseTo(0.8, 12);
      expect(Math.abs(lcPi.energyFactor - cmPi.factor)).toBeCloseTo(1.2, 12);

      // 3. Ray transverse in moving frame (cos(theta) = beta): q = 1/gamma = 0.8
      const thetaTransversePrime = Math.acos(beta);
      const lcTP = lightComplexFactors(beta, thetaTransversePrime);
      expect(lcTP.amplitudeFactor).toBeCloseTo(0.8, 12);
      expect(lcTP.energyDensityFactor).toBeCloseTo(0.64, 12);
      expect(lcTP.volumeFactor).toBeCloseTo(1.25, 12);
      expect(lcTP.energyFactor).toBeCloseTo(0.8, 12);
      const cmTP = lightComplexMaterialContractionCountermodel(beta, thetaTransversePrime);
      expect(cmTP.factor).toBeCloseTo(0.512, 12);
      expect(cmTP.volumeFactor).toBeCloseTo(0.8, 12);
      expect(Math.abs(lcTP.energyFactor - cmTP.factor)).toBeCloseTo(0.288, 12);

      // 4. Ray transverse in unprimed frame (theta = 90 deg): coincidence check passes for both
      const lc90 = lightComplexFactors(beta, Math.PI / 2);
      expect(lc90.energyFactor).toBeCloseTo(1.25, 12);
      const cm90 = lightComplexMaterialContractionCountermodel(beta, Math.PI / 2);
      expect(cm90.factor).toBeCloseTo(1.25, 12);
      expect(cm90.volumeFactor).toBeCloseTo(0.8, 12);
      expect(lc90.energyFactor).toBeCloseTo(cm90.factor, 12);
    });

    test("numerical volume calculation agrees with exact 1/q", () => {
      const beta = 0.6;
      for (const theta of [0, 0.3, Math.PI / 2, 2.5]) {
        const exactVolume = lightComplexFactors(beta, theta).volumeFactor;
        const numVolume = lightComplexVolumeNumeric(beta, theta);
        expect(numVolume).toBeCloseTo(exactVolume, 12);
      }
    });

    test("energy factor identically equals Doppler factor for 500 seeded parameters", () => {
      let seed = 19050927;
      for (let i = 0; i < 500; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const beta = ((seed % 10000) / 10000) * 1.9 - 0.95; // in (-0.95, 0.95)
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const theta = ((seed % 10000) / 10000) * Math.PI;

        const ef = lightComplexFactors(beta, theta).energyFactor;
        const df = dopplerFactor(beta, theta);
        expect(Math.abs(ef - df)).toBeLessThan(1e-12);
      }
    });
  });

  describe("Moving Mirror Electrodynamics (Einstein §8, SR-11)", () => {
    test("Normal incidence fixtures at beta = 0.6", () => {
      const res = movingMirror(0.6, 0);
      expect(res.status).toBe("value");
      if (res.status === "value") {
        expect(res.frequencyRatio).toBeCloseTo(0.25, 12);
        expect(res.incidentPower).toBeCloseTo(0.4, 12);
        expect(res.reflectedPower).toBeCloseTo(0.1, 12);
        expect(res.radiationForce).toBeCloseTo(0.5, 12);
        expect(res.workRate).toBeCloseTo(0.3, 12);
        expect(Math.abs(res.energyBalanceResidual)).toBeLessThan(1e-12);
      }
    });

    test("Approaching mirror at beta = -0.6", () => {
      const res = movingMirror(-0.6, 0);
      expect(res.status).toBe("value");
      if (res.status === "value") {
        expect(res.frequencyRatio).toBeCloseTo(4.0, 12);
      }
    });

    test("Oblique incidence fixture at phi = 30 deg, beta = 0.6", () => {
      const phi = Math.PI / 6; // 30 deg
      const res = movingMirror(0.6, phi);
      expect(res.status).toBe("value");
      if (res.status === "value") {
        expect(res.frequencyRatio).toBeCloseTo(0.501202, 5);
        expect(res.cosPhiReflected).toBeCloseTo(0.0692256, 5);
        expect(res.incidentPower).toBeCloseTo(0.266025, 5);
        expect(res.reflectedPower).toBeCloseTo(0.133333, 5);
        expect(res.workRate).toBeCloseTo(0.132692, 5);
        expect(Math.abs(res.energyBalanceResidual)).toBeLessThan(1e-12);
        expect(res.explanation).toBeDefined();
      }
    });

    test("Mirror-frame ledger at normal and oblique incidence", () => {
      // Normal incidence
      const normLedger = mirrorFrameLedger(0.6, 0);
      expect(normLedger.incidentPower).toBeCloseTo(0.25, 12);
      expect(normLedger.reflectedPower).toBeCloseTo(0.25, 12);
      expect(normLedger.workRate).toBe(0);
      expect(normLedger.forcePrime).toBeCloseTo(0.5, 12);
      expect(normLedger.reproducedForceK).toBeCloseTo(0.5, 12);

      // Oblique incidence (30 deg)
      const oblLedger = mirrorFrameLedger(0.6, Math.PI / 6);
      expect(oblLedger.frequencyFactor).toBeCloseTo(0.600480947, 6);
      expect(oblLedger.cosPhiPrime).toBeCloseTo(0.553775933, 6);
      expect(oblLedger.incidentPower).toBeCloseTo(0.199679165, 6);
      expect(oblLedger.reflectedPower).toBeCloseTo(0.199679165, 6);
      expect(oblLedger.workRate).toBe(0);
      expect(oblLedger.forcePrime).toBeCloseTo(0.221155059, 6);
      expect(oblLedger.reproducedForceK).toBeCloseTo(0.221155059, 6);
    });

    test("Interception limits: cos(phi) <= beta returns not-applicable or indeterminate", () => {
      const beta = 0.6;
      // Critical angle = acos(0.6) = 53.1301 deg
      const phiCrit = Math.acos(0.6);
      const resCrit = movingMirror(beta, phiCrit);
      expect(resCrit.status).toBe("indeterminate");

      // Beyond critical angle (e.g. 60 deg -> cos(60) = 0.5 < 0.6)
      const resPast = movingMirror(beta, Math.PI / 3);
      expect(resPast.status).toBe("not-applicable");
    });
  });
});
