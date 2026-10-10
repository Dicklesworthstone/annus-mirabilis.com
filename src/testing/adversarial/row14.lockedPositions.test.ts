/**
 * ROW 14: "The locked-position probability is f^n" (am-ver-adversarial-audit-1ef).
 *
 * For n PERFECTLY LOCKED positions, all at the same place, the probability that all lie in a
 * subvolume of fraction f is f, not f^n. f^n is the answer for n INDEPENDENT positions, and it is
 * the right answer to a different question -- which is exactly what makes the error plausible:
 * the formula is correct, the premise is not.
 */

import { expect, test } from "bun:test";
import { lockedPositionsProbability } from "../../physics/reference/radiation/configurationCounts.ts";
import { wrongLockedPositionsProbability } from "./wrongComputations.ts";

test("the owner gives f for every n, because locked positions are one position", () => {
  for (const n of [1, 3, 10, 1000]) {
    expect(lockedPositionsProbability(n, 0.5).value, `n = ${n}`).toBeCloseTo(0.5, 15);
  }
  expect(lockedPositionsProbability(3, 0.1).value).toBeCloseTo(0.1, 15);
});

test("the WRONG computation fails on the probability, and collapses as n grows", () => {
  const f = 0.5;
  expect(wrongLockedPositionsProbability(1, f)).toBeCloseTo(f, 15);
  // At n = 1 the two agree, which is why a fixture at n = 1 would prove nothing.
  for (const n of [3, 10]) {
    const owner = lockedPositionsProbability(n, f).value;
    const wrong = wrongLockedPositionsProbability(n, f);
    expect(wrong, `n = ${n}`).not.toBeCloseTo(owner, 3);
    expect(wrong).toBeLessThan(owner);
  }
  expect(wrongLockedPositionsProbability(10, f)).toBeCloseTo(9.765625e-4, 10);
});

test("n = 1 is the degenerate case, documented so nobody tests there", () => {
  // The same shape as row 7's 90-degree coincidence: a fixture at n = 1 passes under both models.
  expect(lockedPositionsProbability(1, 0.3).value).toBeCloseTo(
    wrongLockedPositionsProbability(1, 0.3),
    15,
  );
});

test("the owner declares the probability independent of n, as a property", () => {
  // Stronger than any pair of values: the result must not vary with n at all.
  const values = [1, 2, 5, 50].map((n) => lockedPositionsProbability(n, 0.42).value);
  expect(new Set(values).size).toBe(1);
  expect(values[0]).toBeCloseTo(0.42, 15);
});
