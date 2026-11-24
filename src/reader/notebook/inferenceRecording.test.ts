import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { BM07_DEFAULTS } from "../../experiments/bm07/definition.ts";
import { BM08_DEFAULTS } from "../../experiments/bm08/definition.ts";
import {
  captureRecordedStop,
  readRecordedExperiment,
} from "../../experiments/permalink/recordedExperiments.ts";
import { validateTapeV2 } from "../../experiments/permalink/schema.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "../../experiments/permalink/workerSessionTape.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { bm07Laboratory, bm07ReplayFixture } from "../../testing/bm07ReplayHarness.ts";
import { bm08Laboratory, bm08ReplayFixture } from "../../testing/bm08ReplayHarness.ts";
import { exportNotebookJson } from "./export.ts";
import { readNotebookDocument } from "./migrations/teachBack.ts";
import { createNotebookStore } from "./notebookStore.ts";
import { openNotebookRecording, parseNotebookRecording } from "./recordingEntry.ts";
import { makeRecordingEntry } from "./saveRecording.ts";
import { createNotebookStorage } from "./storage.ts";

const bm07Fixture = await bm07ReplayFixture();
const bm08Fixture = await bm08ReplayFixture();
const sessions: WorkerTapeSession[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

function laboratory(experimentId: "bm-07" | "bm-08") {
  const lab = experimentId === "bm-07" ? bm07Laboratory(bm07Fixture) : bm08Laboratory(bm08Fixture);
  sessions.push(lab.session);
  return lab;
}

function storageContext() {
  const values = new Map<string, string>();
  const backend: Storage = {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => { values.clear(); },
  };
  return createStorageContext({ getStorage: () => backend });
}

async function capturedTrial(experimentId: "bm-07" | "bm-08") {
  const lab = laboratory(experimentId);
  const parameters = experimentId === "bm-07"
    ? { ...BM07_DEFAULTS, seed: "18446744073709551615", radiusKnown: true }
    : {
        ...BM08_DEFAULTS,
        seed: "18446744073709551615",
        noiseSeed: "9007199254740993",
        clickSeed: "9007199254740995",
      };
  expect((await applyWorkerSettings(lab.session, parameters)).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  const captured = await lab.binding.capture(lab.session, accepted);
  assert.ok(captured.kind === "captured", JSON.stringify(captured));
  const recording = captureRecordedStop(
    null,
    captured.tape,
    "A private investigation",
    "My completed trial",
    "My prediction and observation remain private.",
    validateTapeV2,
  );
  assert.ok(recording.kind === "accepted", JSON.stringify(recording));
  return { lab, parameters, tape: captured.tape, recording: recording.value };
}

for (const experimentId of ["bm-07", "bm-08"] as const) {
  test(experimentId + " scientific trial survives compact notebook persistence and verified owner replay", async () => {
    const trial = await capturedTrial(experimentId);
    const entry = makeRecordingEntry(trial.recording, "saved-" + experimentId, "2026-11-24T09:00:00.000Z");
    expect(entry.frame.paper).toBe("brownian-motion");
    expect(entry.frame.anchor).toBe("arg-bm-inference");
    const compact = JSON.stringify(entry);
    expect(compact.length).toBeLessThan(32 * 1024);
    expect(compact).toContain("streamPositionRanges");
    expect(Object.isFrozen(entry.recording.stops[0]?.tape)).toBe(true);
    const context = storageContext();
    const store = createNotebookStore(createNotebookStorage(context));
    expect(store.add(entry).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe("saved");
    const reopened = createNotebookStore(createNotebookStorage(context));
    reopened.open();
    const imported = readNotebookDocument(JSON.parse(exportNotebookJson(reopened.getSnapshot().document)));
    expect(imported.entries).toEqual([entry]);
    const saved = imported.entries[0];
    assert.ok(saved?.kind === "recording");
    expect("replay" in saved).toBe(false);
    const receiver = laboratory(experimentId);
    const previous = receiver.session.getSnapshot();
    const opened = openNotebookRecording(saved.recording);
    expect(opened).toEqual(trial.recording);
    expect(receiver.session.getSnapshot()).toBe(previous);
    expect(receiver.channels).toHaveLength(0);
    const file = readRecordedExperiment(JSON.stringify(saved.recording), experimentId, validateTapeV2);
    assert.ok(file.kind === "accepted");
    expect(file.value).toEqual(opened);
    const stop = opened.stops[0];
    assert.ok(stop?.tape.acceptedCheckpoint.scientificState);
    expect(stop.tape.seed).toBe("18446744073709551615");
    if (experimentId === "bm-07") {
      expect(stop.tape.initialConditions.radiusKnown).toBe("true");
      expect(stop.tape.acceptedCheckpoint.scientificState.streamPositions).toHaveLength(4097);
    } else {
      expect(stop.tape.initialConditions.noiseSeed).toBe("9007199254740993");
      expect(stop.tape.initialConditions.clickSeed).toBe("9007199254740995");
    }
    expect((await restoreWorkerTape(receiver.binding, receiver.session, stop.tape)).kind).toBe("restored");
    expect(receiver.session.acceptedParameters()).toEqual(trial.parameters);
    expect(receiver.session.acceptedPublication?.()?.recordingCheckpoint).toEqual(
      trial.lab.session.acceptedPublication?.()?.recordingCheckpoint,
    );
  });

  test(experimentId + " notebook admission requires science rather than settings or coverage experiments", async () => {
    const trial = await capturedTrial(experimentId);
    const settingsOnly = {
      ...trial.recording,
      stops: trial.recording.stops.map((stop) => ({
        ...stop,
        tape: {
          ...stop.tape,
          acceptedCheckpoint: {
            acceptedActionIndex: 0,
            acceptedInputRevision: 0,
            digest: stop.tape.acceptedCheckpoint.digest,
          },
        },
      })),
    };
    const original = JSON.stringify(settingsOnly);
    assert.throws(() => parseNotebookRecording(settingsOnly), {
      name: "NotebookRecordingError",
      code: "notebook-recording-scientific-checkpoint",
    });
    expect(JSON.stringify(settingsOnly)).toBe(original);
    const coverage = {
      ...trial.recording,
      stops: trial.recording.stops.map((stop) => ({
        ...stop,
        tape: {
          ...stop.tape,
          initialConditions: { ...stop.tape.initialConditions, coverageTrials: 1 },
        },
      })),
    };
    assert.throws(() => parseNotebookRecording(coverage), {
      name: "NotebookRecordingError",
      code: "notebook-recording-single-trial",
    });
    expect(parseNotebookRecording(trial.recording).experimentId).toBe(experimentId);
  });
}

test("synthetic inference recordings cannot relabel imported kitchen or historical observations", async () => {
  const trial = await capturedTrial("bm-07");
  for (const observationSet of ["kitchen", "perrin-1909"]) {
    const relabeled = {
      ...trial.recording,
      stops: trial.recording.stops.map((stop) => ({
        ...stop,
        tape: {
          ...stop.tape,
          initialConditions: { ...stop.tape.initialConditions, observationSet },
        },
      })),
    };
    assert.throws(() => parseNotebookRecording(relabeled), {
      name: "NotebookRecordingError",
      code: "notebook-recording-single-trial",
    });
  }
});
