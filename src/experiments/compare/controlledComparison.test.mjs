import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionOutcomeError, ParameterRefusalError } from "../results/applyFailure.ts";
import { executionOutcomeRegistry } from "../results/outcomes.ts";
import { makeRefusal } from "../results/refusals.ts";
import { createControlledComparison } from "./controlledComparison.ts";

const identity = {
  modelVersion: "v1",
  streamVersion: "n1",
  allocationId: "a1",
  constantSetId: "c1",
  sourceDigest: "source1",
  artifactDigest: null,
  executionLabel: "host-calculation",
};
const field = (label, command) => ({
  label,
  unit: "",
  displayFactor: 1,
  comparable: true,
  command,
});
const contract = {
  experimentId: "fixture",
  inputs: {
    a: field("Radius", "setup-change"),
    eta: field("Viscosity", "setup-change"),
    interval: field("Interval", "measurement-change"),
  },
  outputs: [{ id: "rms", label: "RMS", displayUnit: "m", displayFactor: 1 }],
};
function snap(patch = {}) {
  return {
    experimentId: "fixture",
    instanceId: "one",
    runId: "one-run1",
    snapshotVersion: 1,
    actionIndex: 1,
    final: true,
    revisions: { input: 1, measurement: 0, observer: 0, estimator: 0 },
    parameters: { a: 1, eta: 1, interval: 1 },
    outputs: [{ quantityId: "rms", status: "value", value: 4, unit: "m", semanticKind: "rms" }],
    ...patch,
  };
}
function setup(verifyAccepted) {
  let view = {
    status: "accepted",
    pending: false,
    accepted: snap(),
    requested: { actionIndex: 1 },
    refusal: null,
    outcome: null,
  };
  const listeners = new Set();
  let calls = 0,
    stops = 0,
    disconnects = 0;
  let requested = null,
    behavior = "async",
    action = 1,
    version = 1,
    run = 1;
  let refusal = makeRefusal(
    "off-replay-grid",
    { parameterIds: ["interval"] },
    {
      details: { requirements: "Off grid" },
    },
  );
  let outcome = { outcome: "worker-timeout", ...executionOutcomeRegistry["worker-timeout"] };
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const port = {
    getSnapshot: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    apply(parameters) {
      calls++;
      if (behavior === "throw") throw new Error("transport failed");
      if (behavior === "throw-refusal") throw new ParameterRefusalError(refusal);
      if (behavior === "throw-outcome") throw new ExecutionOutcomeError(outcome);
      if (behavior === "refuse") return { kind: "refused", refusal };
      if (behavior === "outcome") return { kind: "outcome", outcome };
      action++;
      if (
        parameters.a !== view.accepted.parameters.a ||
        parameters.eta !== view.accepted.parameters.eta
      )
        run++;
      requested = { ...parameters };
      view = {
        ...view,
        status: "pending",
        pending: true,
        requested: { actionIndex: action },
        refusal: null,
        outcome: null,
      };
      notify();
      if (behavior === "sync") finish();
      return { kind: "accepted", data: { actionIndex: action } };
    },
    stop() {
      stops++;
      view = { ...view, pending: false, status: "paused" };
      notify();
    },
    disconnect() {
      disconnects++;
    },
  };
  function finish(patch = {}) {
    version++;
    view = {
      ...view,
      status: "accepted",
      pending: false,
      accepted: snap({
        parameters: requested,
        runId: `one-run${run}`,
        snapshotVersion: version,
        actionIndex: action,
        ...patch,
      }),
    };
    notify();
  }
  const controller = createControlledComparison(port, {
    contract,
    identity,
    baseline: snap(),
    variant: snap({
      instanceId: "static-two",
      runId: "static-two-run1",
      parameters: { a: 2, eta: 1, interval: 1 },
    }),
    ...(verifyAccepted ? { verifyAccepted } : {}),
  });
  return {
    controller,
    finish,
    port,
    fail(
      reason = makeRefusal(
        "invalid-parameter",
        {},
        {
          details: { requirements: "Worker refusal" },
        },
      ),
    ) {
      view = { ...view, status: "refused", pending: false, refusal: reason };
      notify();
    },
    refuseWith(value) {
      refusal = value;
    },
    outcomeWith(value) {
      outcome = value;
    },
    behavior(value) {
      behavior = value;
    },
    counts: () => ({ calls, stops, disconnects, listeners: listeners.size }),
    partial() {
      view = {
        ...view,
        status: "accepted",
        pending: false,
        accepted: snap({ final: false, actionIndex: action }),
      };
      notify();
    },
  };
}
test("construction and connection perform no numerical work", () => {
  const { controller, counts } = setup();
  assert.equal(controller.getSnapshot(), controller.getServerSnapshot());
  controller.connect();
  assert.equal(counts().calls, 0);
  assert.equal(counts().listeners, 1);
  controller.disconnect();
  assert.equal(counts().listeners, 0);
});
test("a live baseline must complete before a variation can start", () => {
  const { controller: c, finish, counts } = setup();
  c.connect();
  assert.equal(c.apply({ a: 2, eta: 1, interval: 1 }), false);
  assert.equal(counts().calls, 0);
  c.start();
  assert.equal(c.getSnapshot().pending, true);
  assert.equal(c.getSnapshot().phase, "example");
  assert.equal(c.getSnapshot().variant.parameters.a, 2);
  finish();
  assert.equal(c.getSnapshot().phase, "live");
  assert.equal(c.getSnapshot().baseline, c.getSnapshot().variant);
  c.disconnect();
});
test("a partial result never replaces a completed pair", () => {
  const { controller: c, partial, finish } = setup();
  c.connect();
  const original = c.getSnapshot().baseline;
  c.start();
  partial();
  assert.equal(c.getSnapshot().baseline, original);
  assert.equal(c.getSnapshot().pending, true);
  finish();
  assert.equal(c.getSnapshot().pending, false);
  c.disconnect();
});
test("the single-input rule executes before dispatch to the numerical session", () => {
  const { controller: c, finish, counts } = setup();
  c.connect();
  c.start();
  finish();
  c.apply({ a: 2, eta: 1, interval: 1 });
  finish();
  const baseline = c.getSnapshot().baseline;
  assert.equal(c.apply({ a: 2, eta: 2, interval: 1 }), false);
  assert.equal(counts().calls, 2);
  assert.equal(c.getSnapshot().baseline, baseline);
  assert.match(c.getSnapshot().error, /one input|pin a new baseline/u);
  c.pinCurrent();
  assert.equal(c.apply({ a: 2, eta: 2, interval: 1 }), true);
  c.disconnect();
});
test("pending or refused requests retain their previous labels, values and identities", () => {
  const { controller: c, finish, fail } = setup();
  c.connect();
  c.start();
  finish();
  const previous = c.getSnapshot().variant;
  c.apply({ a: 2, eta: 1, interval: 1 });
  assert.equal(c.getSnapshot().variant, previous);
  assert.equal(c.getSnapshot().requestedParameters.a, 2);
  assert.equal(c.pinCurrent(), false);
  fail();
  assert.equal(c.getSnapshot().variant, previous);
  assert.equal(c.getSnapshot().pending, false);
  assert.equal(c.getSnapshot().error, "Worker refusal");
  c.disconnect();
});
test("stop discards in-flight comparison intent even if the transport later replies", () => {
  const { controller: c, finish, counts } = setup();
  c.connect();
  c.start();
  finish();
  const previous = c.getSnapshot().variant;
  c.apply({ a: 2, eta: 1, interval: 1 });
  c.stop();
  finish();
  assert.equal(c.getSnapshot().variant, previous);
  assert.equal(counts().stops, 1);
  assert.equal(c.getSnapshot().pending, false);
  c.disconnect();
});
test("a synchronous transport cannot beat action registration", () => {
  const { controller: c, behavior } = setup();
  c.connect();
  behavior("sync");
  c.start();
  assert.equal(c.getSnapshot().phase, "live");
  assert.equal(c.getSnapshot().pending, false);
  c.apply({ a: 2, eta: 1, interval: 1 });
  assert.equal(c.getSnapshot().variant.parameters.a, 2);
  c.disconnect();
});
test("owner reuse evidence is required before a measurement comparison is shown", () => {
  const { controller: c, finish } = setup(() => "Recording was not reused");
  c.connect();
  c.start();
  finish();
  const previous = c.getSnapshot().variant;
  c.apply({ a: 1, eta: 1, interval: 4 });
  finish();
  assert.equal(c.getSnapshot().variant, previous);
  assert.equal(c.getSnapshot().error, "Recording was not reused");
  c.disconnect();
});
test("transport throws and immediate refusals stay recoverable", () => {
  for (const kind of ["throw", "refuse"]) {
    const { controller: c, behavior, finish } = setup();
    c.connect();
    behavior(kind);
    c.start();
    assert.equal(c.getSnapshot().pending, false);
    assert.ok(c.getSnapshot().error);
    behavior("async");
    c.start();
    finish();
    assert.equal(c.getSnapshot().phase, "live");
    c.disconnect();
  }
});
test("rebuilding the pinned baseline is explicit and updates only after acceptance", () => {
  const { controller: c, finish } = setup();
  c.connect();
  c.start();
  finish();
  c.apply({ a: 2, eta: 1, interval: 1 });
  finish();
  const previous = c.getSnapshot().variant;
  c.start();
  assert.equal(c.getSnapshot().variant, previous);
  finish();
  assert.equal(c.getSnapshot().variant.parameters.a, 1);
  assert.equal(c.getSnapshot().baseline, c.getSnapshot().variant);
  c.disconnect();
});
test("disconnect and remount require recording reconstruction, not a stale warm-cache assumption", () => {
  const { controller: c, finish, counts } = setup();
  c.connect();
  c.start();
  finish();
  c.disconnect();
  assert.equal(c.getSnapshot().phase, "example");
  c.connect();
  assert.equal(counts().listeners, 1);
  assert.equal(c.apply({ a: 1, eta: 1, interval: 4 }), false);
  c.start();
  finish();
  assert.equal(c.getSnapshot().phase, "live");
  c.disconnect();
});

for (const [name, patch] of [
  ["different settings", { parameters: { a: 9, eta: 1, interval: 1 } }],
  ["different experiment", { experimentId: "other-instrument" }],
  ["different units", { outputs: [{ ...snap().outputs[0], unit: "cm" }] }],
  ["different quantity meaning", { outputs: [{ ...snap().outputs[0], semanticKind: "mean" }] }],
  ["missing readouts", { outputs: [] }],
]) {
  test(`baseline reconstruction rejects ${name} without replacing the worked example`, () => {
    const { controller: c, finish } = setup();
    c.connect();
    const previous = c.getSnapshot();
    c.start();
    finish(patch);
    const failed = c.getSnapshot();
    assert.equal(failed.phase, "example");
    assert.equal(failed.baseline, previous.baseline);
    assert.equal(failed.variant, previous.variant);
    assert.equal(failed.result, previous.result);
    assert.equal(failed.pending, false);
    assert.equal(failed.requestedParameters, null);
    assert.ok(failed.error);
    assert.equal(c.start(), true);
    finish();
    assert.equal(c.getSnapshot().phase, "live");
    assert.equal(c.getSnapshot().error, "");
    c.disconnect();
  });
}

for (const parameters of [
  { a: 3, eta: 1, interval: 1 },
  { a: 1, eta: 2, interval: 1 },
  { a: 1, eta: 1, interval: 1 },
]) {
  test(`a variant must answer its dispatched settings: ${JSON.stringify(parameters)}`, () => {
    const { controller: c, finish } = setup();
    c.connect();
    c.start();
    finish();
    const previous = c.getSnapshot().variant;
    c.apply({ a: 2, eta: 1, interval: 1 });
    finish({ parameters });
    assert.equal(c.getSnapshot().variant, previous);
    assert.equal(c.getSnapshot().pending, false);
    assert.equal(c.getSnapshot().requestedParameters, null);
    assert.match(c.getSnapshot().error, /settings do not match/);
    c.disconnect();
  });
}

test("dispatch uses detached settings even if a subscriber changes the caller's form data", () => {
  const { controller: c, finish, port } = setup();
  c.connect();
  c.start();
  finish();
  const parameters = { a: 2, eta: 1, interval: 1 };
  const apply = port.apply;
  let dispatched;
  port.apply = (input) => {
    dispatched = input;
    return apply(input);
  };
  c.subscribe(() => {
    if (c.getSnapshot().pending) parameters.a = 3;
  });
  assert.equal(c.apply(parameters), true);
  assert.equal(parameters.a, 3);
  assert.equal(dispatched.a, 2);
  assert.ok(Object.isFrozen(dispatched));
  assert.equal(c.getSnapshot().requestedParameters, dispatched);
  finish();
  assert.equal(c.getSnapshot().variant.parameters.a, 2);
  c.disconnect();
});

for (const action of ["stop", "disconnect"]) {
  test(`${action} during the pending notification prevents numerical dispatch`, () => {
    const { controller: c, counts } = setup();
    c.connect();
    const previous = c.getSnapshot().variant;
    c.subscribe(() => {
      if (c.getSnapshot().pending) c[action]();
    });
    assert.equal(c.start(), false);
    assert.equal(counts().calls, 0);
    assert.equal(c.getSnapshot().pending, false);
    assert.equal(c.getSnapshot().requestedParameters, null);
    assert.equal(c.getSnapshot().variant, previous);
    c.disconnect();
  });
}

test("cancellation during session dispatch is not reported as a successfully started request", () => {
  const { controller: c, finish, port } = setup();
  c.connect();
  const previous = c.getSnapshot().variant;
  const unsubscribe = port.subscribe(() => {
    if (port.getSnapshot().pending) c.stop();
  });
  assert.equal(c.start(), false);
  assert.equal(c.getSnapshot().pending, false);
  finish();
  assert.equal(c.getSnapshot().variant, previous);
  unsubscribe();
  c.disconnect();
});

test("synchronously rejected returned data makes start return false", () => {
  const { controller: c, finish, port } = setup();
  const apply = port.apply;
  port.apply = (parameters) => {
    const request = apply(parameters);
    finish({ parameters: { a: 9, eta: 1, interval: 1 } });
    return request;
  };
  c.connect();
  const previous = c.getSnapshot().baseline;
  assert.equal(c.start(), false);
  assert.equal(c.getSnapshot().phase, "example");
  assert.equal(c.getSnapshot().baseline, previous);
  assert.equal(c.getSnapshot().pending, false);
  assert.match(c.getSnapshot().error, /settings do not match/);
  c.disconnect();
});

for (const actionIndex of [NaN, Infinity, -1, 1.5]) {
  test(`invalid request identity ${actionIndex} cannot leave the comparison stuck pending`, () => {
    const { controller: c, finish, port } = setup();
    const apply = port.apply;
    port.apply = (parameters) => {
      apply(parameters);
      return { kind: "accepted", data: { actionIndex } };
    };
    c.connect();
    const previous = c.getSnapshot().variant;
    assert.equal(c.start(), false);
    assert.equal(c.getSnapshot().pending, false);
    assert.equal(c.getSnapshot().requestedParameters, null);
    assert.match(c.getSnapshot().error, /invalid request identity/);
    finish();
    assert.equal(c.getSnapshot().variant, previous);
    c.disconnect();
  });
}

test("cancellation inside an instrument verifier cannot publish the cancelled result", () => {
  let controller;
  const { controller: c, finish } = setup(() => {
    controller.stop();
    return null;
  });
  controller = c;
  c.connect();
  c.start();
  finish();
  assert.equal(c.getSnapshot().phase, "live");
  const previous = c.getSnapshot().variant;
  c.apply({ a: 2, eta: 1, interval: 1 });
  finish();
  assert.equal(c.getSnapshot().variant, previous);
  assert.equal(c.getSnapshot().pending, false);
  assert.equal(c.getSnapshot().requestedParameters, null);
  c.disconnect();
});

test("local cancellation remains effective even when the transport's stop throws", () => {
  const { controller: c, finish, port } = setup();
  c.connect();
  c.start();
  finish();
  const previous = c.getSnapshot().variant;
  c.apply({ a: 2, eta: 1, interval: 1 });
  port.stop = () => {
    throw new Error("worker unavailable");
  };
  assert.doesNotThrow(() => c.stop());
  assert.equal(c.getSnapshot().pending, false);
  assert.equal(c.getSnapshot().requestedParameters, null);
  assert.match(c.getSnapshot().error, /could not reach the calculation/);
  finish();
  assert.equal(c.getSnapshot().variant, previous);
  assert.equal(c.apply({ a: 2, eta: 1, interval: 1 }), true);
  finish();
  assert.equal(c.getSnapshot().variant.parameters.a, 2);
  c.disconnect();
});

test("refusal clears pending settings and retry can still replace the previous result", () => {
  const { controller: c, finish, fail } = setup();
  c.connect();
  c.start();
  finish();
  c.apply({ a: 2, eta: 1, interval: 1 });
  fail();
  assert.equal(c.getSnapshot().requestedParameters, null);
  assert.equal(c.apply({ a: 2, eta: 1, interval: 1 }), true);
  finish();
  assert.equal(c.getSnapshot().variant.parameters.a, 2);
  c.disconnect();
});

test("a superseding session request clears old intent without stopping the new request", () => {
  const { controller: c, finish, port, counts } = setup();
  c.connect();
  c.start();
  finish();
  const previous = c.getSnapshot().variant;
  c.apply({ a: 2, eta: 1, interval: 1 });
  port.apply({ a: 3, eta: 1, interval: 1 });
  assert.equal(c.getSnapshot().pending, false);
  assert.equal(c.getSnapshot().requestedParameters, null);
  assert.match(c.getSnapshot().error, /newer session request/);
  assert.equal(counts().stops, 0);
  finish();
  assert.equal(c.getSnapshot().variant, previous);
  c.disconnect();
});

const gridRefusal = () =>
  makeRefusal(
    "off-replay-grid",
    { parameterIds: ["interval"] },
    {
      details: { requirements: "Use a recorded interval, preserving the pinned trial." },
      rankedRepairs: [
        { label: "Use interval two", action: { parameterId: "interval", value: 2 } },
        { label: "Change viscosity too", action: { parameterId: "eta", value: 2 } },
        { label: "Change the seed", action: { parameterId: "seed", value: "7" } },
        { label: "Inspect the recording grid" },
      ],
    },
  );

test("rejection does not read or retain parameters that failed the data-only contract", () => {
  const { controller: c, finish, counts } = setup();
  c.connect();
  c.start();
  finish();
  const before = c.getSnapshot();
  let reads = 0;
  const requested = { eta: 1, interval: 1 };
  Object.defineProperty(requested, "a", {
    enumerable: true,
    get() {
      reads++;
      return 2;
    },
  });
  assert.equal(c.apply(requested), false);
  assert.equal(reads, 0);
  assert.equal(counts().calls, 1);
  assert.equal(c.getSnapshot().rejectedParameters, null);
  assert.equal(c.getSnapshot().baselineSnapshot, before.baselineSnapshot);
  assert.equal(c.getSnapshot().variantSnapshot, before.variantSnapshot);
  c.disconnect();
});

for (const path of ["refuse", "throw-refusal", "worker"]) {
  test(`${path}: typed refusal and original settings survive until an explicit admissible repair`, () => {
    const { controller: c, finish, fail, refuseWith, behavior, counts } = setup();
    c.connect();
    c.start();
    finish();
    const before = c.getSnapshot();
    const refusal = gridRefusal();
    const requested = { a: 1, eta: 1, interval: 0.3 };
    refuseWith(refusal);
    if (path !== "worker") behavior(path);
    c.apply(requested);
    if (path === "worker") fail(refusal);
    requested.interval = 99;
    const rejected = c.getSnapshot();
    assert.equal(rejected.failure.kind, "refused");
    assert.equal(rejected.failure.refusal, refusal);
    assert.equal(rejected.error, refusal.details.requirements);
    assert.equal(rejected.rejectedParameters.interval, 0.3);
    assert.ok(Object.isFrozen(rejected.rejectedParameters));
    assert.equal(rejected.requestedParameters, null);
    assert.equal(rejected.baselineSnapshot, before.baselineSnapshot);
    assert.equal(rejected.variantSnapshot, before.variantSnapshot);
    assert.equal(rejected.result, before.result);

    const valid = rejected.repairs.find((choice) => choice.index === 0);
    assert.ok(valid?.parameters);
    assert.deepEqual(valid.parameters, { a: 1, eta: 1, interval: 2 });
    const calls = counts().calls;
    for (const blocked of rejected.repairs.filter((choice) => !choice.parameters)) {
      assert.equal(c.repair(blocked), false);
    }
    assert.equal(counts().calls, calls);
    assert.match(rejected.repairs[1].blockedReason, /one input|pin a new baseline/);
    assert.match(rejected.repairs[2].blockedReason, /held fixed/);

    behavior("async");
    assert.equal(c.repair(valid), true);
    const pending = c.getSnapshot();
    assert.equal(pending.pending, true);
    assert.equal(pending.failure, null);
    assert.equal(pending.rejectedParameters, null);
    assert.deepEqual(pending.requestedParameters, valid.parameters);
    assert.equal(pending.baselineSnapshot, before.baselineSnapshot);
    assert.equal(pending.variantSnapshot, before.variantSnapshot);
    assert.equal(c.repair(valid), false);
    finish();
    const accepted = c.getSnapshot();
    assert.equal(accepted.baselineSnapshot, before.baselineSnapshot);
    assert.equal(accepted.variant.parameters.interval, 2);
    assert.equal(accepted.failure, null);
    assert.equal(accepted.rejectedParameters, null);
    assert.equal(accepted.error, "");
    assert.equal(c.repair(valid), false);
    c.disconnect();
  });
}

test("a repair is proposed to the owner again, and a second refusal cannot replace accepted data", () => {
  const { controller: c, finish, refuseWith, behavior, counts } = setup();
  c.connect();
  c.start();
  finish();
  const before = c.getSnapshot();
  const refusal = gridRefusal();
  refuseWith(refusal);
  behavior("refuse");
  c.apply({ a: 1, eta: 1, interval: 0.3 });
  const choice = c.getSnapshot().repairs[0];
  const calls = counts().calls;
  assert.equal(c.repair(choice), false);
  assert.equal(counts().calls, calls + 1);
  assert.equal(c.getSnapshot().rejectedParameters.interval, 2);
  assert.equal(c.getSnapshot().failure.refusal, refusal);
  assert.equal(c.getSnapshot().baselineSnapshot, before.baselineSnapshot);
  assert.equal(c.getSnapshot().variantSnapshot, before.variantSnapshot);
  assert.equal(c.repair(choice), false);
  assert.equal(counts().calls, calls + 1);
  c.disconnect();
});

test("repairing a refused reconstruction cannot silently replace the pinned baseline", () => {
  const { controller: c, refuseWith, behavior, counts } = setup();
  c.connect();
  const before = c.getSnapshot();
  refuseWith(gridRefusal());
  behavior("refuse");
  c.start();
  const choice = c.getSnapshot().repairs[0];
  assert.equal(choice.parameters, null);
  assert.match(choice.blockedReason, /pinned baseline must keep its original settings/);
  assert.equal(c.repair(choice), false);
  assert.equal(counts().calls, 1);
  assert.equal(c.getSnapshot().baseline, before.baseline);
  assert.equal(c.getSnapshot().variant, before.variant);
  c.disconnect();
});

test("pinning an accepted result expires every action from an older rejected request", () => {
  const { controller: c, finish, refuseWith, behavior, counts } = setup();
  c.connect();
  c.start();
  finish();
  refuseWith(gridRefusal());
  behavior("refuse");
  c.apply({ a: 1, eta: 1, interval: 0.3 });
  const choice = c.getSnapshot().repairs[0];
  assert.equal(c.pinCurrent(), true);
  const calls = counts().calls;
  assert.equal(c.repair(choice), false);
  assert.equal(counts().calls, calls);
  assert.equal(c.getSnapshot().failure, null);
  c.disconnect();
});

for (const path of ["outcome", "throw-outcome"]) {
  test(`${path}: retry preserves the execution outcome and dispatches the exact rejected request`, () => {
    const { controller: c, finish, outcomeWith, behavior, counts } = setup();
    c.connect();
    c.start();
    finish();
    const before = c.getSnapshot();
    const outcome = { outcome: "worker-timeout", ...executionOutcomeRegistry["worker-timeout"] };
    outcomeWith(outcome);
    behavior(path);
    c.apply({ a: 1, eta: 1, interval: 2 });
    const rejected = c.getSnapshot();
    assert.equal(rejected.failure.kind, "unavailable");
    assert.equal(rejected.failure.outcome, outcome);
    assert.equal(rejected.baseline, before.baseline);
    assert.equal(rejected.variant, before.variant);
    const calls = counts().calls;
    assert.equal(c.retry({ ...rejected.failure }), false);
    assert.equal(counts().calls, calls);
    behavior("async");
    assert.equal(c.retry(rejected.failure), true);
    assert.deepEqual(c.getSnapshot().requestedParameters, rejected.rejectedParameters);
    finish();
    assert.equal(c.getSnapshot().variant.parameters.interval, 2);
    assert.equal(c.getSnapshot().failure, null);
    assert.equal(c.retry(rejected.failure), false);
    c.disconnect();
  });
}

for (const outcomeId of ["worker-crashed", "protocol-mismatch", "environment-unsupported"]) {
  test(`${outcomeId}: same-request retry cannot override the engine's recovery guidance`, () => {
    const { controller: c, finish, outcomeWith, behavior, counts } = setup();
    c.connect();
    c.start();
    finish();
    outcomeWith({ outcome: outcomeId, ...executionOutcomeRegistry[outcomeId] });
    behavior("outcome");
    c.apply({ a: 1, eta: 1, interval: 2 });
    const calls = counts().calls;
    assert.equal(c.retry(c.getSnapshot().failure), false);
    assert.equal(counts().calls, calls);
    c.disconnect();
  });
}
