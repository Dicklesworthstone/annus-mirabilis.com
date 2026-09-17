import { describe, expect, test } from "bun:test";
import { BM05_OUTPUTS, BM05_WEAVE_PREDICATES } from "../experiments/bm05/definition.ts";
import { dkwBound, kolmogorovShapeTerm } from "../physics/reference/diffusion/walkLaws.ts";

/**
 * am-bm-05-random-steps-ntzl: "the weave predicates do not exist" -- same gap and same honesty
 * caveat as BM-06's (src/testing/bm06Weave.test.ts): am-read-result-weave-jex, the compiler and
 * evaluator bm05-s4-second-moment must validate against, does not exist yet. This is a
 * structural test over declared data plus a numeric cross-check against the real owner
 * functions the bead's own text cites (kolmogorovShapeTerm, dkwBound) -- it does not run the
 * predicate through a real weave pass.
 */
describe("BM-05 weave predicate declaration (data only, no real weave compiler exists yet)", () => {
  test("bm05-s4-second-moment is declared with a single agreement condition", () => {
    expect(BM05_WEAVE_PREDICATES).toHaveLength(1);
    const predicate = BM05_WEAVE_PREDICATES[0];
    expect(predicate?.id).toBe("bm05-s4-second-moment");
    expect(predicate?.conditions).toHaveLength(1);
    expect(predicate?.conditions[0]?.kind).toBe("agreement");
  });

  test("the statistic and offset outputs it names are real, already-published BM05_OUTPUTS keys", () => {
    const condition = BM05_WEAVE_PREDICATES[0]?.conditions[0];
    if (!condition || condition.kind !== "agreement")
      throw new Error("expected an agreement condition");
    expect(Object.hasOwn(BM05_OUTPUTS, condition.statisticOutputId)).toBe(true);
    expect(Object.hasOwn(BM05_OUTPUTS, condition.offsetOutputId)).toBe(true);
    expect(condition.statisticOutputId).toBe("kolmogorovDistance");
    expect(condition.offsetOutputId).toBe("shapeTerm");
    // walkers is a parameter (Bm05Parameters.walkers), never a BM05_OUTPUTS key -- documented
    // in the definition.ts comment beside the declaration.
    expect(Object.hasOwn(BM05_OUTPUTS, condition.sampleCountField)).toBe(false);
    expect(condition.sampleCountField).toBe("walkers");
    expect(condition.minimumSampleCount).toBe(400);
    expect(condition.boundFamily).toBe("dkw");
  });

  test("the bead's own stated enter/exit numbers for the coin kernel at n=400, W=2000 reproduce from the real owner functions", () => {
    const condition = BM05_WEAVE_PREDICATES[0]?.conditions[0];
    if (!condition || condition.kind !== "agreement")
      throw new Error("expected an agreement condition");
    const shape = kolmogorovShapeTerm("coin", 400);
    if (shape.kind !== "accepted") throw new Error("expected an accepted shape term");
    const enterDkw = dkwBound(2000, condition.alphaEnter);
    const exitDkw = dkwBound(2000, condition.alphaExit);
    if (enterDkw.kind !== "accepted" || exitDkw.kind !== "accepted")
      throw new Error("expected accepted DKW bounds");
    const enterBound = shape.data.distance + enterDkw.data;
    const exitBound = shape.data.distance + exitDkw.data;
    // Bead text: "enter ... at or below 0.019935 + 0.043592 = 0.0635"; "exit ... 0.0498 at W=2000"
    // combined with the shape term reads 0.019935 + 0.049758 = 0.0697.
    expect(shape.data.distance).toBeCloseTo(0.019935, 5);
    expect(enterDkw.data).toBeCloseTo(0.043592, 5);
    expect(exitDkw.data).toBeCloseTo(0.049758, 5);
    expect(enterBound).toBeCloseTo(0.0635, 3);
    expect(exitBound).toBeCloseTo(0.0697, 3);
    expect(enterBound).toBeLessThan(exitBound);
  });

  test("declarations are frozen data, not executable predicates", () => {
    for (const predicate of BM05_WEAVE_PREDICATES) {
      expect(Object.isFrozen(predicate)).toBe(true);
      expect(Object.isFrozen(predicate.conditions)).toBe(true);
      expect(typeof (predicate as unknown as { evaluate?: unknown }).evaluate).not.toBe("function");
    }
  });
});
