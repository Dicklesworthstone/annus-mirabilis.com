/**
 * ROW 2: "A radial distribution is an ordinary Gaussian" (am-ver-adversarial-audit-1ef).
 *
 * The 2D radial density is p_r(r,t) = r/(2Dt) e^{-r^2/(4Dt)}. The factor r is the growing
 * circumference of available positions, and a reader who writes the familiar Gaussian in r drops
 * it. The result still looks like a distribution -- positive, peaked, decaying -- so the row checks
 * NORMALIZATION and BOTH MOMENTS, as the bead specifies, rather than one of them: each fails on its
 * own, and a single check could not say which property was lost.
 */

import { expect, test } from "bun:test";
import { moments, radialPropagator2d } from "../../physics/reference/diffusion/distributions.ts";
import {
  correctRadialDensity,
  wrongRadialDensity,
  wrongRadialMeanRadius,
  wrongRadialSecondMoment,
} from "./wrongComputations.ts";

const D = 2e-13;
const T = 1;

/** Asserts the status, for the handful of points a test reasons about by name. */
const value = (e: { result: { status: string; value?: unknown } }) => {
  expect(e.result.status).toBe("value");
  return e.result.status === "value" ? (e.result.value as number) : Number.NaN;
};
/**
 * Reads a value WITHOUT asserting, for the 200,000 points inside the integrator.
 *
 * The first version of this file called `value` in the integration loop and reported 200,018
 * expect() calls for four tests. An assertion count that large is not diligence: it hides how many
 * distinct claims the file makes, and this repository reads expect() counts as evidence of what a
 * suite examined. A NaN here would surface as a failed integral anyway.
 */
const plain = (e: { result: { status: string; value?: unknown } }) =>
  e.result.status === "value" ? (e.result.value as number) : Number.NaN;

/** Trapezoid over [0, far), far enough that the tail is negligible at this scale. */
function integrate(f: (r: number) => number): number {
  const far = 12 * Math.sqrt(2 * D * T);
  const steps = 200_000;
  const h = far / steps;
  let sum = (f(0) + f(far)) / 2;
  for (let i = 1; i < steps; i++) sum += f(i * h);
  return sum * h;
}

test("the owner's radial density normalizes to one over r >= 0", () => {
  expect(integrate((r) => plain(radialPropagator2d(r, T, D)))).toBeCloseTo(1, 4);
  // And the closed form this row compares against agrees with the owner pointwise.
  const r = Math.sqrt(2 * D * T);
  expect(value(radialPropagator2d(r, T, D))).toBeCloseTo(correctRadialDensity(r, T, D), 0);
});

test("the WRONG density fails normalization, and fails by exactly one half", () => {
  // The naive Gaussian in r integrates to 1/2 over r >= 0, because it is the full-line density
  // restricted to one side. That is the first of the three failures the row names.
  expect(integrate((r) => wrongRadialDensity(r, T, D))).toBeCloseTo(0.5, 4);
});

test("the WRONG density fails both moments, each in its own stated way", () => {
  const m = moments(2, D, T);
  const secondMoment = value(m.total);
  const meanRadius = value(m.meanRadius);

  // The owner: <r^2> = 4Dt and <r> = sqrt(pi D t), both measured.
  expect(secondMoment).toBeCloseTo(4 * D * T, 18);
  expect(meanRadius).toBeCloseTo(Math.sqrt(Math.PI * D * T), 12);

  // The wrong density implies 2Dt and 2 sqrt(Dt/pi): a factor of two in the second moment, and a
  // different constant in the first. Neither is the owner's.
  expect(wrongRadialSecondMoment(D, T)).not.toBeCloseTo(secondMoment, 18);
  expect(secondMoment / wrongRadialSecondMoment(D, T)).toBeCloseTo(2, 12);
  expect(wrongRadialMeanRadius(D, T)).not.toBeCloseTo(meanRadius, 12);
  expect(meanRadius / wrongRadialMeanRadius(D, T)).toBeCloseTo(Math.PI / 2, 12);
});

test("the rms radius is NOT the mean radius, so the two moments are genuinely separate checks", () => {
  // Without this the row could pass while conflating them, which is the same family of error.
  const m = moments(2, D, T);
  expect(value(m.rmsRadius)).toBeCloseTo(Math.sqrt(4 * D * T), 12);
  expect(value(m.rmsRadius)).not.toBeCloseTo(value(m.meanRadius), 8);
});
