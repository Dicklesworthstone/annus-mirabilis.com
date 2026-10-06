import assert from "node:assert/strict";
import test from "node:test";
import type { AcceptedSnapshot, ExperimentView } from "../store/instanceStore.ts";
import { createSessionWeave, weaveOutputs } from "./sessionSource.ts";
import type { WeavePredicate } from "./types.ts";

const predicate: WeavePredicate = {
  id: "test-threshold",
  instrumentId: "bm-01",
  meaning: "quantity-compared",
  conditions: [{ kind: "threshold", quantityId: "x", direction: "at-least", enter: 10, exit: 8 }],
  targets: ["s4-p6-s9"],
  pointerText: "The accepted output is in the selected range.",
};
const output = (value: number, quantityId = "x") => ({
  status: "value" as const,
  quantityId,
  value,
  unit: "1",
  semanticKind: "test-value",
  ownerId: "test-owner",
});
function accepted(value = 12, changes: Partial<AcceptedSnapshot> = {}): AcceptedSnapshot {
  return {
    experimentId: "bm-01",
    instanceId: "one",
    runId: "run-one",
    parentRunId: null,
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: { x: value },
    stepIndex: 1,
    simulationTime: 1,
    final: true,
    snapshotVersion: 1,
    outputs: [output(value)],
    ...changes,
  };
}
function view(a = accepted(), changes: Partial<ExperimentView> = {}): ExperimentView {
  return {
    status: "accepted",
    pending: false,
    requested: a,
    accepted: a,
    refusal: null,
    outcome: null,
    ...changes,
  };
}
function fixture(initial = view(), predicates: readonly WeavePredicate[] = [predicate]) {
  let current = initial;
  const observers = new Set<() => void>();
  const session = {
    getSnapshot: () => current,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      observers.add(listener);
      return () => {
        observers.delete(listener);
      };
    },
  };
  const source = createSessionWeave(session, {
    instrumentId: "bm-01",
    constantSetId: "modern-si-2019",
    predicates,
  });
  return {
    source,
    observers,
    emit: (next: ExperimentView) => {
      current = next;
      for (const listener of observers) listener();
    },
  };
}
function flag(f: ReturnType<typeof fixture>) {
  const state = f.source.getSnapshot();
  assert.equal(state.kind, "ready");
  assert.ok(state.kind === "ready");
  return state.derived.flags[predicate.id];
}

test("publishes a frozen projection of the exact accepted snapshot, not the draft", () => {
  const a = accepted(12);
  const f = fixture(view(a, { requested: { ...a, parameters: { x: -100 } } }));
  const s = f.source.getSnapshot();
  assert.equal(s.kind, "ready");
  assert.ok(s.kind === "ready");
  assert.equal(s.accepted, a);
  assert.equal(flag(f)?.lit, true);
  assert.equal(s.derived.runId, a.runId);
  assert.equal(s.derived.snapshotVersion, a.snapshotVersion);
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.derived.flags));
});
test("repeated reads and presentation-only updates do not advance hysteresis", () => {
  const a = accepted();
  const f = fixture(view(a));
  const first = f.source.getSnapshot();
  assert.equal(f.source.getSnapshot(), first);
  f.emit(view(a));
  const next = f.source.getSnapshot();
  assert.ok(first.kind === "ready" && next.kind === "ready");
  assert.equal(next.derived, first.derived);
  assert.equal(flag(f)?.state, "enter");
});
test("observes publications even when no render reads the intermediate entered state", () => {
  const f = fixture(view(accepted(5)));
  let notified = 0;
  const off = f.source.subscribe(() => notified++);
  f.emit(view(accepted(12, { snapshotVersion: 2 })));
  f.emit(view(accepted(9, { snapshotVersion: 3 })));
  assert.equal(flag(f)?.lit, true);
  assert.equal(flag(f)?.state, "hold");
  assert.equal(notified, 2);
  off();
});
test("run changes reset hysteresis and do not borrow a previous experiment's agreement", () => {
  const f = fixture();
  const off = f.source.subscribe(() => {});
  f.emit(view(accepted(9, { runId: "run-two", snapshotVersion: 2 })));
  assert.equal(flag(f)?.lit, false);
  off();
});
test("two independent sources with the same run and predicate ids never share hysteresis", () => {
  const left = fixture();
  const right = fixture(view(accepted(9)));
  assert.equal(flag(left)?.lit, true);
  assert.equal(flag(right)?.lit, false);
});
test("pending hides old pointers until the matching accepted result is published", () => {
  const a = accepted();
  const f = fixture(view(a));
  f.emit(view(a, { status: "pending", pending: true }));
  assert.deepEqual(f.source.getSnapshot(), { kind: "inactive", reason: "pending" });
  f.emit(view(accepted(9, { snapshotVersion: 2 })));
  assert.equal(flag(f)?.lit, true);
});
test("a superseded run or action cannot light an accepted result kept on screen", () => {
  for (const requested of [
    { ...accepted(), runId: "new-run" },
    { ...accepted(), actionIndex: 2 },
  ]) {
    const f = fixture(view(accepted(), { requested }));
    assert.deepEqual(f.source.getSnapshot(), { kind: "inactive", reason: "pending" });
  }
});
test("refusal clears pointers and their history without narrating scientific disagreement", () => {
  const a = accepted();
  const f = fixture(view(a));
  assert.equal(flag(f)?.lit, true);
  f.emit(view(a, { status: "refused" }));
  assert.deepEqual(f.source.getSnapshot(), { kind: "inactive", reason: "refused" });
  f.emit(view(accepted(9, { snapshotVersion: 2 })));
  assert.equal(flag(f)?.lit, false);
});
test("unavailable computation is distinct from absent output", () => {
  const f = fixture(view(accepted(), { status: "unavailable" }));
  assert.deepEqual(f.source.getSnapshot(), { kind: "inactive", reason: "unavailable" });
  const empty = fixture(view(accepted(), { accepted: null, requested: null, status: "idle" }));
  assert.deepEqual(empty.source.getSnapshot(), { kind: "inactive", reason: "no-result" });
});
test("a result from another instrument or instance is never evaluated", () => {
  for (const changes of [{ experimentId: "sr-03" }, { instanceId: "two" }]) {
    const f = fixture();
    f.emit(view(accepted(12, changes)));
    assert.deepEqual(f.source.getSnapshot(), { kind: "inactive", reason: "wrong-instance" });
  }
});
test("array-valued, absent, nonfinite and ambiguous outputs do not supply made-up scalars", () => {
  const cases = [
    [],
    [output(NaN)],
    [output(Infinity)],
    [output(12), output(15)],
    [{ ...output(12), value: { length: 1, at: () => 12, copy: () => new Float64Array([12]) } }],
  ];
  for (const outputs of cases) {
    const f = fixture(view(accepted(12, { outputs })));
    assert.equal(flag(f)?.lit, false);
    assert.equal(flag(f)?.state, "not-evaluable");
  }
});
test("typed outside-domain output remains available to a status predicate, never to arithmetic", () => {
  const raw = {
    ...output(12),
    status: "outside-domain" as const,
    condition: "test",
    domainKind: "model" as const,
    reason: "Outside the selected model.",
    boundary: { alternativeModel: "other" },
  };
  const a = accepted(12, { outputs: [raw] });
  assert.equal(weaveOutputs(a).x?.value, undefined);
  const p: WeavePredicate = {
    ...predicate,
    meaning: "outside-selected-domain",
    conditions: [{ kind: "status", quantityId: "x", equals: "outside-domain" }],
  };
  assert.equal(flag(fixture(view(a), [p]))?.lit, true);
  assert.equal(flag(fixture(view(a)))?.lit, false);
});
test("constant-set conditions use the binding identity, not input form text", () => {
  const p: WeavePredicate = {
    ...predicate,
    conditions: [{ kind: "regime", on: "constantSet", equals: "modern-si-2019" }],
  };
  assert.equal(flag(fixture(view(), [p]))?.lit, true);
  assert.equal(
    flag(
      fixture(view(), [
        { ...p, conditions: [{ kind: "regime", on: "constantSet", equals: "historical" }] },
      ]),
    )?.lit,
    false,
  );
});
test("server snapshot stays the prepared one after a live calculation", () => {
  const f = fixture();
  const served = f.source.getServerSnapshot();
  assert.ok(served.kind === "ready" && served.prepared);
  f.emit(view(accepted(15, { snapshotVersion: 2 })));
  const live = f.source.getSnapshot();
  assert.ok(live.kind === "ready" && !live.prepared);
  assert.equal(f.source.getServerSnapshot(), served);
});
test("one session subscription serves all listeners and closes after the last subscriber", () => {
  const f = fixture();
  const a = f.source.subscribe(() => {});
  const b = f.source.subscribe(() => {});
  assert.equal(f.observers.size, 1);
  a();
  assert.equal(f.observers.size, 1);
  b();
  assert.equal(f.observers.size, 0);
  const c = f.source.subscribe(() => {});
  assert.equal(f.observers.size, 1);
  c();
});
test("foreign predicates are not silently evaluated against this laboratory's output names", () => {
  const f = fixture(view(), [{ ...predicate, instrumentId: "sr-03" }]);
  const s = f.source.getSnapshot();
  assert.ok(s.kind === "ready");
  assert.deepEqual(Object.keys(s.derived.flags), []);
});
