import assert from "node:assert/strict";
import test from "node:test";
import type { U64String } from "../identity/u64.ts";
import { type ReplayRunner, replayTape } from "./replay.ts";
import type { ExperimentEnvironment, TapeControlEvent, TapeV2 } from "./types.ts";

const environment: ExperimentEnvironment = {
  experimentId: "replay-fixture",
  mode: "reference",
  modelId: "replay-fixture",
  modelVersion: 1,
  constantSetId: "fixture",
  streamVersion: "deterministic",
  allocationId: "deterministic",
};
const events: readonly TapeControlEvent[] = [
  { actionIndex: 2, commandClass: "setup-change", paramId: "x", value: 3 },
  { actionIndex: 5, commandClass: "observer-change", paramId: "y", value: 8 },
];
const stateAt = (selected: readonly TapeControlEvent[]) => {
  const state: Record<string, number | string> = { x: 1, y: 2 };
  for (const event of selected) state[event.paramId] = event.value;
  return state;
};
const digest = (state: Record<string, number | string>, action: number) =>
  JSON.stringify([state, action]);
function tape(selected: readonly TapeControlEvent[] = events): TapeV2 {
  const action = selected.at(-1)?.actionIndex ?? 0;
  return {
    tapeVersion: 2,
    experimentId: environment.experimentId,
    mode: environment.mode,
    modelIdentity: { modelId: environment.modelId, modelVersion: environment.modelVersion },
    constantSetId: environment.constantSetId,
    seed: "0" as U64String,
    streamVersion: environment.streamVersion,
    allocationId: environment.allocationId,
    initialConditions: { x: 1, y: 2 },
    events: selected,
    acceptedCheckpoint: {
      acceptedActionIndex: action,
      acceptedInputRevision: selected.length,
      digest: digest(stateAt(selected), action),
    },
  };
}
function observedRunner(resolve?: ReplayRunner["resolveTeachingTape"]) {
  let state: Record<string, number | string> = { untouched: 1 };
  let action = 0;
  const applied: string[] = [];
  const runner: ReplayRunner = {
    environment,
    ...(resolve ? { resolveTeachingTape: resolve } : {}),
    applyInitialConditions(conditions) {
      applied.push("initial");
      state = { ...conditions };
      action = 0;
    },
    applyEvent(event) {
      applied.push(`event:${event.actionIndex}`);
      state[event.paramId] = event.value;
      action = event.actionIndex;
    },
    getCurrentState: () => state,
    getAcceptedCheckpoint: () => ({
      acceptedActionIndex: action,
      acceptedInputRevision: applied.length,
      digest: digest(state, action),
    }),
  };
  return { runner, applied };
}
const reference = (stepIndex = 1): TapeV2 => ({
  ...tape(events.slice(0, stepIndex + 1)),
  initialConditions: { unrelated: 99 },
  teachingTapeRef: { tapeId: "authored-fixture", stepIndex },
});

test("replay refuses unresolved teaching references without applying fallback settings", () => {
  for (const resolve of [undefined, () => null]) {
    for (const forceNewRun of [false, true]) {
      const { runner, applied } = observedRunner(resolve);
      const result = replayTape(reference(), runner, { forceNewRun });
      assert.equal(result.kind, "invalid");
      if (result.kind === "invalid") assert.equal(result.reason, "teaching-tape-unavailable");
      assert.deepEqual(applied, []);
      assert.deepEqual(runner.getCurrentState(), { untouched: 1 });
    }
  }
});

test("resolver failure becomes an actionable outcome before any state change", () => {
  const { runner, applied } = observedRunner(() => {
    throw new Error("catalogue unavailable");
  });
  const result = replayTape(reference(), runner);
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.equal(result.reason, "teaching-tape-resolution-failed");
    assert.match(result.notice, /catalogue unavailable/);
  }
  assert.deepEqual(applied, []);
});

test("the resolved walkthrough's model, mode, seed and laboratory are checked", () => {
  const sources: TapeV2[] = [
    { ...tape(), modelIdentity: { modelId: "different-model", modelVersion: 1 } },
    { ...tape(), constantSetId: "different-constants" },
    { ...tape(), mode: "different-mode" },
    { ...tape(), seed: "1905" as U64String },
    { ...tape(), experimentId: "another-laboratory" },
  ];
  for (const source of sources) {
    const { runner, applied } = observedRunner(() => source);
    assert.notEqual(replayTape(reference(), runner).kind, "success");
    assert.deepEqual(applied, []);
  }
});

test("even a new run cannot route a walkthrough into another laboratory", () => {
  const { runner, applied } = observedRunner(() => ({
    ...tape(),
    experimentId: "another-laboratory",
  }));
  assert.equal(replayTape(reference(), runner, { forceNewRun: true }).kind, "invalid");
  assert.deepEqual(applied, []);
  assert.equal(
    replayTape({ ...tape(), experimentId: "another-laboratory" }, runner, { forceNewRun: true })
      .kind,
    "invalid",
  );
  assert.deepEqual(applied, []);
});

test("invalid and out-of-range steps cannot be rounded or clamped into a different replay", () => {
  for (const stepIndex of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2, 100]) {
    const { runner, applied } = observedRunner(() => tape());
    const request = { ...reference(), teachingTapeRef: { tapeId: "authored-fixture", stepIndex } };
    assert.equal(replayTape(request, runner).kind, "invalid", String(stepIndex));
    assert.deepEqual(applied, []);
  }
});

test("a teaching reference restores its exact prefix using authored settings, not the envelope", () => {
  const { runner, applied } = observedRunner(() => tape());
  const result = replayTape(reference(0), runner);
  assert.equal(result.kind, "success");
  if (result.kind === "success") {
    assert.deepEqual(result.state, { x: 3, y: 2 });
    assert.equal(result.executedEventCount, 1);
    assert.equal(result.acceptedCheckpoint.acceptedActionIndex, 2);
    assert.equal(result.isNewRun, false);
  }
  assert.deepEqual(applied, ["initial", "event:2"]);
});

test("an event-free walkthrough restores opening settings at step zero", () => {
  const { runner, applied } = observedRunner(() => tape([]));
  const result = replayTape(
    { ...tape([]), teachingTapeRef: { tapeId: "opening", stepIndex: 0 } },
    runner,
  );
  assert.equal(result.kind, "success");
  assert.deepEqual(applied, ["initial"]);
});

test("inline tapes stop at the accepted checkpoint even when later events are retained", () => {
  const { runner, applied } = observedRunner();
  const result = replayTape(
    { ...tape(), acceptedCheckpoint: tape(events.slice(0, 1)).acceptedCheckpoint },
    runner,
  );
  assert.equal(result.kind, "success");
  assert.deepEqual(runner.getCurrentState(), { x: 3, y: 2 });
  assert.deepEqual(applied, ["initial", "event:2"]);
});

test("contradictory or unreachable checkpoints are refused before replay", () => {
  for (const request of [
    { ...reference(0), acceptedCheckpoint: tape().acceptedCheckpoint },
    { ...tape(), acceptedCheckpoint: { ...tape().acceptedCheckpoint, acceptedActionIndex: 3 } },
    {
      ...tape(),
      acceptedCheckpoint: { ...tape().acceptedCheckpoint, acceptedActionIndex: Number.NaN },
    },
  ]) {
    const { runner, applied } = observedRunner(() => tape());
    assert.equal(replayTape(request, runner).kind, "invalid");
    assert.deepEqual(applied, []);
  }
});

test("out-of-order, negative and fractional action indices are rejected rather than sorted", () => {
  const first = events[0];
  assert.ok(first);
  for (const badEvents of [
    [...events].reverse(),
    [{ ...first, actionIndex: -1 }],
    [{ ...first, actionIndex: 0.5 }],
  ]) {
    const { runner, applied } = observedRunner();
    assert.equal(replayTape({ ...tape(), events: badEvents }, runner).kind, "invalid");
    assert.deepEqual(applied, []);
  }
});

test("checkpoint action identity is checked even when a runner returns the recorded digest", () => {
  const { runner } = observedRunner();
  runner.getAcceptedCheckpoint = () => ({ ...tape().acceptedCheckpoint, acceptedActionIndex: 0 });
  assert.equal(replayTape(tape(), runner).kind, "invariant-violation");
});

test("checkpoint read errors are reported instead of escaping into the reader's event handler", () => {
  const { runner } = observedRunner();
  runner.getAcceptedCheckpoint = () => {
    throw new Error("no accepted snapshot");
  };
  const result = replayTape(tape(), runner);
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") assert.equal(result.reason, "checkpoint-read-failed");
});

test("an explicitly new run still executes all requested events and reports that it is new", () => {
  const { runner, applied } = observedRunner(() => ({ ...tape(), constantSetId: "other" }));
  const result = replayTape(
    { ...reference(), acceptedCheckpoint: tape([]).acceptedCheckpoint },
    runner,
    { forceNewRun: true },
  );
  assert.equal(result.kind, "success");
  if (result.kind === "success") assert.equal(result.isNewRun, true);
  assert.deepEqual(applied, ["initial", "event:2", "event:5"]);
});

test("multiple controls at the same action retain their authored order, including action zero", () => {
  const controls: readonly TapeControlEvent[] = [
    { actionIndex: 0, commandClass: "setup-change", paramId: "x", value: 4 },
    { actionIndex: 0, commandClass: "setup-change", paramId: "y", value: 6 },
  ];
  const { runner, applied } = observedRunner();
  assert.equal(replayTape(tape(controls), runner).kind, "success");
  assert.deepEqual(runner.getCurrentState(), { x: 4, y: 6 });
  assert.deepEqual(applied, ["initial", "event:0", "event:0"]);
});
