import { describe, expect, test } from "bun:test";
import { logField, logFieldFailure } from "../physics/reference/fields.log.ts";
import {
  C_SI,
  EPS0,
  mapChargeDensityHistorical,
  mapChargeDensityHistoricalToSI,
  mapGaussianHistoricalToSI,
  mapSIToGaussianHistorical,
  transformGaussianHistorical,
  transformSI,
  type Vec3,
} from "../physics/reference/fields.ts";
import { withinTolerance } from "../units/tolerance.ts";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("fields.gaussianMapping.test.ts: Gaussian historical mapping and SI equivalence", () => {
  test("Gaussian field mapping round trips return original fields within 1e-14 relative", () => {
    const t0 = performance.now();
    const rng = seededRandom(101);

    for (let i = 0; i < 50; i++) {
      const E: Vec3 = {
        x: (rng() - 0.5) * 500,
        y: (rng() - 0.5) * 500,
        z: (rng() - 0.5) * 500,
      };
      const B: Vec3 = {
        x: (rng() - 0.5) * 0.05,
        y: (rng() - 0.5) * 0.05,
        z: (rng() - 0.5) * 0.05,
      };

      const g = mapSIToGaussianHistorical(E, B, EPS0, C_SI);
      const siBack = mapGaussianHistoricalToSI(g, EPS0, C_SI);

      expect(withinTolerance(siBack.E.x, E.x, { relative: 1e-14, absolute: 1e-14 }).ok).toBe(true);
      expect(withinTolerance(siBack.E.y, E.y, { relative: 1e-14, absolute: 1e-14 }).ok).toBe(true);
      expect(withinTolerance(siBack.E.z, E.z, { relative: 1e-14, absolute: 1e-14 }).ok).toBe(true);
      expect(withinTolerance(siBack.B.x, B.x, { relative: 1e-14, absolute: 1e-14 }).ok).toBe(true);
      expect(withinTolerance(siBack.B.y, B.y, { relative: 1e-14, absolute: 1e-14 }).ok).toBe(true);
      expect(withinTolerance(siBack.B.z, B.z, { relative: 1e-14, absolute: 1e-14 }).ok).toBe(true);
    }

    logField({
      testId: "fields-gaussian-mapping-roundtrip",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "SI <-> Gaussian historical field mapping roundtrips pass within 1e-14 relative.",
    });
  });

  test("SI and Gaussian transforms agree through explicit mapping within 1e-12 relative across speeds", () => {
    const t0 = performance.now();
    const rng = seededRandom(202);
    const speeds = [0.1, 0.3, 0.6, 0.85, 0.95];

    for (const beta of speeds) {
      const boost = beta * C_SI;
      for (let i = 0; i < 20; i++) {
        const E: Vec3 = {
          x: (rng() - 0.5) * 1000,
          y: (rng() - 0.5) * 1000,
          z: (rng() - 0.5) * 1000,
        };
        const B: Vec3 = {
          x: (rng() - 0.5) * 0.1,
          y: (rng() - 0.5) * 0.1,
          z: (rng() - 0.5) * 0.1,
        };

        // Route A: Transform directly in SI
        const siTrans = transformSI({ E, B, boost, c: C_SI });

        // Route B: Map SI to Gaussian, transform with historical formula, map back to SI
        const g0 = mapSIToGaussianHistorical(E, B, EPS0, C_SI);
        const gTrans = transformGaussianHistorical({
          E: { x: g0.X, y: g0.Y, z: g0.Z },
          B: { x: g0.L, y: g0.M, z: g0.N },
          boost,
          c: C_SI,
        });
        const siFromGaussian = mapGaussianHistoricalToSI(
          {
            X: gTrans.E.x,
            Y: gTrans.E.y,
            Z: gTrans.E.z,
            L: gTrans.B.x,
            M: gTrans.B.y,
            N: gTrans.B.z,
          },
          EPS0,
          C_SI,
        );

        const checkEx = withinTolerance(siFromGaussian.E.x, siTrans.E.x, {
          relative: 1e-12,
          absolute: 1e-12,
        });
        const checkEy = withinTolerance(siFromGaussian.E.y, siTrans.E.y, {
          relative: 1e-12,
          absolute: 1e-12,
        });
        const checkEz = withinTolerance(siFromGaussian.E.z, siTrans.E.z, {
          relative: 1e-12,
          absolute: 1e-12,
        });
        const checkBx = withinTolerance(siFromGaussian.B.x, siTrans.B.x, {
          relative: 1e-12,
          absolute: 1e-12,
        });
        const checkBy = withinTolerance(siFromGaussian.B.y, siTrans.B.y, {
          relative: 1e-12,
          absolute: 1e-12,
        });
        const checkBz = withinTolerance(siFromGaussian.B.z, siTrans.B.z, {
          relative: 1e-12,
          absolute: 1e-12,
        });

        if (
          !checkEx.ok ||
          !checkEy.ok ||
          !checkEz.ok ||
          !checkBx.ok ||
          !checkBy.ok ||
          !checkBz.ok
        ) {
          logFieldFailure("fields-gaussian-si-equiv-fail", { beta, E, B, siTrans, siFromGaussian });
        }

        expect(checkEx.ok).toBe(true);
        expect(checkEy.ok).toBe(true);
        expect(checkEz.ok).toBe(true);
        expect(checkBx.ok).toBe(true);
        expect(checkBy.ok).toBe(true);
        expect(checkBz.ok).toBe(true);
      }
    }

    logField({
      testId: "fields-gaussian-si-equivalence",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "SI direct transform and mapped Gaussian transform agree within 1e-12 relative across multiple speeds.",
    });
  });

  test("charge density mapping includes the 4pi factor and a version without it fails", () => {
    const t0 = performance.now();
    const rhoSI = 1.75; // C / m^3

    // Correct mapping with 4pi
    const rhoPrinted = mapChargeDensityHistorical(rhoSI, EPS0);
    const expectedFactor = Math.sqrt((4 * Math.PI) / EPS0);
    expect(withinTolerance(rhoPrinted, rhoSI * expectedFactor, { relative: 1e-14 }).ok).toBe(true);

    // Inverse mapping
    const recoveredSI = mapChargeDensityHistoricalToSI(rhoPrinted, EPS0);
    expect(withinTolerance(recoveredSI, rhoSI, { relative: 1e-14 }).ok).toBe(true);

    // Flawed mapping that omits 4pi factor
    const rhoFlawed = Math.sqrt(1 / EPS0) * rhoSI;
    const ratio = rhoPrinted / rhoFlawed;
    expect(withinTolerance(ratio, Math.sqrt(4 * Math.PI), { relative: 1e-12 }).ok).toBe(true);
    // Erroneous version without 4pi fails tolerance test against true printed mapping
    const errVerdict = withinTolerance(rhoFlawed, rhoPrinted, { relative: 1e-12 });
    expect(errVerdict.ok).toBe(false);

    logField({
      testId: "fields-charge-density-4pi-check",
      resultStatus: "value",
      expected: rhoPrinted,
      actual: rhoPrinted,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Charge density mapping accurately includes 4pi factor; naive factor without 4pi fails by sqrt(4pi).",
    });
  });
});
