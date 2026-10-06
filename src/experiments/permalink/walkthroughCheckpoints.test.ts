import assert from "node:assert/strict";
import test from "node:test";
import type { ControlTapeV2, TapeCheckpoint } from "../tapes/schema.ts";
import {
  checkpointAt,
  checkpointPrefixes,
  type CheckpointWalkthrough,
} from "./walkthroughCheckpoints.ts";

const cp = (actionIndex: number, label: string): TapeCheckpoint => ({
  actionIndex,
  stepIndex: actionIndex,
  simulatedTime: 0,
  digest: `host:${String(actionIndex).padStart(16, "0")}`,
  digestKind: "host",
  checkpointVersion: 1,
  streamSemanticsVersion: 1,
  seed: "0" as TapeCheckpoint["seed"],
  streamPositions: [],
  label,
  teachingNote: `Read ${label}.`,
});
const record: ControlTapeV2 = {
  tapeVersion: 2,
  tapeId: "checkpoint-test",
  experimentId: "me-01",
  mode: "me-01:default",
  modelIdentity: { modelId: "test", modelVersion: "1", artifactDigest: "test-only" },
  constantSetId: "test",
  seed: "0" as ControlTapeV2["seed"],
  streamVersion: 1,
  allocationId: "deterministic",
  initialConditions: { angle: 0, speed: 0.6, kernel: "coin" },
  events: [
    {
      kind: "control",
      actionIndex: 2,
      commandClass: "setup-change",
      commandId: "angle",
      parameterId: "angle",
      value: 45,
    },
    {
      kind: "control",
      actionIndex: 2,
      commandClass: "setup-change",
      commandId: "kernel",
      parameterId: "kernel",
      value: "gaussian",
    },
    {
      kind: "prediction",
      actionIndex: 4,
      instrumentId: "me-01",
      promptId: "predict",
      payload: { form: "candidate", candidateId: "same" },
    },
    {
      kind: "control",
      actionIndex: 7,
      commandClass: "observer-change",
      commandId: "speed",
      parameterId: "speed",
      value: 0.1,
    },
  ],
  checkpoints: [cp(0, "Opening"), cp(2, "Turned"), cp(7, "New observer")],
};

test("checkpoint prefixes preserve each authored digest, label and teaching note", () => {
  const stops = checkpointPrefixes(record);
  assert.equal(stops.length, 3);
  for (const [index, stop] of stops.entries()) {
    assert.equal(stop.record.checkpoints.length, 1);
    assert.equal(stop.record.checkpoints[0], record.checkpoints[index]);
    assert.equal(stop.label, record.checkpoints[index]?.label);
    assert.equal(stop.teachingNote, record.checkpoints[index]?.teachingNote);
  }
  assert.notEqual(stops[0]?.record.checkpoints[0]?.digest, stops[2]?.record.checkpoints[0]?.digest);
});

test("opening checkpoint has no future controls or prediction answer", () => {
  const first = checkpointPrefixes(record)[0];
  assert.deepEqual(first?.record.events, []);
  assert.deepEqual(first?.settings, record.initialConditions);
});

test("sparse action indices and simultaneous controls select the complete prefix", () => {
  const middle = checkpointPrefixes(record)[1];
  assert.deepEqual(
    middle?.record.events.map((e) => e.actionIndex),
    [2, 2],
  );
  assert.deepEqual(middle?.settings, { angle: 45, speed: 0.6, kernel: "gaussian" });
});

test("predictions remain in the replay record without becoming settings", () => {
  const last = checkpointPrefixes(record)[2];
  assert.ok(last?.record.events.some((e) => e.kind === "prediction"));
  assert.deepEqual(last?.settings, { angle: 45, speed: 0.1, kernel: "gaussian" });
  assert.equal(Object.hasOwn(last?.settings ?? {}, "predict"), false);
});

test("seeking backwards reconstructs the opening state without inheriting later settings", () => {
  const stops = checkpointPrefixes(record);
  assert.equal(stops[2]?.settings.speed, 0.1);
  assert.equal(stops[1]?.settings.speed, 0.6);
  assert.equal(stops[0]?.settings.angle, 0);
  assert.equal(stops[0]?.settings.kernel, "coin");
});

test("building prefixes does not mutate the record or share mutable settings between stops", () => {
  const before = JSON.stringify(record);
  const stops = checkpointPrefixes(record);
  assert.notEqual(stops[0]?.settings, record.initialConditions);
  assert.notEqual(stops[0]?.settings, stops[1]?.settings);
  assert.equal(JSON.stringify(record), before);
});

test("a record without checkpoints does not receive invented verification", () => {
  assert.deepEqual(checkpointPrefixes({ ...record, checkpoints: [] }), []);
});

test("unnamed checkpoints get an action-based label, not an invented teaching note", () => {
  const { label: _label, teachingNote: _note, ...bare } = cp(2, "ignored");
  const stop = checkpointPrefixes({ ...record, checkpoints: [bare] })[0];
  assert.equal(stop?.label, "Checkpoint at action 2");
  assert.equal(stop?.teachingNote, undefined);
});

test("checkpoint selection rejects invalid positions rather than silently clamping", () => {
  const walkthrough: CheckpointWalkthrough = {
    tapeId: "test",
    experimentId: "me-01",
    title: "Test",
    checkpoints: [{ actionIndex: 0, label: "Opening", settings: {}, tape: null }],
  };
  assert.equal(checkpointAt(walkthrough, 0), walkthrough.checkpoints[0]);
  for (const index of [-1, 0.5, 1, 100, Number.NaN, Number.POSITIVE_INFINITY])
    assert.equal(checkpointAt(walkthrough, index), null);
});
