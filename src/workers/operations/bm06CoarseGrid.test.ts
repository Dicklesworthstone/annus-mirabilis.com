/**
 * BM-06 AT THE COARSE CELL WIDTHS THE READER IS SENT TO (am-xry2).
 *
 * The defect this guards: with the grid on at 101 cells and t = 1 s, dx near 1 um ended in
 * `invariant-violation`, because a cell fifty widths from the start has an unbounded-Gaussian
 * probability below the smallest normal binary64 number, `intervalProbability` reports it as not a
 * value, and the whole analytic comparison refused. 0.927 um is exactly the width the page's own
 * "Use a coarser spatial grid." offers, so a reader who followed the instrument's advice met a
 * second failure. Fixed in 46e87fcc; `bm06Repairs.test.ts` guards that every offered repair is
 * accepted, at steps 1 and 10.
 *
 * This file guards the other half of the bead's acceptance, which that sweep does not reach: the
 * same widths at 250 steps, where the reported failure was measured, and the branch in
 * `ftcsAnalyticComparison` that makes them pass.
 *
 * WHICH HALF OF THAT BRANCH IS ANSWERED HERE. The branch records 0 for a cell only when
 * `farTailBound` proves the exact probability is below 2^-1022, and refuses for any other
 * unrepresentable cell, so that no zero is fabricated. Only the first half is asserted, because the
 * second is not reachable through this evaluator: measured over the nearer edge z in [20, 32] in
 * units of 2 sqrt(D t), the probability is still a value at z = 26.5 where the bound is 5.2e-306,
 * and by z = 27, where it first reports `outside-domain`, the bound is already 1.25e-317. A finer
 * search at 0.005 across the crossing window found no z where the probability underflows while the
 * bound does not. The refusal therefore stands as a guard over a path nothing currently takes, and
 * asserting it here would assert nothing.
 */
import { describe, expect, test } from "bun:test";
import { BM06_DEFAULTS } from "../../experiments/bm06/definition.ts";
import { ftcsAnalyticComparison } from "../../physics/reference/diffusion/ftcs.ts";
import { evaluateBm06 } from "./bm06.ts";

/** The widths the bead names, including the one the page's own repair sets. */
const COARSE_WIDTHS = [0.927e-6, 1e-6, 2e-6] as const;

describe("BM-06's grid at coarse cell widths", () => {
  test("the widths that ended in invariant-violation are accepted at 250 steps", async () => {
    for (const dx of COARSE_WIDTHS) {
      const result = await evaluateBm06({
        ...BM06_DEFAULTS,
        gridEnabled: true,
        n: 101,
        t: 1,
        steps: 250,
        dx,
      });
      const verdict =
        result.kind === "outcome"
          ? `outcome ${(result.outcome as { outcome?: string }).outcome}`
          : result.kind;
      expect([`dx=${dx}`, verdict]).toEqual([`dx=${dx}`, "accepted"]);
    }
    // The bead's other measured failure: a long run on a fine grid.
    const long = await evaluateBm06({
      ...BM06_DEFAULTS,
      gridEnabled: true,
      n: 4097,
      t: 1,
      steps: 900,
      dx: 1e-7,
    });
    expect(long.kind).toBe("accepted");
    console.log(
      `[bm06 coarse grid] ${COARSE_WIDTHS.length} widths at 101 cells and 250 steps, plus 4097 cells at 900 steps: all accepted`,
    );
  });

  test("a far cell whose probability underflows records a correctly rounded zero, not a refusal", () => {
    // 101 cells of 1 um with the start at the middle: cell 0 is fifty widths out, which at
    // D = 4.29e-13 m^2/s and t = 1 s is about 27 times 2 sqrt(D t).
    const dx = 1e-6;
    const field = new Float64Array(101);
    field[50] = 1 / dx;
    const comparison = ftcsAnalyticComparison({ field, dx, t: 1, D: 4.29e-13, startCell: 50 });
    if (comparison.kind !== "accepted")
      throw new Error(`the comparison refused: ${JSON.stringify(comparison).slice(0, 200)}`);
    const probabilities = comparison.data.cellProbabilities;
    // The far cells are exactly zero, and they are the ones the branch spoke for.
    expect(probabilities[0]).toBe(0);
    expect(probabilities[probabilities.length - 1]).toBe(0);
    // Non-vacuity, and the reason the recorded zero is harmless: the central cells hold the mass,
    // so nothing here is a comparison over an empty population.
    const central = probabilities[50];
    if (central === undefined) throw new Error("no central cell");
    // Measured, not assumed: one micron of cell at the middle holds 0.4107 of the mass at these
    // settings, and it is the largest cell. A guess of "more than half" failed here, which is the
    // reason this reads as a property and a measured floor rather than a round number.
    expect(central).toBeGreaterThan(0.4);
    expect(central).toBe(Math.max(...probabilities));
    const inside = comparison.data.analyticMassInsideBox;
    expect(inside).toBeGreaterThan(0.99);
    expect(inside).toBeLessThanOrEqual(1);
    console.log(
      `[bm06 coarse grid] 101 cells of 1 um: cell 0 and cell 100 recorded as 0, central cell ${central.toFixed(4)}, analytic mass inside the box ${inside.toFixed(12)}`,
    );
  });
});
