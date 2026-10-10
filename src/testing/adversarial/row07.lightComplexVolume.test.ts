/**
 * ROW 7: "A light complex contracts like material volume" (am-ver-adversarial-audit-1ef),
 * THE FIXTURE THE BEAD CORRECTED FROM THE PLAN.
 *
 * The packet's volume factor is 1/q with q = gamma(1 - beta cos theta), so it depends on the ray's
 * direction. A reader who reaches for length contraction gets 1/gamma at every angle.
 *
 * WHY THE PLAN'S ORIGINAL FIXTURE COULD NOT EXPOSE THE ERROR, which is the whole point of this row
 * and is preserved here verbatim in substance: the plan said to test a TRANSVERSE ray, but for a ray
 * transverse in the unprimed frame (theta = 90 degrees) q = gamma(1 - 0) = gamma, so 1/q = 1/gamma
 * and the two models agree exactly. A fixture at 90 degrees passes whichever model is used. That
 * coincidence is kept below as an explicit check rather than deleted, because a later author
 * reading only the corrected angles would not know why 90 is missing.
 *
 * Every number below was measured against the owner at beta = 0.6 before being written.
 */

import { expect, test } from "bun:test";
import {
  lightComplexFactors,
  lightComplexMaterialContractionCountermodel,
} from "../../physics/reference/waves.ts";
import { wrongLightComplexVolumeFactor } from "./wrongComputations.ts";

const BETA = 0.6;
const GAMMA = 1 / Math.sqrt(1 - BETA * BETA);
/** Material contraction, the wrong model's answer at every angle. */
const MATERIAL = 1 / GAMMA;

test("gamma and the material factor are the values this row reasons about", () => {
  expect(GAMMA).toBeCloseTo(1.25, 12);
  expect(MATERIAL).toBeCloseTo(0.8, 12);
});

test("THE THREE DISCRIMINATING ANGLES: the owner's volume factor differs from material contraction", () => {
  const cases = [
    { name: "theta = 0, ray along the boost", theta: 0, expected: 2 },
    { name: "theta = pi, ray against the boost", theta: Math.PI, expected: 0.5 },
    {
      name: "cos theta = beta, transverse in the MOVING frame",
      theta: Math.acos(BETA),
      expected: GAMMA,
    },
  ];
  for (const { name, theta, expected } of cases) {
    const factor = lightComplexFactors(BETA, theta).volumeFactor;
    expect(factor, name).toBeCloseTo(expected, 12);
    // Each is a genuine discrimination: the wrong model gives 0.8 here and the owner does not.
    expect(wrongLightComplexVolumeFactor(GAMMA)).toBeCloseTo(MATERIAL, 12);
    expect(factor, `${name} must differ from material contraction`).not.toBeCloseTo(MATERIAL, 6);
  }
});

test("THE COINCIDENCE, documented: at theta = 90 degrees the two models agree exactly", () => {
  // This is the plan's original fixture. It cannot expose the error, and that is the finding.
  const factor = lightComplexFactors(BETA, Math.PI / 2).volumeFactor;
  expect(factor).toBeCloseTo(MATERIAL, 12);
  expect(factor).toBeCloseTo(0.8, 12);
  // So a test written at 90 degrees alone would pass under the countermodel too:
  expect(lightComplexMaterialContractionCountermodel(BETA, Math.PI / 2).volumeFactor).toBeCloseTo(
    factor,
    12,
  );
});

test("the countermodel is angle-independent, which is the error stated as a property", () => {
  // Stronger than comparing one angle: the wrong model cannot depend on direction at all, and that
  // is what makes it wrong rather than merely inaccurate.
  const angles = [0, Math.PI / 4, Math.PI / 2, Math.acos(BETA), Math.PI];
  const counter = angles.map(
    (t) => lightComplexMaterialContractionCountermodel(BETA, t).volumeFactor,
  );
  for (const v of counter) expect(v).toBeCloseTo(MATERIAL, 12);
  // While the owner's factor takes four distinct values across those same angles.
  const owner = angles.map((t) => lightComplexFactors(BETA, t).volumeFactor);
  expect(new Set(owner.map((v) => v.toFixed(9))).size).toBeGreaterThanOrEqual(4);
});
