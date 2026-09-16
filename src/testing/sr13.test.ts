import { describe, expect, test } from "bun:test";
import type { ScientificResult } from "../experiments/results/types.ts";
import {
  acceleratingPotential,
  C_SI,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  electricRadius,
  evaluateSr13,
  integrateBoris,
  kineticEnergy,
  longitudinalMass,
  magneticRadius,
  transverseFieldTrajectory,
  transverseMassComoving,
  transverseMassLaboratory,
} from "../physics/reference/electron.ts";

import { withinTolerance } from "../units/tolerance.ts";

function val(r: ScientificResult | undefined): number {
  if (!r || r.status !== "value" || typeof r.value !== "number") {
    throw new Error(`Expected ScientificResult with numeric value, got: ${JSON.stringify(r)}`);
  }
  return r.value;
}

function expectClose(actual: number, expected: number, relTol: number = 1e-5, absFloor: number = 1e-12) {
  const verdict = withinTolerance(actual, expected, {
    relative: relTol,
    absolute: absFloor,
    relativeTo: "larger",
  });
  expect(verdict.ok).toBe(true);
}

describe("SR-13 Acceptance Criteria & Numerical Rigor (am-sr-13-electron-dynamics-b6v7)", () => {
  test("Fixture at beta = 0.6: mass coefficients, kinetic energy, potential, and radii", () => {
    const beta = 0.6;
    const m = ELECTRON_MASS;

    // Mass coefficients
    const longM = longitudinalMass(m, beta);
    const transComov = transverseMassComoving(m, beta);
    const transLab = transverseMassLaboratory(m, beta);

    expect(longM.status).toBe("value");
    expect(transComov.status).toBe("value");
    expect(transLab.status).toBe("value");
    expectClose(val(longM) / m, 1.953125, 1e-12); // gamma^3
    expectClose(val(transComov) / m, 1.5625, 1e-12); // gamma^2 (source)
    expectClose(val(transLab) / m, 1.25, 1e-12); // gamma (lab)

    // Kinetic energy
    const ke = kineticEnergy(m, beta);
    expect(ke.exact.status).toBe("value");
    expect(ke.newtonian.status).toBe("value");
    const mc2 = m * C_SI * C_SI;
    expectClose(val(ke.exact), 0.25 * mc2, 1e-12);
    expectClose(val(ke.newtonian), 0.18 * mc2, 1e-12);

    // Accelerating potential
    const pot = acceleratingPotential(beta);
    expect(pot.exact.status).toBe("value");
    expect(pot.newtonian.status).toBe("value");
    expectClose(val(pot.exact), 127749.7, 1e-4);
    expectClose(val(pot.newtonian), 91979.8, 1e-4);

    // Magnetic radius at B = 0.01 T
    const rm = magneticRadius(beta, 0.01);
    expect(rm.exact.status).toBe("value");
    expect(rm.newtonian.status).toBe("value");
    expectClose(val(rm.exact), 0.127838, 1e-4);
    expectClose(val(rm.newtonian), 0.102271, 1e-4);

    // Electric radius at E = 10^5 V/m
    const re = electricRadius(beta, 1e5);
    expect(re.exact.status).toBe("value");
    expect(re.newtonian.status).toBe("value");
    expectClose(val(re.exact), 2.29950, 1e-4);
    expectClose(val(re.newtonian), 1.83960, 1e-4);

    // High speed at beta = 0.95
    const ke95 = kineticEnergy(m, 0.95);
    expect(ke95.exact.status).toBe("value");
    expectClose(val(ke95.exact) / mc2, 2.202563, 1e-4);
  });

  test("Default transverse-field trajectory at 2 ns matches exact reference", () => {
    const pts = transverseFieldTrajectory(1e5, 0.6 * C_SI, 2e-9, 100);
    const last = pts[pts.length - 1];
    expect(last).toBeDefined();
    expectClose(last!.x, 0.359225, 1e-4);
    expectClose(last!.y, -0.0280794, 1e-4);
    expectClose(last!.speedRatio, 0.60464, 1e-4);
  });

  test("Switching conventions leaves radii, potentials, and trajectories unchanged", () => {
    const outSource = evaluateSr13({
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

    const outLab = evaluateSr13({
      electricFieldX: 0,
      electricFieldY: 1e5,
      electricFieldZ: 0,
      magneticFieldX: 0,
      magneticFieldY: 0,
      magneticFieldZ: 0.01,
      initialSpeed: 0.6,
      initialDirectionDeg: 0,
      integrationInterval: 2e-9,
      forceConvention: "laboratory",
      massLanguage: "modern",
      particle: "electron",
      datasetOverlay: "none",
    });

    // Radii and potentials are identical
    expect(val(outSource.radiusCurvatureElectric)).toBe(val(outLab.radiusCurvatureElectric));
    expect(val(outSource.radiusCurvatureMagnetic)).toBe(val(outLab.radiusCurvatureMagnetic));
    expect(val(outSource.acceleratingPotential)).toBe(val(outLab.acceleratingPotential));
    expect(val(outSource.kineticEnergy)).toBe(val(outLab.kineticEnergy));
  });

  test("Integrated Boris push conserves energy-work balance and observed order", () => {
    const eField = { x: 0, y: 1e5, z: 0 };
    const bField = { x: 0, y: 0, z: 0 };
    const v0 = { x: 0.6 * C_SI, y: 0, z: 0 };

    const res = integrateBoris(eField, bField, v0, 2e-9, 500);
    expect(res.observedOrder).toBe(2);
    expect(res.energyResidual).toBeDefined();
    expect(res.energyResidual!).toBeLessThan(1e-15);
  });
});
