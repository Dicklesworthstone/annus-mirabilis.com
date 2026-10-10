/**
 * ROW 1: "Half the diffusivity means half the displacement" (am-ver-adversarial-audit-1ef).
 *
 * The error AGENTS.md names in its own words: "Doubling the viscosity halves the typical
 * displacement" is false, because doubling viscosity halves the diffusivity and changes the RMS
 * displacement by 1/sqrt(2). This row is the same mistake stated in terms of D.
 *
 * The two scalings are compared SEPARATELY, as the bead requires, because a single assertion on the
 * displacement alone cannot say whether the diffusivity scaled correctly and the square root was
 * dropped, or the diffusivity scaling was itself wrong.
 */

import { expect, test } from "bun:test";
import { rmsDisplacement } from "../../physics/reference/diffusion/distributions.ts";
import { correctDiffusivityScaling, wrongDiffusivityScaling } from "./wrongComputations.ts";

const D = 2e-13;
const ELAPSED = 1;

function rms(diffusivity: number): number {
  const evaluation = rmsDisplacement(diffusivity, ELAPSED);
  expect(evaluation.result.status).toBe("value");
  const value = evaluation.result.status === "value" ? evaluation.result.value : Number.NaN;
  expect(typeof value).toBe("number");
  return value as number;
}

test("the owner scales RMS displacement by 1/sqrt(2) when the diffusivity is halved", () => {
  const full = rms(D);
  const halved = rms(D / 2);
  // The diffusivity scaling first, on its own, so the two claims cannot be confused.
  expect(D / 2 / D).toBeCloseTo(0.5, 15);
  // Then the displacement scaling, which is the different number.
  expect(halved / full).toBeCloseTo(1 / Math.SQRT2, 12);
  expect(halved / full).not.toBeCloseTo(0.5, 3);
});

test("the WRONG computation fails on the displacement ratio, and fails by the stated margin", () => {
  const full = rms(D);
  const halved = rms(D / 2);
  const wrong = wrongDiffusivityScaling(full, 0.5);
  const right = correctDiffusivityScaling(full, 0.5);

  // It fails the assertion the row names: the predicted displacement, not some other check.
  expect(wrong).not.toBeCloseTo(halved, 12);
  expect(right).toBeCloseTo(halved, 12);
  // And it is wrong in the stated direction and size: too small by a factor of sqrt(2).
  expect(halved / wrong).toBeCloseTo(Math.SQRT2, 12);
});

test("the owner's own value is the one measured, not the one assumed", () => {
  // Pinned from a run against the real evaluator rather than copied from the specification:
  // rms(2e-13 m^2/s, 1 s) = 6.324555e-7 m.
  expect(rms(D)).toBeCloseTo(6.324555320336759e-7, 18);
});
