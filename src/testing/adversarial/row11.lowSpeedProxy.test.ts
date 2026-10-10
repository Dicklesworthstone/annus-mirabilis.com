/**
 * ROW 11: "The low-speed proxy is the exact mass coefficient at every speed"
 * (am-ver-adversarial-audit-1ef).
 *
 * `2L(gamma - 1)/v^2` is what a reader computes from the paper's own quantities at a finite speed,
 * and it looks like the coefficient. It tends to L/c^2 only as v -> 0. The owner keeps the two
 * apart by TYPE as well as by value: the proxy is a `value`, the coefficient is an
 * `analytic-limit`, which is AGENTS.md's typed-result rule doing the work a numeric comparison
 * alone would not.
 */

import { expect, test } from "bun:test";
import { finiteSpeedProxy, limitingCoefficient } from "../../physics/reference/massEnergy.ts";
import { wrongMassCoefficientFromProxy } from "./wrongComputations.ts";

const L = 1;
const C = 299792458;
const BETA = 0.6;

test("the proxy and the coefficient are different KINDS of result, not just different numbers", () => {
  const proxy = finiteSpeedProxy(L, BETA);
  const limit = limitingCoefficient(L);
  expect(proxy.status).toBe("value");
  // The coefficient is a limit, so a test that only compared numbers would miss that the proxy
  // cannot be the coefficient at any finite speed whatever it evaluates to.
  expect(limit.status).toBe("analytic-limit");
});

test("the WRONG computation fails on the coefficient's value, by the stated excess", () => {
  const proxy = finiteSpeedProxy(L, BETA);
  const limit = limitingCoefficient(L);
  if (proxy.status !== "value" || limit.status !== "analytic-limit") throw new Error("owner shape");
  const representation = limit.representation as { value?: number };
  const exact = representation.value ?? Number.NaN;

  const wrong = wrongMassCoefficientFromProxy(proxy.value as number);
  expect(wrong).not.toBeCloseTo(exact, 20);
  // Measured against the real owner: the proxy at 0.6c is 1.388889 L/c^2, the coefficient L/c^2.
  expect((proxy.value as number) / (L / C ** 2)).toBeCloseTo(1.388889, 6);
  expect(exact).toBeCloseTo(L / C ** 2, 20);
  /**
   * THE EXCESS, AND A CORRECTION TO HOW THE ROW STATES IT.
   *
   * The bead says the proxy "approaches L/c^2 only as v -> 0, with excess about (3/4)(v/c)^2".
   * That is the LEADING-ORDER term and it is a small-beta statement. Checked at beta = 0.6 it is
   * wrong: measured against the owner the excess is 0.388889, while (3/4)(0.6)^2 = 0.27. My first
   * version of this assertion used the asymptotic form at 0.6c and failed, which is the fixture
   * failing for the wrong reason -- the thing this bead exists to prevent.
   *
   * So the finite speed is pinned at its measured value, and the asymptotic form is checked where
   * it is actually claimed, at small beta, below.
   */
  expect(wrong / exact - 1).toBeCloseTo(0.3888888888888888, 12);
});

test("the proxy converges to the coefficient as the speed falls, so it is a proxy and not nonsense", () => {
  // Without this the row would read as "the proxy is simply wrong", which is not the claim.
  const limit = limitingCoefficient(L);
  if (limit.status !== "analytic-limit") throw new Error("owner shape");
  const exact = (limit.representation as { value?: number }).value ?? Number.NaN;
  const slow = finiteSpeedProxy(L, 1e-4);
  if (slow.status !== "value") throw new Error("owner shape");
  expect((slow.value as number) / exact - 1).toBeLessThan(1e-7);
});

test("the (3/4)(v/c)^2 excess holds where the row claims it, as v -> 0", () => {
  const limit = limitingCoefficient(L);
  if (limit.status !== "analytic-limit") throw new Error("owner shape");
  const exact = (limit.representation as { value?: number }).value ?? Number.NaN;
  // The leading-order form is asymptotic, so it is checked at decreasing speeds and must get
  // BETTER, not merely be close once. A single small-beta check could pass on a coincidence.
  const ratios = [0.2, 0.1, 0.05].map((beta) => {
    const proxy = finiteSpeedProxy(L, beta);
    if (proxy.status !== "value") throw new Error("owner shape");
    const excess = (proxy.value as number) / exact - 1;
    return Math.abs(excess / (0.75 * beta ** 2) - 1);
  });
  expect(ratios[0]).toBeGreaterThan(ratios[1] as number);
  expect(ratios[1]).toBeGreaterThan(ratios[2] as number);
  expect(ratios[2]).toBeLessThan(0.02);
});
