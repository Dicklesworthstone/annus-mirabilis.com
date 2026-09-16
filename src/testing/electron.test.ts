import { describe, expect, test } from "bun:test";
import type { ScientificResult } from "../experiments/results/types.ts";
import { constantValue, getConstantSet } from "../physics/reference/constants.ts";
import {
  acceleratingPotential,
  addAccelerations,
  addForces,
  C_SI,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  electricRadius,
  evaluateSr13,
  FrameMismatchError,
  integrateBoris,
  kineticEnergy,
  longitudinalFieldTrajectory,
  longitudinalMass,
  magneticFieldTrajectory,
  magneticRadius,
  modernMomentum,
  threePrintedRelations,
  transformAcceleration,
  transformForce,
  transverseFieldTrajectory,
  transverseMassComoving,
  transverseMassLaboratory,
} from "../physics/reference/electron.ts";

function val(r: ScientificResult | undefined): number {
  if (!r || r.status !== "value" || typeof r.value !== "number") {
    throw new Error(`Expected ScientificResult with numeric value, got: ${JSON.stringify(r)}`);
  }
  return r.value;
}

function expectClose(actual: number, expected: number, relTol: number = 1e-6, absFloor: number = 1e-12) {
  const diff = Math.abs(actual - expected);
  if (diff <= absFloor) return;
  const rel = diff / Math.max(Math.abs(actual), Math.abs(expected));
  expect(rel).toBeLessThanOrEqual(relTol);
}

describe("electron physics reference (am-ref-electron-kfy)", () => {
  describe("constants and frames", () => {
    test("constants match modern-si-2019 and modern-codata-2022", () => {
      expect(C_SI).toBe(299792458);
      expect(ELEMENTARY_CHARGE).toBe(1.602176634e-19);
      expectClose(ELECTRON_MASS, 9.1093837e-31, 1e-6);
    });

    test("frame arithmetic enforces frame identity and throws FrameMismatchError", () => {
      const fLab = { frame: "laboratory" as const, components: { x: 1, y: 2, z: 3 } };
      const fCom = { frame: "comoving" as const, components: { x: 1, y: 2, z: 3 } };

      expect(() => addForces(fLab, fCom)).toThrow(FrameMismatchError);

      const fLab2 = { frame: "laboratory" as const, components: { x: 4, y: 5, z: 6 } };
      const sumF = addForces(fLab, fLab2);
      expect(sumF.frame).toBe("laboratory");
      expect(sumF.components.x).toBe(5);
      expect(sumF.components.y).toBe(7);
      expect(sumF.components.z).toBe(9);

      const aLab = { frame: "laboratory" as const, components: { x: 1, y: 0, z: 0 } };
      const aCom = { frame: "comoving" as const, components: { x: 1, y: 0, z: 0 } };
      expect(() => addAccelerations(aLab, aCom)).toThrow(FrameMismatchError);
    });

    test("transforms forces and accelerations between laboratory and comoving frames", () => {
      const beta = 0.6; // gamma = 1.25
      const fLab = { frame: "laboratory" as const, components: { x: 10, y: 20, z: 30 } };
      const fCom = transformForce(fLab, beta, "comoving");
      expect(fCom.frame).toBe("comoving");
      expect(fCom.components.x).toBe(10);
      expectClose(fCom.components.y, 25); // 20 * 1.25
      expectClose(fCom.components.z, 37.5); // 30 * 1.25

      const fBack = transformForce(fCom, beta, "laboratory");
      expect(fBack.frame).toBe("laboratory");
      expectClose(fBack.components.y, 20);

      const aLab = { frame: "laboratory" as const, components: { x: 2, y: 3, z: 4 } };
      const aCom = transformAcceleration(aLab, beta, "comoving");
      expect(aCom.frame).toBe("comoving");
      expectClose(aCom.components.x, 2 * 1.25 ** 3); // 2 * 1.953125 = 3.90625
      expectClose(aCom.components.y, 3 * 1.25 ** 2); // 3 * 1.5625 = 4.6875
      expectClose(aCom.components.z, 4 * 1.25 ** 2); // 4 * 1.5625 = 6.25

      const aBack = transformAcceleration(aCom, beta, "laboratory");
      expect(aBack.frame).toBe("laboratory");
      expectClose(aBack.components.x, 2);
      expectClose(aBack.components.y, 3);
    });
  });

  describe("mass conventions and coefficients at beta = 0.6", () => {
    const beta = 0.6;
    const m = ELECTRON_MASS;

    test("coefficients match gamma = 1.25, gamma^2 = 1.5625, gamma^3 = 1.953125", () => {
      const longRes = longitudinalMass(m, beta);
      expect(longRes.status).toBe("value");
      expectClose(val(longRes) / m, 1.953125, 1e-12);

      const transComovRes = transverseMassComoving(m, beta);
      expect(transComovRes.status).toBe("value");
      expectClose(val(transComovRes) / m, 1.5625, 1e-12);

      const transLabRes = transverseMassLaboratory(m, beta);
      expect(transLabRes.status).toBe("value");
      expectClose(val(transLabRes) / m, 1.25, 1e-12);
    });

    test("adversarial check: source and laboratory transverse coefficients are not equal", () => {
      const transComovRes = transverseMassComoving(m, beta);
      const transLabRes = transverseMassLaboratory(m, beta);
      expect(transComovRes.status).toBe("value");
      expect(transLabRes.status).toBe("value");
      expect(val(transComovRes)).not.toBe(val(transLabRes));
      expectClose(val(transComovRes) / val(transLabRes), 1.25, 1e-12); // ratio is gamma
    });

    test("modern momentum matches p = gamma * m * u", () => {
      const u = { x: 0.6 * C_SI, y: 0, z: 0 };
      const p = modernMomentum(m, u);
      expectClose(p.gamma, 1.25, 1e-12);
      expectClose(p.px, 1.25 * m * 0.6 * C_SI, 1e-12);
      expect(p.py).toBe(0);
      expect(p.pz).toBe(0);
    });
  });

  describe("work, kinetic energy, potential, and radii fixtures", () => {
    test("kinetic energy fixtures at beta = 0.6 and 0.95", () => {
      const ke06 = kineticEnergy(ELECTRON_MASS, 0.6);
      expect(ke06.exact.status).toBe("value");
      expect(ke06.newtonian.status).toBe("value");
      const mc2 = ELECTRON_MASS * C_SI * C_SI;
      expectClose(val(ke06.exact), 0.25 * mc2, 1e-12);
      expectClose(val(ke06.newtonian), 0.18 * mc2, 1e-12);
      expectClose(ke06.ratio, 0.25 / 0.18, 1e-12);

      // beta = 0.95: gamma = 1/sqrt(1 - 0.95^2) = 1/sqrt(0.0975) ≈ 3.202563, W ≈ 2.20256 mc^2
      const ke095 = kineticEnergy(ELECTRON_MASS, 0.95);
      expect(ke095.exact.status).toBe("value");
      expectClose(val(ke095.exact) / mc2, 2.202563, 1e-5);
    });

    test("stability down to beta = 10^-8", () => {
      const keSmall = kineticEnergy(ELECTRON_MASS, 1e-8);
      expect(keSmall.exact.status).toBe("value");
      expect(keSmall.newtonian.status).toBe("value");
      expectClose(val(keSmall.exact), val(keSmall.newtonian), 1e-7);
    });

    test("accelerating potential fixture: P ≈ 127,749.7 V (Newtonian 91,979.8 V)", () => {
      const pot = acceleratingPotential(0.6);
      expect(pot.exact.status).toBe("value");
      expect(pot.newtonian.status).toBe("value");
      expectClose(val(pot.exact), 127749.7, 1e-4);
      expectClose(val(pot.newtonian), 91979.8, 1e-4);
    });

    test("magnetic radius at B = 0.01 T: Rm ≈ 0.127838 m (Newtonian 0.102271 m)", () => {
      const rm = magneticRadius(0.6, 0.01);
      expect(rm.exact.status).toBe("value");
      expect(rm.newtonian.status).toBe("value");
      expectClose(val(rm.exact), 0.127838, 1e-4);
      expectClose(val(rm.newtonian), 0.102271, 1e-4);
    });

    test("electric radius at E = 10^5 V/m: Re ≈ 2.29950 m (Newtonian 1.83960 m)", () => {
      const re = electricRadius(0.6, 1e5);
      expect(re.exact.status).toBe("value");
      expect(re.newtonian.status).toBe("value");
      expectClose(val(re.exact), 2.29950, 1e-4);
      expectClose(val(re.newtonian), 1.83960, 1e-4);
    });

    test("three printed relations from §10", () => {
      const rels = threePrintedRelations(0.6, 1e5, 0.01);
      expect(rels.deflectabilityRatio.status).toBe("value");
      expectClose(val(rels.deflectabilityRatio), 0.6, 1e-12);
    });
  });

  describe("exact trajectories", () => {
    test("transverse electric field trajectory reproduces fixture values at 0.5, 1, 2 ns", () => {
      const eField = 1e5; // V/m along +y
      const v0 = 0.6 * C_SI;
      const pts = transverseFieldTrajectory(eField, v0, 2e-9, 4);

      // t = 0.5 ns
      const pt05 = pts.find((p) => Math.abs(p.t - 0.5e-9) < 1e-12)!;
      expect(pt05).toBeDefined();
      expectClose(pt05.x, 0.08992948, 1e-5);
      expectClose(pt05.y, -0.001758578, 1e-5);
      expectClose(pt05.speedRatio, 0.6002935, 1e-5);

      // t = 1.0 ns
      const pt10 = pts.find((p) => Math.abs(p.t - 1.0e-9) < 1e-12)!;
      expect(pt10).toBeDefined();
      expectClose(pt10.x, 0.1798095, 1e-5);
      expectClose(pt10.y, -0.00703141, 1e-5);
      expectClose(pt10.speedRatio, 0.6011711, 1e-5);

      // t = 2.0 ns
      const pt20 = pts.find((p) => Math.abs(p.t - 2.0e-9) < 1e-12);
      expect(pt20).toBeDefined();
      expectClose(pt20!.x, 0.3592247, 1e-5);
      expectClose(pt20!.y, -0.0280794, 1e-5);
      expectClose(pt20!.speedRatio, 0.6046404, 1e-5);
    });

    test("longitudinal electric field hyperbolic motion matches closed form", () => {
      const eField = 1e5;
      const pts = longitudinalFieldTrajectory(eField, 2e-9, 10);
      expect(pts.length).toBe(11);
      expect(pts[0]?.x).toBe(0);
      expect(pts[pts.length - 1]?.x).toBeLessThan(0); // electron q < 0 moves in -x for +E_x

      const ptsPos = longitudinalFieldTrajectory(eField, 2e-9, 10, ELEMENTARY_CHARGE);
      expect(ptsPos[ptsPos.length - 1]?.x).toBeGreaterThan(0);
    });

    test("magnetic circular motion keeps speed constant", () => {
      const bField = 0.01;
      const v0 = 0.6 * C_SI;
      const pts = magneticFieldTrajectory(bField, v0, 2e-9, 20);
      for (const pt of pts) {
        expectClose(pt.speedRatio, 0.6, 1e-12);
      }
    });

    test("Boris integrator matches transverse exact solution and conserves energy in pure B", () => {
      const eField = { x: 0, y: 1e5, z: 0 };
      const bField = { x: 0, y: 0, z: 0 };
      const v0 = { x: 0.6 * C_SI, y: 0, z: 0 };

      const res = integrateBoris(eField, bField, v0, 2e-9, 1000);
      const last = res.points[res.points.length - 1];
      expect(last).toBeDefined();
      expectClose(last!.x, 0.3592247, 1e-3);
      expectClose(last!.y, -0.0280794, 2e-3);
      expect(res.energyResidual).toBeDefined();
      expect(res.energyResidual!).toBeLessThan(1e-16);

      // Pure B field
      const resB = integrateBoris({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.01 }, v0, 2e-9, 100);
      for (const p of resB.points) {
        expectClose(p.speedRatio, 0.6, 1e-8);
      }
    });
  });

  describe("evaluateSr13 experiment", () => {
    test("evaluates valid inputs", () => {
      const out = evaluateSr13({
        electricFieldX: 0,
        electricFieldY: 1e5,
        electricFieldZ: 0,
        magneticFieldX: 0,
        magneticFieldY: 0,
        magneticFieldZ: 0.01,
        initialSpeed: 0.6,
        initialDirectionDeg: 0,
        integrationInterval: 2e-9,
        forceConvention: "source",
        massLanguage: "1905",
        particle: "electron",
        datasetOverlay: "none",
      });

      expect(out.longitudinalMass?.status).toBe("value");
      expect(out.transverseMassComoving?.status).toBe("value");
      expect(out.transverseMassLaboratory?.status).toBe("value");
      expect(out.kineticEnergy?.status).toBe("value");
      expect(out.acceleratingPotential?.status).toBe("value");
      expect(out.radiusCurvatureMagnetic?.status).toBe("value");
      expect(out.radiusCurvatureElectric?.status).toBe("value");
      expect(out.lorentzFactor?.status).toBe("value");
    });

    test("refuses superluminal speeds", () => {
      const out = evaluateSr13({
        electricFieldX: 0,
        electricFieldY: 1e5,
        electricFieldZ: 0,
        magneticFieldX: 0,
        magneticFieldY: 0,
        magneticFieldZ: 0,
        initialSpeed: 1.1,
        initialDirectionDeg: 0,
        integrationInterval: 2e-9,
        forceConvention: "source",
        massLanguage: "1905",
        particle: "electron",
        datasetOverlay: "none",
      });

      expect(out.longitudinalMass?.status).toBe("outside-domain");
      expect(out.kineticEnergy?.status).toBe("outside-domain");
    });
  });
});
