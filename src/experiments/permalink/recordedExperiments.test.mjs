import assert from "node:assert/strict";
import test from "node:test";
import {
  captureRecordedStop,
  readRecordedExperiment,
  recordedExperimentWalkthrough,
  RECORDING_FORMAT,
  RECORDING_LIMITS,
  writeRecordedExperiment,
} from "./recordedExperiments.ts";

// These tests exercise recording structure and tape-admission delegation. The integration tests
// beside this file use validateTapeV2; this deliberately does not invent another wire validator.
const admit = (raw) => structuredClone(raw);
const tape = (value = 0.6, patch = {}) => ({
  tapeVersion: 2,
  experimentId: "me-01",
  mode: "me-01:default",
  modelIdentity: { modelId: "two-ledgers", modelVersion: 1, evaluatorSourceHash: "pinned-source" },
  constantSetId: "modern-si-2019",
  seed: "0",
  streamVersion: "deterministic",
  allocationId: "deterministic",
  initialConditions: { frameSpeed: value, notation: "original", cancelAngleFactors: "false" },
  events: [],
  acceptedCheckpoint: {
    acceptedActionIndex: 0,
    acceptedInputRevision: 1,
    digest: "host:0123456789abcdef",
  },
  ...patch,
});
const raw = (stops = [{ id: "stop-1", label: "Opening", note: "", tape: tape() }], patch = {}) => ({
  format: RECORDING_FORMAT,
  version: 1,
  experimentId: "me-01",
  title: "Two observers",
  stops,
  ...patch,
});
const read = (value, decoder = admit) =>
  readRecordedExperiment(JSON.stringify(value), "me-01", decoder);
const accepted = (result) => {
  assert.equal(result.kind, "accepted", result.notice);
  return result.value;
};
const refused = (result) => {
  assert.equal(result.kind, "refused");
  assert.ok(result.notice.length > 0);
};

test("record, export and reopen several stops without losing identities, notes or exact settings", () => {
  let recording = null;
  for (const [i, value] of [0.6, -0.35, 1e-18].entries())
    recording = accepted(
      captureRecordedStop(
        recording,
        tape(value),
        "My investigation",
        `Stop ${i}`,
        `Prediction ${i}\nOutcome β`,
        admit,
      ),
    );
  const source = accepted(writeRecordedExperiment(recording, admit));
  const imported = accepted(readRecordedExperiment(source, "me-01", admit));
  assert.deepEqual(imported, recording);
  assert.deepEqual(
    imported.stops.map((s) => s.tape.initialConditions.frameSpeed),
    [0.6, -0.35, 1e-18],
  );
  assert.equal(imported.stops[0].tape.modelIdentity.evaluatorSourceHash, "pinned-source");
  assert.equal(imported.stops[2].note, "Prediction 2\nOutcome β");
});

test("the initial stop is independent of later caller mutation and all nested data is frozen", () => {
  const original = tape();
  const recording = accepted(captureRecordedStop(null, original, "Title", "Start", "", admit));
  original.initialConditions.frameSpeed = 0.9;
  original.modelIdentity.modelVersion = 999;
  assert.equal(recording.stops[0].tape.initialConditions.frameSpeed, 0.6);
  assert.equal(recording.stops[0].tape.modelIdentity.modelVersion, 1);
  for (const value of [
    recording,
    recording.stops,
    recording.stops[0],
    recording.stops[0].tape,
    recording.stops[0].tape.initialConditions,
    recording.stops[0].tape.modelIdentity,
  ])
    assert.ok(Object.isFrozen(value));
  assert.throws(() => {
    recording.stops[0].note = "changed";
  }, TypeError);
});

test("capture appends without mutating an earlier recording", () => {
  const first = accepted(captureRecordedStop(null, tape(), "First", "Opening", "Keep", admit));
  const second = accepted(captureRecordedStop(first, tape(0.2), "Renamed", "Other", "Next", admit));
  assert.equal(first.stops.length, 1);
  assert.equal(first.title, "First");
  assert.equal(second.title, "Renamed");
  assert.equal(second.stops.length, 2);
  assert.notEqual(second.stops[0], first.stops[0]);
});

test("admission delegates EVERY tape with its exact field path", () => {
  const called = [];
  const value = raw(
    Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, label: `L${i}`, note: "", tape: tape(i) })),
  );
  accepted(
    read(value, (item, path) => {
      called.push([item, path]);
      return admit(item);
    }),
  );
  assert.equal(called.length, 3);
  assert.deepEqual(
    called.map((c) => c[1]),
    ["recording.stops[0].tape", "recording.stops[1].tape", "recording.stops[2].tape"],
  );
  assert.deepEqual(
    called.map((c) => c[0]),
    value.stops.map((s) => s.tape),
  );
});

test("a schema refusal in a later stop refuses the WHOLE import, not a usable prefix", () => {
  const value = raw([
    { id: "s1", label: "Good", note: "", tape: tape() },
    { id: "s2", label: "Bad", note: "", tape: tape(0.2) },
  ]);
  const result = read(value, (item) => {
    if (item.initialConditions.frameSpeed === 0.2) throw Error("invalid");
    return admit(item);
  });
  refused(result);
  assert.match(result.notice, /stop 2/);
  assert.equal(Object.hasOwn(result, "value"), false);
});

test("wrong-lab headers and mixed-lab stops are refused", () => {
  refused(read(raw(undefined, { experimentId: "lq-05" })));
  refused(
    read(raw([{ id: "s1", label: "Wrong", note: "", tape: tape(1, { experimentId: "lq-05" }) }])),
  );
});

test("a new stop cannot switch an existing recording into a different laboratory", () => {
  const current = accepted(read(raw()));
  refused(
    captureRecordedStop(current, tape(0.5, { experimentId: "lq-05" }), "Title", "Next", "", admit),
  );
  assert.equal(current.experimentId, "me-01");
  assert.equal(current.stops.length, 1);
});

test("unsupported versions, formats, missing fields and unknown fields fail closed", () => {
  for (const patch of [
    { version: 2 },
    { format: "another-app" },
    { added: true },
    { title: undefined },
  ])
    refused(read(raw(undefined, patch)));
  for (const value of [null, false, 12, [], "a recording"]) refused(read(value));
  refused(read(raw([{ id: "s1", label: "A", note: "", tape: tape(), extra: true }])));
});

test("empty and oversized stop populations are refused; the exact bound is usable", () => {
  refused(read(raw([])));
  const entries = Array.from({ length: RECORDING_LIMITS.stops }, (_, i) => ({
    id: `s${i}`,
    label: `Stop ${i}`,
    note: "",
    tape: tape(),
  }));
  const full = accepted(read(raw(entries)));
  refused(read(raw([...entries, { ...entries[0], id: "overflow" }])));
  refused(captureRecordedStop(full, tape(), full.title, "Too many", "", admit));
  assert.equal(full.stops.length, RECORDING_LIMITS.stops);
});

test("stop identifiers are unique, bounded, and retained across export", () => {
  const current = accepted(read(raw([{ id: "stop-2", label: "A", note: "", tape: tape() }])));
  const next = accepted(captureRecordedStop(current, tape(), current.title, "A", "", admit));
  assert.deepEqual(
    next.stops.map((s) => s.id),
    ["stop-2", "stop-3"],
  );
  refused(read(raw([raw().stops[0], raw().stops[0]])));
  for (const id of ["", "a/b", "<x>", "a".repeat(81)])
    refused(read(raw([{ ...raw().stops[0], id }])));
});

test("identical settings may have distinct predictions and stable stop identities", () => {
  const a = accepted(captureRecordedStop(null, tape(), "Repeat", "Same label", "Before", admit));
  const b = accepted(captureRecordedStop(a, tape(), "Repeat", "Same label", "After", admit));
  assert.equal(b.stops.length, 2);
  assert.notEqual(b.stops[0].id, b.stops[1].id);
  assert.deepEqual(
    b.stops.map((s) => s.note),
    ["Before", "After"],
  );
});

test("titles, labels, and notes have independent explicit bounds", () => {
  for (const title of ["", "  ", "x".repeat(RECORDING_LIMITS.title + 1)])
    refused(read(raw(undefined, { title })));
  for (const label of ["", "  ", "x".repeat(RECORDING_LIMITS.label + 1)])
    refused(read(raw([{ ...raw().stops[0], label }])));
  refused(read(raw([{ ...raw().stops[0], note: "x".repeat(RECORDING_LIMITS.note + 1) }])));
  accepted(
    read(
      raw(
        [
          {
            ...raw().stops[0],
            label: "x".repeat(RECORDING_LIMITS.label),
            note: "x".repeat(RECORDING_LIMITS.note),
          },
        ],
        { title: "x".repeat(RECORDING_LIMITS.title) },
      ),
    ),
  );
});

test("HTML-looking notes and international text remain plain, unmodified data", () => {
  const note = "<img src=x onerror=alert(1)>\nGröße · β · 光";
  const recording = accepted(read(raw([{ ...raw().stops[0], note }])));
  assert.equal(recording.stops[0].note, note);
  assert.equal(recordedExperimentWalkthrough(recording).checkpoints[0].teachingNote, note);
});

test("the input limit counts UTF-8 bytes, not just JavaScript characters", () => {
  refused(readRecordedExperiment(" ".repeat(RECORDING_LIMITS.bytes + 1), "me-01", admit));
  const source = '"' + "光".repeat(Math.ceil(RECORDING_LIMITS.bytes / 3)) + '"';
  assert.ok(source.length < RECORDING_LIMITS.bytes);
  const result = readRecordedExperiment(source, "me-01", admit);
  refused(result);
  assert.match(result.notice, /megabyte/);
});

test("malformed, deeply nested and non-finite JSON is rejected before tape admission", () => {
  let calls = 0;
  const decoder = (value) => {
    calls++;
    return admit(value);
  };
  for (const source of ["{", "[".repeat(26) + "0" + "]".repeat(26), '{"n":1e999}'])
    refused(readRecordedExperiment(source, "me-01", decoder));
  assert.equal(calls, 0);
});

test("prototype-bearing keys at any depth never reach tape admission", () => {
  let calls = 0;
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const source = JSON.stringify(raw()).replace(
      '"frameSpeed":0.6',
      `"frameSpeed":0.6,"${key}":{"polluted":true}`,
    );
    refused(
      readRecordedExperiment(source, "me-01", (value) => {
        calls++;
        return admit(value);
      }),
    );
  }
  assert.equal(calls, 0);
  assert.equal({}.polluted, undefined);
});

test("event tapes, self-references and noninitial checkpoints are not mislabeled as captured snapshots", () => {
  for (const patch of [
    {
      events: [
        { actionIndex: 1, paramId: "frameSpeed", value: 0.9, commandClass: "change-parameter" },
      ],
    },
    { teachingTapeRef: { tapeId: "the-two-pulses", stepIndex: 0 } },
    {
      acceptedCheckpoint: {
        acceptedActionIndex: 1,
        acceptedInputRevision: 2,
        digest: "host:0123456789abcdef",
      },
    },
  ])
    refused(read(raw([{ ...raw().stops[0], tape: tape(0.6, patch) }])));
});

test("conversion retains each stop's own identity and checkpoint without marking it verified", () => {
  const recording = accepted(
    read(
      raw([
        {
          id: "s1",
          label: "Historical",
          note: "Compare",
          tape: tape(0.1, {
            constantSetId: "historical",
            acceptedCheckpoint: {
              acceptedActionIndex: 0,
              acceptedInputRevision: 2,
              digest: "host:1111111111111111",
            },
          }),
        },
        { id: "s2", label: "Modern", note: "Later", tape: tape(0.8) },
      ]),
    ),
  );
  const walkthrough = recordedExperimentWalkthrough(recording);
  assert.equal(walkthrough.experimentId, "me-01");
  assert.deepEqual(
    walkthrough.checkpoints.map((s) => s.tape),
    recording.stops.map((s) => s.tape),
  );
  assert.equal(walkthrough.checkpoints[0].tape.constantSetId, "historical");
  assert.equal(walkthrough.checkpoints[0].tape.acceptedCheckpoint.digest, "host:1111111111111111");
  assert.deepEqual(walkthrough.checkpoints[1].settings, recording.stops[1].tape.initialConditions);
  assert.equal(Object.hasOwn(walkthrough, "verified"), false);
});

test("export is deterministic, bounded, and revalidates every stop", () => {
  const recording = accepted(read(raw()));
  assert.equal(
    accepted(writeRecordedExperiment(recording, admit)),
    accepted(writeRecordedExperiment(recording, admit)),
  );
  refused(
    writeRecordedExperiment(recording, () => {
      throw Error("schema no longer admits");
    }),
  );
  assert.equal(recording.stops.length, 1);
});

test("a failed new capture preserves previously saved stops", () => {
  const recording = accepted(read(raw()));
  const before = JSON.stringify(recording);
  refused(captureRecordedStop(recording, tape(), "", "Label", "", admit));
  assert.equal(JSON.stringify(recording), before);
});
