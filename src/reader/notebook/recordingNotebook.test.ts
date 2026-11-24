import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { BM01_DEFAULTS } from "../../experiments/bm01/definition.ts";
import { BM05_DEFAULTS } from "../../experiments/bm05/definition.ts";
import {
  captureRecordedStop,
  readRecordedExperiment,
  RECORDING_LIMITS,
  type RecordingResult,
  writeRecordedExperiment,
} from "../../experiments/permalink/recordedExperiments.ts";
import { validateTapeV2 } from "../../experiments/permalink/schema.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "../../experiments/permalink/workerSessionTape.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { HOST_WALK_NORMALS } from "../../physics/reference/diffusion/walks.ts";
import { bm01Laboratory, bm01ReplayFixture } from "../../testing/bm01ReplayHarness.ts";
import { bm05Laboratory, bm05ReplayFixture } from "../../testing/bm05ReplayHarness.ts";
import { HOST_TRACER_RECORDER } from "../../workers/operations/bm01.ts";
import { exportNotebookJson } from "./export.ts";
import { readNotebookDocument } from "./migrations/teachBack.ts";
import { createNotebookStore } from "./notebookStore.ts";
import { openNotebookRecording, parseNotebookRecording } from "./recordingEntry.ts";
import { NOTEBOOK_KEY, type NotebookRecordingEntry, parseNotebookEntry } from "./schema.ts";
import { createNotebookStorage } from "./storage.ts";

const bm01Fixture = await bm01ReplayFixture();
const bm05Fixture = await bm05ReplayFixture();
const sessions: WorkerTapeSession[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

function laboratory(experimentId: "bm-01" | "bm-05") {
  const lab = experimentId === "bm-01"
    ? bm01Laboratory(bm01Fixture, { recorder: () => HOST_TRACER_RECORDER })
    : bm05Laboratory(bm05Fixture, { normals: () => HOST_WALK_NORMALS });
  sessions.push(lab.session);
  return lab;
}

function accepted<T>(result: RecordingResult<T>): T {
  assert.ok(result.kind === "accepted", JSON.stringify(result));
  return result.value;
}

function storageFixture() {
  const values = new Map<string, string>();
  const mode = { blocked: false, quota: false };
  const backend: Storage = {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => { values.delete(key); },
    clear: () => { values.clear(); },
    setItem(key, value) {
      if (mode.quota) throw new DOMException("Fixture quota exceeded", "QuotaExceededError");
      values.set(key, value);
    },
  };
  const context = createStorageContext({
    getStorage() {
      if (mode.blocked) throw new DOMException("Fixture storage blocked", "SecurityError");
      return backend;
    },
  });
  return { values, mode, context };
}

async function recordedTrial(experimentId: "bm-01" | "bm-05") {
  const source = laboratory(experimentId);
  // Keep ordinary population sizes; only shorten the run for a focused owner integration test.
  const parameters = experimentId === "bm-01"
    ? { ...BM01_DEFAULTS, seed: "18446744073709551615", H: 1, interval: 0.2 }
    : { ...BM05_DEFAULTS, seed: "18446744073709551615", kernel: "gaussian", runSteps: 8, n: 4 };
  expect((await applyWorkerSettings(source.session, parameters)).kind).toBe("restored");
  const snapshot = source.session.getSnapshot().accepted;
  assert.ok(snapshot && source.binding.capture);
  const capture = await source.binding.capture(source.session, snapshot);
  assert.ok(capture.kind === "captured", JSON.stringify(capture));
  const recording = accepted(captureRecordedStop(
    null, capture.tape, "Private <script>recording</script>", "A stop I chose",
    "My private prediction and observation.\n<script>never execute this</script>",
    validateTapeV2,
  ));
  const entry = parseNotebookEntry({
    id: "recording-" + experimentId,
    kind: "recording",
    title: recording.title,
    text: "",
    createdAt: "2026-09-17T14:00:00.000Z",
    frame: {
      paper: "brownian-motion", anchor: "arg-bm-observable",
      view: "reading", detail: 1, lens: "paper", open: "",
    },
    recording,
  });
  assert.ok(entry.kind === "recording");
  return { source, parameters, capture, recording, entry };
}

for (const experimentId of ["bm-01", "bm-05"] as const) {
  test(experimentId + " default-population checkpoints survive notebook save, reload, export and explicit verified replay", async () => {
    const trial = await recordedTrial(experimentId);
    const positions = trial.capture.tape.acceptedCheckpoint.scientificState?.streamPositions;
    assert.ok(positions);
    expect(positions.length).toBe(experimentId === "bm-01" ? BM01_DEFAULTS.M * 3 : BM05_DEFAULTS.walkers);
    const storedSource = JSON.stringify(trial.entry);
    expect(storedSource.length).toBeLessThan(32 * 1024);
    expect(storedSource).toContain("streamPositionRanges");
    expect(storedSource).not.toContain('"streamPositions"');
    expect(Object.isFrozen(trial.entry.recording.stops[0]?.tape)).toBe(true);

    const fixture = storageFixture();
    const store = createNotebookStore(createNotebookStorage(fixture.context));
    expect(store.add(trial.entry).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe("saved");
    const reopened = createNotebookStore(createNotebookStorage(fixture.context));
    reopened.open();
    const exported = exportNotebookJson(reopened.getSnapshot().document);
    const imported = readNotebookDocument(JSON.parse(exported));
    expect(imported.entries).toEqual([trial.entry]);
    const saved = imported.entries[0];
    assert.ok(saved?.kind === "recording");
    expect("replay" in saved).toBe(false);

    const receiver = laboratory(experimentId);
    const before = receiver.session.getSnapshot();
    const opened = openNotebookRecording(saved.recording);
    expect(opened).toEqual(trial.recording);
    // Its compact private download is accepted by the existing recording-file importer.
    expect(accepted(readRecordedExperiment(
      JSON.stringify(saved.recording), experimentId, validateTapeV2,
    ))).toEqual(trial.recording);
    expect(receiver.channels).toHaveLength(0);
    expect(receiver.session.getSnapshot()).toBe(before);

    const stop = opened.stops[0];
    assert.ok(stop);
    expect(stop.tape.seed).toBe("18446744073709551615");
    expect((await restoreWorkerTape(receiver.binding, receiver.session, stop.tape)).kind).toBe("restored");
    expect(receiver.session.acceptedParameters()).toEqual(trial.parameters);
    expect(receiver.session.acceptedPublication?.()?.recordingCheckpoint).toEqual(
      trial.source.session.acceptedPublication?.()?.recordingCheckpoint,
    );
    assert.throws(() => parseNotebookEntry({
      ...saved, frame: { ...saved.frame, paper: "light-quanta" },
    }), { name: "NotebookRecordingError", code: "notebook-recording-paper" });
    assert.throws(() => parseNotebookRecording(saved.recording, "light-quanta"), {
      name: "NotebookRecordingError", code: "notebook-recording-paper",
    });
  });
}

test("complete recordings remain exportable through blocked, quota and protected notebook storage", async () => {
  const { entry } = await recordedTrial("bm-05");
  for (const failure of ["blocked", "quota", "protected"] as const) {
    const fixture = storageFixture();
    const original = JSON.stringify({ schemaVersion: 99, original: "future notebook" });
    if (failure === "protected") fixture.values.set(NOTEBOOK_KEY, original);
    else fixture.mode[failure] = true;
    const store = createNotebookStore(createNotebookStorage(fixture.context));
    expect(store.add(entry).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe(failure === "protected" ? "protected" : "session-only");
    const exported = readNotebookDocument(JSON.parse(exportNotebookJson(store.getSnapshot().document)));
    expect(exported.entries).toEqual([entry]);
    const saved = exported.entries[0] as NotebookRecordingEntry;
    expect(openNotebookRecording(saved.recording).stops[0]?.tape.seed).toBe("18446744073709551615");
    if (failure === "protected") {
      store.retry();
      expect(fixture.values.get(NOTEBOOK_KEY)).toBe(original);
    } else {
      fixture.mode[failure] = false;
      store.retry();
      expect(store.getSnapshot().persistence).toBe("saved");
    }
  }
});

test("compact recordings cannot bypass the recorder's decoded envelope traversal limit", async () => {
  const { entry } = await recordedTrial("bm-05");
  const saved = entry.recording.stops[0];
  assert.ok(saved);
  // Imported tapes may name historical settings the current physical model will later refuse.
  // These numeric fields exercise JSON admission only; this counterexample is never replayed.
  const extra = Object.fromEntries(
    Array.from({ length: 20_000 }, (_, index) => ["p" + index, 0]),
  );
  const tape = {
    ...saved.tape,
    initialConditions: {
      ...(saved.tape.initialConditions as Readonly<Record<string, unknown>>),
      ...extra,
    },
  };
  const compact = {
    ...entry.recording,
    stops: [
      { ...saved, id: "first-stop", tape },
      { ...saved, id: "second-stop", tape },
    ],
  };
  const original = JSON.stringify(compact);
  expect(new TextEncoder().encode(original).length).toBeLessThan(RECORDING_LIMITS.bytes);
  // Each detached stop fits the owner limit, while the combined expanded envelope does not.
  const opened = accepted(readRecordedExperiment(original, "bm-05", validateTapeV2));
  expect(new TextEncoder().encode(JSON.stringify(opened)).length).toBeLessThan(RECORDING_LIMITS.bytes);
  expect(writeRecordedExperiment(opened, validateTapeV2).kind).toBe("refused");
  assert.throws(() => parseNotebookRecording(compact), {
    name: "NotebookRecordingError", code: "notebook-recording-complexity",
  });
  expect(JSON.stringify(compact)).toBe(original);
});
