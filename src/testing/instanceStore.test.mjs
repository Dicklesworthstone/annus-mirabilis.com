import test from "node:test";
import assert from "node:assert/strict";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { makeRefusal } from "../experiments/results/refusals.ts";
import { executionOutcomeRegistry } from "../experiments/results/outcomes.ts";
import { ftcs1d } from "../physics/reference/diffusion.ts";
const output = value => ({ quantityId: "density", unit: "1/m", semanticKind: "coordinate-density", ownerId: "diffusion.ftcs1d", status: "value", value });
function options(instanceId = "paper2/section4/gaussian") {
  return { experimentId: "BM06", instanceId,
    initialParameters: { D: 1, dx: 1, dt: 0.25, observer: 0, observationInterval: 1, estimator: "moments", seed: "0" },
    parameterClasses: { D: "input", dx: "input", dt: "input", seed: "input", observer: "observer", observationInterval: "measurement", estimator: "estimator" },
    outputs: { density: { statuses: ["value"], unit: "1/m", semanticKind: "coordinate-density", ownerId: "diffusion.ftcs1d" } },
  };
}
const publication = (token, value = 1, stepIndex = 0, final = true) => ({ ...token, stepIndex, simulationTime: stepIndex * 0.25, final, outputs: [output(value)] });
function expectAccepted(result) { assert.deepEqual(result, { accepted: true }); }
test("getSnapshot has stable identity; mounting subscriptions does not start a run", () => {
  const store = createInstanceStore(options());
  const initial = store.getSnapshot();
  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  assert.equal(store.getSnapshot(), initial);
  assert.equal(store.getServerSnapshot(), initial);
  assert.equal(initial.requested, null);
  const token = store.issue("setup-change");
  assert.equal(calls, 1);
  const pending = store.getSnapshot();
  assert.equal(store.getSnapshot(), pending);
  expectAccepted(store.publish(publication(token)));
  assert.equal(calls, 2);
  unsubscribe(); unsubscribe();
  const accepted = store.getSnapshot();
  store.subscribe(() => calls++);
  assert.equal(store.getSnapshot(), accepted);
  assert.equal(calls, 2);
  assert.equal(store.getServerSnapshot(), initial);
});
test("placements of the same experiment have independent accepted and requested state", () => {
  const a = createInstanceStore(options("inline")), b = createInstanceStore(options("expanded"));
  const token = a.issue("setup-change");
  const before = b.getSnapshot();
  assert.equal(b.publish(publication(token)).reason, "wrong-instance");
  assert.equal(b.getSnapshot(), before);
  expectAccepted(a.publish(publication(token, 3)));
  assert.equal(b.getSnapshot().accepted, null);
});
test("observer, measurement, and estimator commands retain the physical run and seed", () => {
  const store = createInstanceStore(options());
  const first = store.issue("setup-change");
  expectAccepted(store.publish(publication(first, 1, 8)));
  let last = first;
  for (const [command, patch, revision] of [["observer-change", { observer: 0.2 }, "observer"], ["measurement-change", { observationInterval: 2 }, "measurement"], ["estimator-change", { estimator: "likelihood" }, "estimator"]]) {
    const token = store.issue(command, patch);
    assert.equal(token.runId, first.runId);
    assert.equal(token.parameters.seed, first.parameters.seed);
    assert.equal(token.revisions.input, first.revisions.input);
    assert.equal(token.revisions[revision], last.revisions[revision] + 1);
    assert.equal(token.actionIndex, last.actionIndex + 1);
    expectAccepted(store.publish(publication(token, 2, 8)));
    last = token;
  }
  const next = store.issue("setup-change", { D: 2 });
  assert.notEqual(next.runId, first.runId);
  expectAccepted(store.publish(publication(next, 4, 0)));
  assert.equal(store.getSnapshot().accepted.snapshotVersion, 5);
});
test("cross-class changes and unknown parameters cannot silently rerun the world", () => {
  const store = createInstanceStore(options());
  assert.throws(() => store.issue("observer-change", { observer: 0.2 }));
  store.issue("setup-change");
  const before = store.getSnapshot();
  assert.throws(() => store.issue("observer-change", { D: 2 }));
  assert.throws(() => store.issue("setup-change", { unregistered: 1 }));
  assert.throws(() => store.issue("continue", { dt: 0.1 }));
  assert.throws(() => store.issue("setup-change", { D: NaN }));
  assert.equal(store.getSnapshot(), before);
});
test("stale actions, superseded runs, fabricated actions and mixed revisions are discarded", () => {
  const store = createInstanceStore(options());
  const first = store.issue("setup-change");
  const second = store.issue("observer-change", { observer: 0.2 });
  const pending = store.getSnapshot();
  assert.equal(store.publish(publication(first)).reason, "stale-action");
  assert.equal(store.publish(publication({ ...second, actionIndex: second.actionIndex + 1 })).reason, "unissued-action");
  assert.equal(store.publish(publication({ ...second, revisions: { ...second.revisions, input: 0 } })).reason, "mixed-revisions");
  assert.equal(store.publish(publication({ ...second, parameters: { ...second.parameters, D: 100 } })).reason, "parameter-mismatch");
  assert.equal(store.getSnapshot(), pending);
  const third = store.issue("setup-change", { D: 2 });
  assert.equal(store.publish(publication(second)).reason, "superseded-run");
  expectAccepted(store.publish(publication(third)));
});
test("progress is strictly monotone within an action and final completion seals it", () => {
  const store = createInstanceStore(options());
  const token = store.issue("setup-change");
  expectAccepted(store.publish(publication(token, 1, 1, false)));
  assert.equal(store.getSnapshot().pending, true);
  const progress = store.getSnapshot();
  assert.equal(store.publish(publication(token, 2, 1, false)).reason, "non-monotone-step");
  assert.equal(store.getSnapshot(), progress);
  expectAccepted(store.publish(publication(token, 3, 2, true)));
  assert.equal(store.getSnapshot().accepted.snapshotVersion, 2);
  assert.equal(store.publish(publication(token, 4, 3, true)).reason, "completed-action");
  assert.equal(store.refuse(token, makeRefusal("invalid-parameter", { parameterIds: ["D"] })).reason, "completed-action");
});
test("published numeric arrays cannot be mutated through source, view or returned copies", () => {
  const store = createInstanceStore(options());
  const token = store.issue("setup-change");
  const source = Float64Array.from([1, 2, 3]);
  expectAccepted(store.publish(publication(token, source)));
  const snapshot = store.getSnapshot().accepted;
  const values = snapshot.outputs[0].value;
  source[0] = 100;
  values.copy()[1] = 200;
  assert.equal(values.at(0), 1); assert.equal(values.at(1), 2);
  assert.throws(() => { values.length = 0; });
  assert.throws(() => { snapshot.parameters.D = 2; });
  assert.throws(() => { snapshot.revisions.input = 100; });
  assert.throws(() => snapshot.outputs.push(output(1)));
  assert.throws(() => values.at(-1));
  assert.throws(() => values.at(3));
});
test("malformed or wrongly labeled output never replaces accepted science", () => {
  const store = createInstanceStore(options());
  const first = store.issue("setup-change");
  expectAccepted(store.publish(publication(first)));
  const token = store.issue("continue");
  const before = store.getSnapshot();
  for (const bad of [NaN, Infinity, new Float64Array([NaN])]) assert.equal(store.publish(publication(token, bad, 1)).accepted, false);
  for (const patch of [{ unit: "m" }, { semanticKind: "observation" }, { ownerId: "fake" }, { status: "error" }]) assert.equal(store.publish({ ...publication(token, 1, 1), outputs: [{ ...output(1), ...patch }] }).accepted, false);
  assert.equal(store.publish({ ...publication(token, 1, 1), extra: "unregistered" }).accepted, false);
  assert.equal(store.getSnapshot(), before);
});
test("real FTCS instability preserves the last valid field and separates requested parameters", () => {
  const store = createInstanceStore(options());
  const token = store.issue("setup-change");
  const initial = ftcs1d({ ...token.parameters, n: 5, frames: 2, stepsPerFrame: 1, profile: 0 });
  assert.equal(initial.kind, "accepted");
  expectAccepted(store.publish(publication(token, initial.data.values.slice(5), 1)));
  const accepted = store.getSnapshot().accepted;
  const changed = store.issue("setup-change", { dt: 0.51 });
  const unstable = ftcs1d({ ...changed.parameters, n: 5, frames: 2, stepsPerFrame: 1, profile: 0 });
  assert.equal(unstable.kind, "refused");
  expectAccepted(store.refuse(changed, unstable.refusal));
  const refused = store.getSnapshot();
  assert.equal(refused.accepted, accepted);
  assert.equal(refused.requested.parameters.dt, 0.51);
  assert.equal(refused.accepted.parameters.dt, 0.25);
  assert.equal(refused.status, "refused"); assert.equal(refused.pending, false);
  const repaired = store.issue("setup-change", { dt: unstable.refusal.rankedRepairs[0].action.value });
  const run = ftcs1d({ ...repaired.parameters, n: 5, frames: 2, stepsPerFrame: 1, profile: 0 });
  assert.equal(run.kind, "accepted");
  expectAccepted(store.publish(publication(repaired, run.data.values.slice(5), 1)));
  assert.equal(store.getSnapshot().accepted.snapshotVersion, 2);
});
test("software failure and pause preserve accepted data and invalidate late responses", () => {
  const store = createInstanceStore(options());
  const first = store.issue("setup-change");
  expectAccepted(store.publish(publication(first)));
  const accepted = store.getSnapshot().accepted;
  const next = store.issue("continue");
  expectAccepted(store.fail(next, { outcome: "worker-crashed", ...executionOutcomeRegistry["worker-crashed"] }));
  assert.equal(store.getSnapshot().accepted, accepted);
  const token = store.issue("continue");
  store.pause();
  assert.equal(store.getSnapshot().status, "paused");
  assert.equal(store.getSnapshot().accepted, accepted);
  assert.equal(store.publish(publication(token, 2, 1)).reason, "completed-action");
  const resume = store.issue("continue");
  assert.equal(resume.runId, first.runId);
  expectAccepted(store.publish(publication(resume, 3, 2)));
});
test("one broken subscriber cannot corrupt publication or silence other subscribers", () => {
  const errors = [];
  const store = createInstanceStore({ ...options(), onListenerError: error => errors.push(error) });
  store.subscribe(() => { throw new Error("view failed"); });
  let calls = 0; store.subscribe(() => calls++);
  const token = store.issue("setup-change");
  expectAccepted(store.publish(publication(token)));
  assert.equal(calls, 2); assert.equal(errors.length, 2);
  assert.equal(store.getSnapshot().status, "accepted");
});
