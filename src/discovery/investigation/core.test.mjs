import assert from "node:assert/strict";
import test from "node:test";
import {
  INVESTIGATION_LIMITS,
  changedInvestigationParameters,
  createInvestigationStore,
  exportInvestigationHtml,
  exportInvestigationJson,
  readInvestigationEvidence,
} from "./core.ts";
import { INVESTIGATIONS } from "./specs.ts";

// Boundary fixtures are accepted-view shapes, not physics calculations or empirical observations.
const spec = INVESTIGATIONS["brownian-motion"];
const task = {
  promptId: spec.promptId,
  task: "What happens to the spread?",
  perturbPrompt: "Change only radius.",
  explainPrompt: "Explain the change and the model's limits.",
};
const revisions = () => ({ input: 1, observer: 0, measurement: 0, estimator: 0 });
function view(patch = {}) {
  const parameters = { T: 290.15, eta: 0.00135, a: 5e-7, seed: "18446744073709551615" };
  const identity = {
    experimentId: "bm-01",
    instanceId: "placement-A",
    runId: "run-1",
    actionIndex: 1,
    revisions: revisions(),
    parameters,
  };
  return {
    status: "accepted",
    pending: false,
    requested: { ...identity },
    accepted: {
      ...identity,
      snapshotVersion: 1,
      stepIndex: 20,
      simulationTime: 1,
      final: true,
      outputs: spec.quantities.map(({ id }, i) => ({
        quantityId: id,
        ownerId: "fixture.reference",
        unit: "m",
        semanticKind: "coordinate-rms",
        status: "value",
        value: i ? 6e-6 : 8e-7,
        uncertainty: {
          kind: "statistical-interval",
          coverage: 0.95,
          lower: i ? 5e-6 : 7e-7,
          upper: i ? 7e-6 : 9e-7,
        },
      })),
    },
    ...patch,
  };
}
function source(initial = view()) {
  let current = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => current,
    getServerSnapshot: () => initial,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(next, notify = true) {
      current = next;
      if (notify) for (const fn of listeners) fn();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}
function next(original, parameters = { a: 1e-6 }, n = 2) {
  const updated = structuredClone(original);
  Object.assign(updated.accepted.parameters, parameters);
  updated.accepted.runId = `run-${n}`;
  updated.accepted.actionIndex = n;
  updated.accepted.snapshotVersion = n;
  updated.accepted.revisions.input = n;
  updated.accepted.outputs[0].value = 5.65685424949238e-7;
  updated.requested = { ...updated.accepted };
  return updated;
}
function setup() {
  const session = source();
  const store = createInvestigationStore(spec);
  const detach = store.connect(session, "fixture-source-v1");
  return { session, store, detach };
}
function start(h) {
  assert.equal(h.store.begin("It will be smaller, but not half.", task).ok, true);
}
function kept(h) {
  return h.store.getSnapshot().report;
}

test("construction is pure and cannot capture without a connected laboratory", () => {
  const store = createInvestigationStore(spec);
  assert.equal(store.getSnapshot().current, null);
  assert.equal(store.begin("Prediction", task).ok, false);
  assert.equal(store.getSnapshot().report, null);
});
test("prediction pins an immutable detached starting point and does not apply or evaluate anything", () => {
  const h = setup();
  start(h);
  const report = kept(h);
  assert.equal(report.baseline.reading.origin, "prepared-worked-example");
  assert.equal(report.baseline.reading.parameters.seed, "18446744073709551615");
  h.session.getSnapshot().accepted.parameters.a = 9e-6;
  h.session.getSnapshot().accepted.outputs[0].uncertainty.lower = -100;
  assert.equal(report.baseline.reading.parameters.a, 5e-7);
  assert.equal(report.baseline.reading.outputs[0].uncertainty.lower, 7e-7);
  assert.ok(Object.isFrozen(report.baseline.reading.outputs[0].uncertainty));
});
test("capture records exact small values, full uncertainty, owners, units and revision identity", () => {
  const h = setup();
  start(h);
  h.session.set(next(h.session.getSnapshot()));
  assert.equal(h.store.capture("Double radius").ok, true);
  const report = kept(h);
  assert.equal(report.prediction, "It will be smaller, but not half.");
  const b = report.observations[0].reading;
  assert.equal(b.outputs[0].value, 5.65685424949238e-7);
  assert.equal(b.outputs[0].ownerId, "fixture.reference");
  assert.equal(b.outputs[0].unit, "m");
  assert.equal(b.outputs[0].uncertainty.coverage, 0.95);
  assert.equal(b.origin, "accepted-laboratory-result");
  assert.deepEqual(changedInvestigationParameters(report.baseline.reading, b), ["a"]);
});
test("unapplied draft values never enter a capture", () => {
  const h = setup();
  const unrelatedFormDraft = { a: 100 };
  start(h);
  assert.notEqual(kept(h).baseline.reading.parameters.a, unrelatedFormDraft.a);
});
for (const status of ["idle", "pending", "paused", "refused", "unavailable"])
  test(`${status} cannot be mistaken for a new result, even with a retained accepted snapshot`, () => {
    const h = setup();
    start(h);
    const before = kept(h);
    h.session.set({ ...next(h.session.getSnapshot()), status, pending: status === "pending" });
    assert.equal(h.store.capture("Changed").ok, false);
    assert.equal(kept(h), before);
    assert.equal(h.store.getSnapshot().current, null);
  });
test("pending=true overrides an accepted status", () => {
  const s = source(view({ pending: true }));
  assert.equal(readInvestigationEvidence(spec, s, "source").current, null);
});
test("partial worker publications do not count as complete observations", () => {
  const h = setup();
  start(h);
  const partial = next(h.session.getSnapshot());
  partial.accepted.final = false;
  h.session.set(partial);
  assert.equal(h.store.capture("Partial").ok, false);
  assert.equal(kept(h).observations.length, 0);
});
for (const mismatch of [
  "runId",
  "instanceId",
  "experimentId",
  "actionIndex",
  "parameters",
  "revisions",
])
  test(`requested/accepted ${mismatch} mismatch is refused`, () => {
    const v = view();
    if (mismatch === "parameters") v.requested.parameters = { ...v.requested.parameters, a: 7e-7 };
    else if (mismatch === "revisions")
      v.requested.revisions = { ...v.requested.revisions, estimator: 2 };
    else v.requested[mismatch] = mismatch === "actionIndex" ? 3 : "different";
    assert.equal(readInvestigationEvidence(spec, source(v), "source").current, null);
  });
test("click-time read rejects a silently pending source before the subscription notification arrives", () => {
  const h = setup();
  start(h);
  h.session.set({ ...next(h.session.getSnapshot()), pending: true }, false);
  assert.equal(h.store.getSnapshot().current !== null, true);
  assert.equal(h.store.capture("Too soon").ok, false);
  assert.equal(kept(h).observations.length, 0);
});
test("click-time read captures a fresh accepted result even before its notification", () => {
  const h = setup();
  start(h);
  h.session.set(next(h.session.getSnapshot()), false);
  assert.equal(h.store.capture("Fresh").ok, true);
  assert.equal(kept(h).observations[0].reading.actionIndex, 2);
});
test("subsequent publications never overwrite pinned comparisons or the committed prediction", () => {
  const h = setup();
  start(h);
  h.session.set(next(h.session.getSnapshot()));
  h.store.capture("Saved");
  const before = kept(h);
  h.session.set(next(h.session.getSnapshot(), { T: 310 }, 3));
  assert.equal(kept(h), before);
  assert.equal(h.store.begin("Change my prior prediction", task).ok, false);
  assert.equal(kept(h).prediction, before.prediction);
});
test("a capture needs a prediction and a distinct complete publication", () => {
  const h = setup();
  assert.equal(h.store.capture("Before prediction").ok, false);
  start(h);
  assert.equal(h.store.capture("Same as baseline").ok, false);
  h.session.set(next(h.session.getSnapshot()));
  h.store.capture("New");
  assert.equal(h.store.capture("Same new one").ok, false);
  assert.equal(kept(h).observations.length, 1);
});
test("changed settings include all differences rather than silently claiming a single-variable test", () => {
  const h = setup();
  start(h);
  h.session.set(next(h.session.getSnapshot(), { T: 305, a: 1e-6, seed: "2" }));
  h.store.capture("Several settings");
  const report = kept(h);
  assert.deepEqual(
    changedInvestigationParameters(report.baseline.reading, report.observations[0].reading),
    ["T", "a", "seed"],
  );
});
test("a new publication with equal settings remains inspectable and is not presented as a perturbation", () => {
  const h = setup();
  start(h);
  h.session.set(next(h.session.getSnapshot(), {}));
  assert.equal(h.store.capture("Another publication").ok, true);
  const report = kept(h);
  assert.deepEqual(
    changedInvestigationParameters(report.baseline.reading, report.observations[0].reading),
    [],
  );
});
test("ambiguous, disconnected and replacement placements cannot lend each other readings", () => {
  const h = setup();
  start(h);
  const other = source(next(view()));
  const detachOther = h.store.connect(other, "fixture-source-v1");
  assert.equal(h.store.capture("Ambiguous").ok, false);
  detachOther();
  h.detach();
  assert.equal(h.store.capture("Detached").ok, false);
  h.store.connect(other, "fixture-source-v1");
  assert.equal(h.store.capture("Same identity but different session").ok, false);
  assert.equal(kept(h).observations.length, 0);
});
test("a source change refuses mixed-model capture and preserves the first report", () => {
  const h = setup();
  start(h);
  h.detach();
  h.session.set(next(h.session.getSnapshot()));
  h.store.connect(h.session, "source-v2");
  assert.equal(h.store.capture("Changed source").ok, false);
  assert.equal(kept(h).baseline.reading.sourceDigest, "fixture-source-v1");
});
test("reconnecting the same session after effect cleanup keeps a legitimate investigation", () => {
  const h = setup();
  start(h);
  h.detach();
  h.store.connect(h.session, "fixture-source-v1");
  h.session.set(next(h.session.getSnapshot()));
  assert.equal(h.store.capture("After reconnection").ok, true);
});
test("optional prepared identity cannot earn a label when the getter throws", () => {
  const s = source();
  s.getServerSnapshot = () => {
    throw new Error("Unavailable");
  };
  const reading = readInvestigationEvidence(spec, s, "source").current;
  assert.equal(reading.origin, "accepted-laboratory-result");
});
for (const defect of ["absent", "duplicate", "vector", "NaN", "owner", "unit", "status"])
  test(`selected scalar output ${defect} is refused instead of filled with zero`, () => {
    const v = view();
    const output = v.accepted.outputs[0];
    if (defect === "absent") v.accepted.outputs.shift();
    if (defect === "duplicate") v.accepted.outputs.push({ ...output });
    if (defect === "vector") output.value = { length: 5, at: () => 3 };
    if (defect === "NaN") output.value = NaN;
    if (defect === "owner") output.ownerId = "";
    if (defect === "unit") output.unit = undefined;
    if (defect === "status") output.status = "unknown-success";
    assert.equal(readInvestigationEvidence(spec, source(v), "source").current, null);
  });
test("a scientifically nonnumeric result is retained with its reason, not converted to numeric zero", () => {
  const h = setup();
  start(h);
  const v = next(h.session.getSnapshot());
  v.accepted.outputs[0] = {
    quantityId: "lambdaX1s",
    status: "not-applicable",
    reason: "No quantity is defined in this mode.",
    ownerId: "fixture.reference",
    unit: "m",
    semanticKind: "coordinate-rms",
  };
  h.session.set(v);
  assert.equal(h.store.capture("Nonnumeric case").ok, true);
  const saved = kept(h).observations[0].reading.outputs[0];
  assert.equal(saved.status, "not-applicable");
  assert.equal(saved.reason, "No quantity is defined in this mode.");
  assert.equal(Object.hasOwn(saved, "value"), false);
});
test("unselected trajectory outputs are not copied or used as scalar evidence", () => {
  const v = view();
  v.accepted.outputs.push({
    quantityId: "positions",
    value: {
      copy() {
        assert.fail("Must not copy trajectories");
      },
    },
  });
  const reading = readInvestigationEvidence(spec, source(v), "source").current;
  assert.equal(reading.outputs.length, spec.quantities.length);
});
test("data getters are not invoked during capture", () => {
  const v = view();
  Object.defineProperty(v.accepted.outputs[0], "value", {
    get() {
      assert.fail("Getter executed");
    },
    enumerable: true,
  });
  assert.equal(readInvestigationEvidence(spec, source(v), "source").current, null);
});
test("text and observation limits reject the whole change without discarding earlier work", () => {
  const h = setup();
  assert.equal(h.store.begin(" ", task).ok, false);
  assert.equal(h.store.begin("x".repeat(INVESTIGATION_LIMITS.prediction + 1), task).ok, false);
  start(h);
  for (let n = 0; n < INVESTIGATION_LIMITS.observations; n++) {
    h.session.set(next(h.session.getSnapshot(), { a: (n + 2) * 1e-6 }, n + 2));
    assert.equal(h.store.capture(`Reading ${n}`).ok, true);
  }
  const before = kept(h);
  assert.equal(h.store.capture("One too many").ok, false);
  assert.equal(h.store.explain("x".repeat(INVESTIGATION_LIMITS.explanation + 1)).ok, false);
  assert.equal(kept(h), before);
});
test("wrong-task predictions cannot open a report", () => {
  const h = setup();
  assert.equal(h.store.begin("Prediction", { ...task, promptId: "different" }).ok, false);
  assert.equal(kept(h), null);
});
test("JSON export round trips exact captured data and remains within its real byte bound", () => {
  const h = setup();
  start(h);
  h.session.set(next(h.session.getSnapshot()));
  h.store.capture("Changed");
  h.store.explain("A model consequence, not a measurement. λ");
  const exported = exportInvestigationJson(kept(h));
  assert.deepEqual(JSON.parse(exported), kept(h));
  assert.ok(new TextEncoder().encode(exported).length <= INVESTIGATION_LIMITS.bytes);
});
test("negative zero survives the portable JSON format", () => {
  const h = setup();
  h.session.getSnapshot().accepted.parameters.offset = -0;
  h.session.getSnapshot().requested.parameters.offset = -0;
  start(h);
  assert.ok(
    Object.is(JSON.parse(exportInvestigationJson(kept(h))).baseline.reading.parameters.offset, -0),
  );
});
test("readable export escapes private markup and carries no executable or remote resource", () => {
  const h = setup();
  assert.equal(
    h.store.begin('<img src="https://invalid.test"><script>alert(1)</script>', task).ok,
    true,
  );
  h.store.explain("A & B < C");
  const html = exportInvestigationHtml(kept(h));
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|<img|<iframe|<link/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /not measurements/);
  assert.match(html, /A &amp; B &lt; C/);
});
test("confirmed restart leaves the laboratory unchanged and listener failures cannot erase work", () => {
  const h = setup();
  let notifications = 0;
  const off = h.store.subscribe(() => {
    notifications++;
  });
  h.store.subscribe(() => {
    throw new Error("Detached UI");
  });
  start(h);
  const current = h.session.getSnapshot();
  h.store.restartConfirmed();
  assert.equal(kept(h), null);
  assert.equal(h.session.getSnapshot(), current);
  off();
  const before = notifications;
  start(h);
  assert.equal(notifications, before);
});
test("all four published tasks have nonempty, distinct scalar capture contracts", () => {
  assert.deepEqual(Object.keys(INVESTIGATIONS).sort(), [
    "brownian-motion",
    "light-quanta",
    "mass-energy",
    "special-relativity",
  ]);
  assert.equal(new Set(Object.values(INVESTIGATIONS).map((s) => s.promptId)).size, 4);
  for (const s of Object.values(INVESTIGATIONS)) {
    assert.ok(s.quantities.length > 0);
    assert.equal(new Set(s.quantities.map((q) => q.id)).size, s.quantities.length);
    assert.match(s.sourceHref, /^\/papers\//);
    assert.match(s.laboratoryAnchor, /^investigation-/);
  }
});
