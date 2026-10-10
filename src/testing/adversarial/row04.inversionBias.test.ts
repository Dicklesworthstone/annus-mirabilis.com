/**
 * ROW 4: "An unbiased estimate stays unbiased after inversion" (am-ver-adversarial-audit-1ef).
 *
 * E[1/X] is not 1/E[X]. For a chi-square diffusivity estimate with q degrees of freedom the inverse
 * carries q/(q - 2): the row states 1.25 at q = 10, and the owner gives exactly that.
 *
 * The owner also REFUSES rather than returning a number where the expectation does not exist, which
 * is AGENTS.md's typed-result rule doing work no numeric comparison would: at q <= 2 there is no
 * finite mean to be biased about.
 */

import { expect, test } from "bun:test";
import { inverseBias } from "../../physics/reference/inference.ts";
import { wrongInversionMeanFactor } from "./wrongComputations.ts";

function factors(q: number, normalization = q) {
  const out = inverseBias(q, normalization);
  expect(out.kind).toBe("accepted");
  if (out.kind !== "accepted") throw new Error("owner refused");
  return out.data;
}

test("the owner's mean factor is q/(q-2), which is 1.25 at q = 10", () => {
  expect(factors(10).meanFactor).toBeCloseTo(1.25, 12);
  expect(factors(10).meanFactor).toBeCloseTo(10 / (10 - 2), 12);
  expect(factors(5).meanFactor).toBeCloseTo(5 / 3, 12);
});

test("the WRONG computation fails on the mean factor, by the stated 25 percent at q = 10", () => {
  const owner = factors(10).meanFactor;
  expect(wrongInversionMeanFactor()).not.toBeCloseTo(owner, 6);
  expect(owner / wrongInversionMeanFactor() - 1).toBeCloseTo(0.25, 12);
});

test("the bias grows as the degrees of freedom fall, so it is not a fixed correction", () => {
  // A single q could be mistaken for a constant factor to divide out. It is not.
  const trend = [20, 10, 5, 3].map((q) => factors(q).meanFactor);
  for (let i = 1; i < trend.length; i++) {
    expect(trend[i] as number).toBeGreaterThan(trend[i - 1] as number);
  }
  expect(factors(3).meanFactor).toBeCloseTo(3, 12);
});

test("the owner REFUSES where the expectation does not exist, instead of returning a number", () => {
  for (const q of [2, 1, 0.5]) {
    const out = inverseBias(q, q);
    expect(out.kind).not.toBe("accepted");
  }
  // And the variance factor is withheld separately, at q <= 4, where the mean still exists.
  expect(factors(4).varianceFactor).toBeNull();
  expect(factors(10).varianceFactor).not.toBeNull();
});
