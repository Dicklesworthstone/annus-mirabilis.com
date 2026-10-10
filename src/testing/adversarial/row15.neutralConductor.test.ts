/**
 * ROW 15: "A neutral conductor with current violates |J/rho| < c" (am-ver-adversarial-audit-1ef),
 * AND THE CASE IS ACCEPTED.
 *
 * This row is the one whose correct outcome is an ACCEPTANCE rather than a refusal, which is why it
 * is worth having: a guard written as a ratio test rejects an ordinary piece of current-carrying
 * copper. The constraint on a four-current is the invariant (c*rho)^2 - |J|^2, whose sign says
 * whether it is timelike or spacelike; a neutral conductor is spacelike and perfectly physical.
 *
 * So the "wrong computation" here is a GATE, and its failure mode is a false refusal. AGENTS.md's
 * own words for why that matters: "A failed alternative must fail on a stated constraint or
 * observation", and a model refusal is not a numerical zero.
 */

import { expect, test } from "bun:test";
import { fourCurrentInvariants } from "../../physics/reference/fields.ts";
import { wrongChargeCurrentRatio } from "./wrongComputations.ts";

const C = 299792458;
const J = 1e6;

test("the owner ACCEPTS a neutral conductor carrying a current", () => {
  const out = fourCurrentInvariants(0, { x: J, y: 0, z: 0 });
  // A finite invariant, not a refusal and not a NaN.
  expect(Number.isFinite(out.si)).toBe(true);
  expect(out.si).toBeCloseTo(-(J ** 2), 6);
  // Negative means spacelike, which is what a current without net charge IS.
  expect(out.si).toBeLessThan(0);
});

test("the WRONG gate rejects it, and fails by dividing by the charge density", () => {
  const ratio = wrongChargeCurrentRatio(0, J);
  // Infinity, so any `ratio < c` test refuses an ordinary conductor.
  expect(Number.isFinite(ratio)).toBe(false);
  expect(ratio).toBe(Number.POSITIVE_INFINITY);
  expect(ratio < 1).toBe(false);
});

test("the invariant distinguishes timelike from spacelike, which the ratio cannot do at rho = 0", () => {
  // A charge at rest: timelike, positive invariant.
  const atRest = fourCurrentInvariants(1e-6, { x: 0, y: 0, z: 0 });
  expect(atRest.si).toBeGreaterThan(0);
  expect(atRest.si).toBeCloseTo((C * 1e-6) ** 2, 6);
  // And a current with a small charge density: still spacelike.
  const mostlyCurrent = fourCurrentInvariants(1e-18, { x: J, y: 0, z: 0 });
  expect(mostlyCurrent.si).toBeLessThan(0);
});

test("the gate is not merely imprecise at rho = 0, it is undefined there", () => {
  // Worth separating: a reader might think the ratio test just needs a tolerance. It needs a
  // different quantity. At any nonzero rho it returns a number, and at zero it returns Infinity,
  // so no tolerance recovers the accepted case.
  expect(Number.isFinite(wrongChargeCurrentRatio(1e-6, J))).toBe(true);
  expect(Number.isFinite(wrongChargeCurrentRatio(0, J))).toBe(false);
});
