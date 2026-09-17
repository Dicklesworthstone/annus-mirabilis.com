import assert from "node:assert/strict";
import test from "node:test";
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
      if (behavior === "refuse") return { kind: "refused", refusal: { message: "Off grid" } };
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
    fail() {
      view = { ...view, status: "refused", pending: false, refusal: { message: "Worker refusal" } };
      notify();
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
