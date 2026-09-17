import { describe, expect, test } from "bun:test";
import { BM05_OUTPUTS, BM05_WEAVE_PREDICATES } from "../experiments/bm05/definition.ts";
import { dkwBound, kolmogorovShapeTerm } from "../physics/reference/diffusion/walkLaws.ts";
import { createWeaveEvaluator } from "../experiments/weave/evaluate.ts";
import type { WeaveSnapshotView } from "../experiments/weave/types.ts";
import { validateWeavePredicate } from "../experiments/weave/validate.ts";

/**
 * am-bm-05-random-steps-ntzl's own test plan (bm05.weave.integration.test.ts): "with the weave's
 * real compiler pass and evaluator on scripted accepted snapshots ... the predicate validates
 * ... enters at a distance of 0.0630 and holds at 0.0660 ... then exits at 0.0700; W=399 leaves
 * it unlit as not-evaluable; removing the shape-term output from the manifest fails validation."
 * This is that test, now that the real weave (am-read-result-weave-jex) exists.
 */
const CTX = {
  instrumentOutputIds: new Set(Object.keys(BM05_OUTPUTS)),
  resolvableTargetIds: new Set(["s4-second-moment"]),
};

function snapshot(
  runId: string,
  snapshotVersion: number,
  overrides: Readonly<{ distance?: number; walkerCount?: number; shapeTerm?: number }> = {},
): WeaveSnapshotView {
  const outputs: Record<string, { quantityId: string; status: "value"; value: number }> = {};
  const set = (quantityId: string, value: number | undefined) => {
    if (value !== undefined) outputs[quantityId] = { quantityId, status: "value", value };
  };
  set("kolmogorovDistance", overrides.distance);
  set("walkerCount", overrides.walkerCount ?? 2000);
  set("shapeTerm", overrides.shapeTerm ?? kolmogorovShapeTermAt400());
  return { runId, snapshotVersion, outputs, refused: false };
}

function kolmogorovShapeTermAt400(): number {
  const shape = kolmogorovShapeTerm("coin", 400);
  if (shape.kind !== "accepted") throw new Error("expected an accepted shape term");
  return shape.data.distance;
}

describe("BM-05 weave predicate bm05-s4-second-moment (real compiler pass and evaluator)", () => {
  test("validates against the real weave contract", () => {
    const predicate = BM05_WEAVE_PREDICATES[0];
    const validated = validateWeavePredicate(predicate, CTX);
    expect(validated.id).toBe("bm05-s4-second-moment");
    expect(validated.instrumentId).toBe("bm-05");
    expect(validated.meaning).toBe("agreement-within-stated-bound");
  });

  test("removing the shape-term output from the instrument's declared outputs fails validation", () => {
    const predicate = BM05_WEAVE_PREDICATES[0];
    const withoutShapeTerm = {
      instrumentOutputIds: new Set(
        [...CTX.instrumentOutputIds].filter((id) => id !== "shapeTerm"),
      ),
      resolvableTargetIds: CTX.resolvableTargetIds,
    };
    expect(() => validateWeavePredicate(predicate, withoutShapeTerm)).toThrow(
      /weave-condition-quantity-not-output/,
    );
  });

  test("the bead's own scripted sequence: enters at 0.0630, holds at 0.0660, exits at 0.0700, all at W=2000 coin/n=400", () => {
    const predicate = validateWeavePredicate(BM05_WEAVE_PREDICATES[0], CTX);
    const evaluator = createWeaveEvaluator([predicate]);

    const entering = evaluator.evaluate(snapshot("run-1", 1, { distance: 0.063 }));
    expect(entering.flags["bm05-s4-second-moment"]?.lit).toBe(true);
    expect(entering.flags["bm05-s4-second-moment"]?.state).toBe("enter");

    const holding = evaluator.evaluate(snapshot("run-1", 2, { distance: 0.066 }));
    expect(holding.flags["bm05-s4-second-moment"]?.lit).toBe(true);
    expect(holding.flags["bm05-s4-second-moment"]?.state).toBe("hold");

    const exiting = evaluator.evaluate(snapshot("run-1", 3, { distance: 0.07 }));
    expect(exiting.flags["bm05-s4-second-moment"]?.lit).toBe(false);
    expect(exiting.flags["bm05-s4-second-moment"]?.state).toBe("exit");
  });

  test("W = 399 (below the minimum sample size) leaves the predicate unlit as not-evaluable", () => {
    const predicate = validateWeavePredicate(BM05_WEAVE_PREDICATES[0], CTX);
    const evaluator = createWeaveEvaluator([predicate]);
    const result = evaluator.evaluate(snapshot("run-2", 1, { distance: 0.02, walkerCount: 399 }));
    expect(result.flags["bm05-s4-second-moment"]?.lit).toBe(false);
    expect(result.flags["bm05-s4-second-moment"]?.state).toBe("not-evaluable");
  });

  test("a typed refusal leaves the predicate unlit regardless of the underlying numbers", () => {
    const predicate = validateWeavePredicate(BM05_WEAVE_PREDICATES[0], CTX);
    const evaluator = createWeaveEvaluator([predicate]);
    const result = evaluator.evaluate({
      runId: "run-3",
      snapshotVersion: 1,
      outputs: {
        kolmogorovDistance: { quantityId: "kolmogorovDistance", status: "value", value: 0.001 },
        walkerCount: { quantityId: "walkerCount", status: "value", value: 2000 },
        shapeTerm: { quantityId: "shapeTerm", status: "value", value: 0 },
      },
      refused: true,
    });
    expect(result.flags["bm05-s4-second-moment"]?.lit).toBe(false);
    expect(result.flags["bm05-s4-second-moment"]?.state).toBe("not-evaluable");
  });

  test("the bead's stated enter/exit bounds (0.0635 / 0.0697) reproduce from the real owner functions, independent of the evaluator", () => {
    const shape = kolmogorovShapeTerm("coin", 400);
    if (shape.kind !== "accepted") throw new Error("expected an accepted shape term");
    const enterDkw = dkwBound(2000, 1e-3);
    const exitDkw = dkwBound(2000, 1e-4);
    if (enterDkw.kind !== "accepted" || exitDkw.kind !== "accepted")
      throw new Error("expected accepted DKW bounds");
    expect(shape.data.distance + enterDkw.data).toBeCloseTo(0.0635, 3);
    expect(shape.data.distance + exitDkw.data).toBeCloseTo(0.0697, 3);
  });
});
