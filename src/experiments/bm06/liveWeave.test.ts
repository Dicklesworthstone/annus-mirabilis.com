import assert from "node:assert/strict";
import test from "node:test";
import type { AcceptedSnapshot, ExperimentView, PublishedResult } from "../store/instanceStore.ts";
import { createWeaveEvaluator } from "../weave/evaluate.ts";
import { createSessionWeave, weaveOutputs } from "../weave/sessionSource.ts";
import { BM06_LIVE_WEAVE_PREDICATES } from "./liveWeave.ts";

const SOLUTION = "bm06-s4-solution";
const GRID = "bm06-s4-grid-agreement";
const scalar = (quantityId: string, value: number): PublishedResult => ({
  quantityId,
  value,
  status: "value",
  ownerId: "bm06.evaluate",
  unit: "1",
  semanticKind: "fixture",
});
const off = (quantityId: string): PublishedResult => ({
  quantityId,
  status: "not-applicable",
  ownerId: "bm06.evaluate",
  unit: "1",
  semanticKind: "fixture",
  reason: "The optional numerical grid is switched off.",
});
function snapshot(patch: Partial<AcceptedSnapshot> = {}): AcceptedSnapshot {
  return {
    experimentId: "bm-06",
    instanceId: "grid-a",
    runId: "run-a",
    parentRunId: null,
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: { t: 1, gridEnabled: false },
    stepIndex: 0,
    simulationTime: 1,
    final: true,
    snapshotVersion: 1,
    outputs: [
      {
        quantityId: "probabilityDensity",
        status: "value",
        unit: "1/m",
        semanticKind: "coordinate-density",
        ownerId: "diffusion.gaussianPropagator",
        value: Object.freeze({
          length: 81,
          at() {
            throw new Error("The weave must not read density samples");
          },
          copy() {
            throw new Error("The weave must not copy density samples");
          },
        }),
      },
      scalar("intervalProbability", 0.72),
      off("stabilityRatio"),
      off("wallContact"),
      off("maxCellMassDifference"),
    ],
    ...patch,
  };
}
function grid(difference: number, wall = 0, version = 1): AcceptedSnapshot {
  return snapshot({
    snapshotVersion: version,
    parameters: { t: 1, gridEnabled: true },
    outputs: [
      scalar("stabilityRatio", 0.25),
      scalar("wallContact", wall),
      scalar("maxCellMassDifference", difference),
    ],
  });
}
function evaluate(
  s: AcceptedSnapshot,
  evaluator = createWeaveEvaluator(BM06_LIVE_WEAVE_PREDICATES),
) {
  return evaluator.evaluate({
    runId: s.runId,
    snapshotVersion: s.snapshotVersion,
    outputs: weaveOutputs(s),
    constantSetId: "modern-si-2019",
    refused: false,
  });
}

test("the actual vector-valued density status can light the solution without sampling it", () => {
  const flags = evaluate(snapshot()).flags;
  assert.equal(flags[SOLUTION]?.lit, true);
  assert.equal(flags[SOLUTION]?.meaning, "quantity-compared");
  assert.equal(flags[GRID]?.lit, false);
});

test("the point distribution is not presented as a finite Gaussian density", () => {
  const s = snapshot({
    parameters: { t: 0, gridEnabled: false },
    simulationTime: 0,
    outputs: [
      {
        quantityId: "probabilityDensity",
        status: "analytic-limit",
        unit: "1/m",
        semanticKind: "coordinate-density",
        ownerId: "diffusion.gaussianPropagator",
        description: "A point mass",
        representation: { kind: "point-mass", location: 0, mass: 1 },
      },
      scalar("intervalProbability", 1),
    ],
  });
  assert.equal(evaluate(s).flags[SOLUTION]?.lit, false);
});

test("no epsilon silently removes a positive-time accepted solution", () => {
  const s = snapshot({ simulationTime: Number.MIN_VALUE, parameters: { t: Number.MIN_VALUE } });
  assert.equal(evaluate(s).flags[SOLUTION]?.lit, true);
});

test("missing interval probability is not an agreement", () => {
  const s = snapshot();
  const flags = evaluate({
    ...s,
    outputs: s.outputs.filter((o) => o.quantityId !== "intervalProbability"),
  }).flags;
  assert.equal(flags[SOLUTION]?.state, "not-evaluable");
  assert.equal(flags[SOLUTION]?.lit, false);
});

test("grid agreement enters, holds through its band, and exits strictly above it", () => {
  const evaluator = createWeaveEvaluator(BM06_LIVE_WEAVE_PREDICATES);
  assert.equal(evaluate(grid(0.001), evaluator).flags[GRID]?.state, "enter");
  assert.equal(evaluate(grid(0.0015, 0, 2), evaluator).flags[GRID]?.lit, true);
  assert.equal(evaluate(grid(0.002, 0, 3), evaluator).flags[GRID]?.lit, true);
  const exit = evaluate(grid(0.00200001, 0, 4), evaluator).flags[GRID];
  assert.equal(exit?.state, "exit");
  assert.equal(exit?.lit, false);
});

test("a fresh grid must meet the enter threshold, not merely the exit threshold", () => {
  assert.equal(evaluate(grid(0.0015)).flags[GRID]?.lit, false);
});

test("wall contact turns off agreement even when the reported difference is tiny", () => {
  const evaluator = createWeaveEvaluator(BM06_LIVE_WEAVE_PREDICATES);
  assert.equal(evaluate(grid(0.0001), evaluator).flags[GRID]?.lit, true);
  assert.equal(evaluate(grid(0.0001, 1, 2), evaluator).flags[GRID]?.lit, false);
  assert.equal(evaluate(grid(0.0001, 0.5, 3), evaluator).flags[GRID]?.lit, false);
});

test("a disabled grid cannot borrow other outputs to light a comparison", () => {
  const s = grid(0);
  const outputs = s.outputs.map((o) => (o.quantityId === "stabilityRatio" ? off(o.quantityId) : o));
  assert.equal(evaluate({ ...s, outputs }).flags[GRID]?.lit, false);
});

test("nonfinite and duplicate comparison values remain unusable", () => {
  assert.equal(evaluate(grid(Number.NaN)).flags[GRID]?.state, "not-evaluable");
  const s = grid(0);
  assert.equal(
    evaluate({ ...s, outputs: [...s.outputs, scalar("wallContact", 0)] }).flags[GRID]?.lit,
    false,
  );
});

test("a new run does not inherit the previous grid's hysteresis", () => {
  const evaluator = createWeaveEvaluator(BM06_LIVE_WEAVE_PREDICATES);
  evaluate(grid(0), evaluator);
  assert.equal(evaluate({ ...grid(0.0015), runId: "run-b" }, evaluator).flags[GRID]?.lit, false);
});

test("the live adapter hides pending and refused requests, then accepts a new publication", () => {
  const initial = snapshot();
  let view: ExperimentView = {
    status: "accepted",
    pending: false,
    requested: initial,
    accepted: initial,
    refusal: null,
    outcome: null,
  };
  const server = view;
  const subscribers = new Set<() => void>();
  const source = createSessionWeave(
    {
      getSnapshot: () => view,
      getServerSnapshot: () => server,
      subscribe(fn) {
        subscribers.add(fn);
        return () => {
          subscribers.delete(fn);
        };
      },
    },
    {
      instrumentId: "bm-06",
      constantSetId: "modern-si-2019",
      predicates: BM06_LIVE_WEAVE_PREDICATES,
    },
  );
  const unsubscribe = source.subscribe(() => {});
  assert.equal(source.getSnapshot().kind, "ready");
  const publish = (next: ExperimentView) => {
    view = next;
    for (const fn of subscribers) fn();
  };
  publish({ ...view, pending: true, status: "pending" });
  assert.deepEqual(source.getSnapshot(), { kind: "inactive", reason: "pending" });
  publish({ ...view, pending: false, status: "refused" });
  assert.deepEqual(source.getSnapshot(), { kind: "inactive", reason: "refused" });
  const next = snapshot({ snapshotVersion: 2 });
  publish({ ...view, status: "accepted", accepted: next, requested: next });
  const ready = source.getSnapshot();
  assert.equal(ready.kind, "ready");
  if (ready.kind === "ready") {
    assert.equal(ready.accepted, next);
    assert.equal(ready.derived.flags[SOLUTION]?.lit, true);
    assert.equal(ready.prepared, false);
  }
  unsubscribe();
  assert.equal(subscribers.size, 0);
});
