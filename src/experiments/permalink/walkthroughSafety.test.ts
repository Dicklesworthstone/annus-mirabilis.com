import assert from "node:assert/strict";
import test from "node:test";
import type { U64String } from "../identity/u64.ts";
import { playWalkthrough } from "./playWalkthrough.ts";
import { replayTeachingTapeOn } from "./replayTeachingTape.ts";
import { type LabTapeBinding, tapeStateDigestIn, type TapeSession } from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";

function session() {
  let parameters = { x: 8, y: 9 };
  let snapshot = { accepted: { revisions: { input: 0 } } };
  const applied: unknown[] = [];
  const live: TapeSession = {
    apply(input) {
      const p = input as typeof parameters;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return { kind: "refused" };
      applied.push(input);
      parameters = { ...p };
      snapshot = { accepted: { revisions: { input: applied.length } } };
      return { kind: "accepted" };
    },
    acceptedParameters: () => parameters,
    getSnapshot: () => snapshot,
  };
  return { live, applied };
}
const binding: LabTapeBinding = {
  environment: {
    experimentId: "walkthrough-fixture",
    mode: "reference",
    modelId: "walkthrough-fixture",
    modelVersion: 1,
    constantSetId: "fixture",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  },
  defaults: { x: 1, y: 2 },
  validate: () => ({ kind: "accepted" }),
  createSession: () => session().live,
};
function tape(): TapeV2 {
  return {
    tapeVersion: 2,
    experimentId: binding.environment.experimentId,
    mode: binding.environment.mode,
    modelIdentity: { modelId: binding.environment.modelId, modelVersion: 1 },
    constantSetId: binding.environment.constantSetId,
    seed: "0" as U64String,
    streamVersion: binding.environment.streamVersion,
    allocationId: binding.environment.allocationId,
    initialConditions: { x: 1, y: 2 },
    events: [
      { actionIndex: 1, commandClass: "setup-change", paramId: "x", value: 3 },
      { actionIndex: 2, commandClass: "observer-change", paramId: "y", value: 4 },
    ],
    acceptedCheckpoint: {
      acceptedActionIndex: 2,
      acceptedInputRevision: 3,
      digest: tapeStateDigestIn("fnv1a64", { x: 3, y: 4 }, 2),
    },
  };
}

test("walkthrough play reaches the accepted state and retains the verified replay distinction", () => {
  const { live, applied } = session();
  const result = playWalkthrough(binding, live, "fixture", { resolve: () => tape() });
  assert.equal(result.kind, "played");
  if (result.kind === "played") {
    assert.equal(result.isNewRun, false);
    assert.equal(result.steps, 2);
    assert.deepEqual(result.parameters, { x: 3, y: 4 });
    assert.match(result.notice, /this laboratory's own/);
  }
  assert.equal(applied.length, 3, "Only the live application publishes revisions.");
});

test("walkthrough checkpoint and identity refusals leave the live snapshot untouched", () => {
  for (const record of [
    { ...tape(), constantSetId: "historical" },
    { ...tape(), acceptedCheckpoint: { ...tape().acceptedCheckpoint, digest: "host:ffffffffffffffff" } },
  ]) {
    const { live, applied } = session();
    const before = live.getSnapshot();
    assert.equal(playWalkthrough(binding, live, "fixture", { resolve: () => record }).kind, "refused");
    assert.equal(live.getSnapshot(), before);
    assert.deepEqual(applied, []);
  }
});

test("a resolver exception becomes a reader-visible refusal rather than a thrown event handler", () => {
  const { live, applied } = session();
  const result = playWalkthrough(binding, live, "fixture", {
    resolve: () => { throw new Error("catalogue unavailable"); },
  });
  assert.equal(result.kind, "refused");
  if (result.kind === "refused") {
    assert.equal(result.code, "teaching-tape-resolution-failed");
    assert.match(result.notice, /catalogue unavailable/);
  }
  assert.deepEqual(applied, []);
});

test("play resolves the named record once, not again during preflight or live application", () => {
  const { live } = session();
  let calls = 0;
  const result = playWalkthrough(binding, live, "fixture", {
    resolve: () => (++calls === 1 ? tape() : null),
  });
  assert.equal(result.kind, "played");
  assert.equal(calls, 1);
});

test("malformed step indices are refused, including an explicitly new run", () => {
  for (const stepIndex of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    for (const asNewRun of [false, true]) {
      const { live, applied } = session();
      const result = replayTeachingTapeOn(binding, live, "fixture", {
        resolve: () => tape(), stepIndex, asNewRun,
      });
      assert.equal(result.kind, "refused");
      if (result.kind === "refused") assert.equal(result.refusalCode, "teaching-tape-step-invalid");
      assert.deepEqual(applied, []);
    }
  }
});

test("an intermediate step cannot borrow the final checkpoint's verification", () => {
  const { live, applied } = session();
  const result = replayTeachingTapeOn(binding, live, "fixture", { resolve: () => tape(), stepIndex: 0 });
  assert.equal(result.kind, "refused");
  if (result.kind === "refused") assert.equal(result.refusalCode, "tape-checkpoint-mismatch");
  assert.deepEqual(applied, []);
});

test("an explicitly new intermediate run is labelled as unverified, not as reproduced history", () => {
  const { live } = session();
  const result = playWalkthrough(binding, live, "fixture", {
    resolve: () => ({ ...tape(), constantSetId: "historical" }),
    stepIndex: 0,
    asNewRun: true,
  });
  assert.equal(result.kind, "played");
  if (result.kind === "played") {
    assert.equal(result.isNewRun, true);
    assert.equal(result.steps, 1);
    assert.deepEqual(result.parameters, { x: 3, y: 2 });
    assert.match(result.notice, /explicitly new run/);
    assert.match(result.notice, /identity and checkpoint were not verified/);
    assert.match(result.notice, /not a reproduced recorded result/);
  }
});

test("a checkpoint at the opening settings is the default even when later controls exist", () => {
  const { live, applied } = session();
  const record: TapeV2 = {
    ...tape(),
    acceptedCheckpoint: {
      acceptedActionIndex: 0,
      acceptedInputRevision: 1,
      digest: tapeStateDigestIn("fnv1a64", { x: 1, y: 2 }, 0),
    },
  };
  const result = playWalkthrough(binding, live, "fixture", { resolve: () => record });
  assert.equal(result.kind, "played");
  if (result.kind === "played") assert.equal(result.steps, 0);
  assert.deepEqual(live.acceptedParameters(), { x: 1, y: 2 });
  assert.equal(applied.length, 1);
});

test("walkthrough playback honours legacy digest formats as shared-link restoration does", () => {
  for (const form of ["fnv1a64", "fnv1a", "lq08-legacy"] as const) {
    const { live } = session();
    const record: TapeV2 = {
      ...tape(),
      acceptedCheckpoint: {
        ...tape().acceptedCheckpoint,
        digest: tapeStateDigestIn(form, { x: 3, y: 4 }, 2),
      },
    };
    assert.equal(playWalkthrough(binding, live, "fixture", { resolve: () => record }).kind, "played", form);
  }
});


test("a high-level seek past the end retains the scrubber's last-step behavior", () => {
  for (const asNewRun of [false, true]) {
    const { live } = session();
    const result = playWalkthrough(binding, live, "fixture", {
      resolve: () => tape(), stepIndex: 99, asNewRun,
    });
    assert.equal(result.kind, "played");
    if (result.kind === "played") {
      assert.equal(result.steps, 2);
      assert.equal(result.isNewRun, asNewRun);
      assert.deepEqual(result.parameters, { x: 3, y: 4 });
    }
  }
});
