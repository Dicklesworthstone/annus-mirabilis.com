import { describe, expect, test } from "bun:test";
import { SR10_DEFAULTS, SR10_OUTPUTS } from "../experiments/sr10/definition.ts";
import { createSr10Session, snapshotOutputs, sr10Comparison } from "../experiments/sr10/session.ts";
import {
  evaluateSr10,
  lightComplexFactors,
  lightComplexMaterialContractionCountermodel,
} from "../physics/reference/waves.ts";

/**
 * am-sr-10-light-complex-kek0 specifies the rigid-body countermodel: light's energy density q² in a
 * rod's volume 1/γ, so an energy factor q²/γ, with totals 0.2, 3.2, 0.512 and 1.25 at φ = 0, 180°,
 * cos φ = β and 90° for β = 0.6. The owner used to scale energy and volume by 1/γ alike (0.8 at
 * every angle) and published the result among the accepted outputs, bound to the real energy
 * quantity. These tests fail on that model and on that publication.
 */
const BETA = 0.6;
const ANGLES: readonly (readonly [string, number, number, number])[] = [
  // label, theta (rad), countermodel energy factor, light-complex energy factor
  ["phi = 0", 0, 0.2, 0.5],
  ["phi = 180 deg", Math.PI, 3.2, 2],
  ["cos phi = beta", Math.acos(BETA), 0.512, 0.8],
  ["phi = 90 deg", Math.PI / 2, 1.25, 1.25],
];
const COUNTERMODEL_IDS = [
  "countermodelEnergyMoving",
  "countermodelVolumeMoving",
  "countermodelEnergyFactor",
  "countermodelVolumeFactor",
];

describe("SR-10's countermodel is the bead's rigid-body model, q²/γ", () => {
  for (const [label, theta, wrong, right] of ANGLES) {
    test(`${label}: countermodel ${wrong}, light complex ${right}`, () => {
      const cm = lightComplexMaterialContractionCountermodel(BETA, theta);
      expect(cm.factor).toBeCloseTo(wrong, 12);
      expect(cm.volumeFactor).toBeCloseTo(0.8, 12);
      expect(lightComplexFactors(BETA, theta).energyFactor).toBeCloseTo(right, 12);
    });
  }

  test("the discriminating ray is cos phi = beta, and phi = 90 deg cannot discriminate", () => {
    const at = (theta: number) =>
      Math.abs(
        lightComplexMaterialContractionCountermodel(BETA, theta).factor -
          lightComplexFactors(BETA, theta).energyFactor,
      );
    expect(at(Math.acos(BETA))).toBeGreaterThan(0.2);
    expect(at(Math.PI / 2)).toBeLessThan(1e-12);
  });
});

describe("the countermodel never enters SR-10's accepted outputs", () => {
  test("the output contract, the evaluation's results and the session snapshot omit it", () => {
    for (const id of COUNTERMODEL_IDS) expect(Object.hasOwn(SR10_OUTPUTS, id)).toBe(false);
    const ids = snapshotOutputs(SR10_DEFAULTS).map((r) => r.quantityId);
    const accepted = createSr10Session("sr10-countermodel").getSnapshot().accepted;
    const acceptedIds = accepted?.outputs.map((r) => r.quantityId) ?? [];
    expect(acceptedIds.length).toBeGreaterThan(0);
    for (const id of COUNTERMODEL_IDS) {
      expect(ids).not.toContain(id);
      expect(acceptedIds).not.toContain(id);
    }
  });

  test("it is returned beside them, under its model id, with the bead's value", () => {
    const comparison = sr10Comparison(SR10_DEFAULTS);
    expect(comparison.modelId).toBe("countermodel-material-contraction");
    const energy = comparison.results.find((r) => r.quantityId === "countermodelEnergyMoving");
    expect(energy?.status).toBe("value");
    if (energy?.status === "value" && typeof energy.value === "number") {
      // Defaults: 1 J at phi = 0 and 0.6c, so 0.2 J.
      expect(energy.value).toBeCloseTo(0.2, 12);
    }
    const outside = evaluateSr10({ beta: 1, propagationAngleDeg: 0 });
    expect(outside.countermodelComparison.results.length).toBe(0);
  });
});
