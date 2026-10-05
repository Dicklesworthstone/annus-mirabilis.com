import assert from "node:assert/strict";
import test from "node:test";
import type { TapeV2 } from "./types.ts";
import {
  applyWalkthroughCheckpoint,
  calculateWalkthroughCheckpoint,
  retainedWalkthroughTape,
  type WalkthroughTarget,
} from "./walkthroughActions.ts";
import type { CheckpointWalkthrough } from "./walkthroughCheckpoints.ts";

const tape: TapeV2 = {
  tapeVersion: 2, experimentId: "me-01", mode: "me-01:default",
  modelIdentity: { modelId: "fixture", modelVersion: 1 },
  constantSetId: "fixture", seed: "0" as TapeV2["seed"],
  streamVersion: "deterministic", allocationId: "deterministic",
  initialConditions: { angle: 0 },
  events: [{ actionIndex: 1, commandClass: "setup-change", paramId: "angle", value: 90 }],
  acceptedCheckpoint: {
    acceptedActionIndex: 1, acceptedInputRevision: 0, digest: "host:0123456789abcdef",
  },
};
const walkthrough: CheckpointWalkthrough = {
  tapeId: "record", title: "Record", experimentId: "me-01",
  checkpoints: [{ actionIndex: 1, label: "Broadside", settings: { angle: 90 }, tape }],
};

function fixture() {
  const calculated: object[] = [];
  let restores = 0;
  const target: WalkthroughTarget = {
    kind: "session", experimentId: "me-01",
    restore: () => { restores++; return { kind: "not-restored", notice: "Different model." }; },
    calculate: (settings) => { calculated.push(settings); return { kind: "calculated" }; },
  };
  return { target, calculated, restores: () => restores };
}

test("refused replay never silently falls back to a new calculation", () => {
  const f = fixture();
  assert.equal(applyWalkthroughCheckpoint(f.target, walkthrough, 0).kind, "refused");
  assert.equal(f.restores(), 1);
  assert.deepEqual(f.calculated, []);
});

test("explicit new calculation uses settings only and disclaims recorded reproducibility", () => {
  const f = fixture();
  const result = calculateWalkthroughCheckpoint(f.target, walkthrough, 0);
  assert.equal(result.kind, "new-run");
  assert.deepEqual(f.calculated, [{ angle: 90 }]);
  assert.equal(f.restores(), 0);
  assert.match(result.notice, /current model/);
  assert.match(result.notice, /have not been reproduced/);
});

test("an unconvertible recording can be explored explicitly without inventing its digest", () => {
  const f = fixture();
  const unconvertible = {
    ...walkthrough,
    checkpoints: [{ actionIndex: 1, label: "Broadside", settings: { angle: 90 }, tape: null }],
  };
  assert.equal(calculateWalkthroughCheckpoint(f.target, unconvertible, 0).kind, "new-run");
  assert.equal(unconvertible.checkpoints[0]?.tape, null);
});

test("new calculation does not accept another laboratory or an invalid checkpoint", () => {
  const f = fixture();
  const wrong = { ...walkthrough, experimentId: "bm-01" };
  assert.equal(calculateWalkthroughCheckpoint(f.target, wrong, 0).kind, "refused");
  assert.equal(calculateWalkthroughCheckpoint(f.target, walkthrough, 20).kind, "refused");
  assert.deepEqual(f.calculated, []);
});

test("form labs cannot accidentally start calculations through the new-run action", () => {
  let loads = 0;
  const target: WalkthroughTarget = {
    kind: "form", experimentId: "me-01",
    load: () => { loads++; return { kind: "loaded" }; },
  };
  assert.equal(calculateWalkthroughCheckpoint(target, walkthrough, 0).kind, "refused");
  assert.equal(loads, 0);
});

test("a rejected new calculation remains a refusal, not a computed result", () => {
  const target: WalkthroughTarget = {
    ...fixture().target,
    kind: "session", restore: () => ({ kind: "restored" }),
    calculate: () => ({ kind: "not-restored", notice: "Outside this model." }),
  };
  assert.deepEqual(calculateWalkthroughCheckpoint(target, walkthrough, 0), {
    kind: "refused", notice: "Outside this model.",
  });
});

test("sharing a matched checkpoint retains events, model identity and the recorded digest", () => {
  const binding = {};
  const session = {};
  const retained = { binding, session, parameters: { angle: 90 }, tape };
  const shared = retainedWalkthroughTape(retained, binding, session, { angle: 90 });
  assert.equal(shared, tape);
  assert.equal(shared?.events, tape.events);
  assert.equal(shared?.acceptedCheckpoint, tape.acceptedCheckpoint);
  assert.equal(shared?.modelIdentity, tape.modelIdentity);
});

test("editing the accepted settings stops offering the old checkpoint", () => {
  const binding = {};
  const session = {};
  const retained = { binding, session, parameters: { angle: 90 }, tape };
  assert.equal(retainedWalkthroughTape(retained, binding, session, { angle: 45 }), null);
});

test("a second instance cannot share the first instance's recorded checkpoint", () => {
  const binding = {};
  const session = {};
  const retained = { binding, session, parameters: { angle: 90 }, tape };
  assert.equal(retainedWalkthroughTape(retained, binding, {}, { angle: 90 }), null);
  assert.equal(retainedWalkthroughTape(retained, {}, session, { angle: 90 }), null);
  assert.equal(retainedWalkthroughTape(null, binding, session, { angle: 90 }), null);
});
