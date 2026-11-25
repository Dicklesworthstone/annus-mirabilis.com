import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createBm06TapeBinding } from "../../experiments/bm06/tape.ts";
import { encodeTapePermalink } from "../../experiments/permalink/codec.ts";
import { draftTapeForSettings } from "../../experiments/permalink/draftTape.ts";
import {
  captureRecordedStop,
  isScientificCheckpoint,
  type RecordedExperiment,
} from "../../experiments/permalink/recordedExperiments.ts";
import { validateTapeV2 } from "../../experiments/permalink/schema.ts";
import type { TapeV2 } from "../../experiments/permalink/types.ts";
import { applyWorkerSettings } from "../../experiments/permalink/workerSessionTape.ts";
import { getNotebookStore } from "../../reader/notebook/browserStore.ts";
import { exportNotebookJson } from "../../reader/notebook/export.ts";
import { readNotebookDocument } from "../../reader/notebook/migrations/teachBack.ts";
import {
  openNotebookRecording,
  parseNotebookRecording,
} from "../../reader/notebook/recordingEntry.ts";
import { appendRecordingView } from "../../reader/notebook/recordingView.ts";
import { makeRecordingEntry } from "../../reader/notebook/saveRecording.ts";
import {
  brownianReplayFixture,
  brownianReplayLaboratory,
} from "../../testing/brownianGroupReplayHarness.ts";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom.ts";
import { BrownianLab } from "./BrownianLab.tsx";

// Production density evaluator, host, session and page. Only worker delivery timing is controlled.
const fixture = await brownianReplayFixture();
let root: Root | null = null;
const laboratories: ReturnType<typeof brownianReplayLaboratory>[] = [];
beforeEach(async () => {
  await installDom({ intersections: "visible" });
  getNotebookStore().reloadConfirmed();
  getNotebookStore().clearConfirmed();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  for (const lab of laboratories.splice(0)) lab.disconnect();
  getNotebookStore().clearConfirmed();
  await uninstallDom();
});

function laboratory(options: Parameters<typeof brownianReplayLaboratory>[1] = {}) {
  const lab = brownianReplayLaboratory(fixture, options);
  laboratories.push(lab);
  return lab;
}

async function until(ready: () => boolean) {
  const deadline = Date.now() + 10000;
  while (!ready()) {
    assert.ok(Date.now() < deadline, "The real spreading laboratory must finish its action.");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
  }
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent === label,
  );
  assert.ok(found, "Missing mounted button: " + label);
  return found;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
function field(name: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`form input[name="${name}"]`);
  assert.ok(input, "Missing laboratory field: " + name);
  return input;
}
async function edit(name: string, value: string) {
  const input = field(name);
  // happy-dom supplies no trusted input events. Invoke the actual mounted React change handler.
  const key = Object.keys(input).find((item) => item.startsWith("__reactProps$"));
  assert.ok(key);
  const props = (input as unknown as Record<string, { onChange(event: unknown): void }>)[key];
  assert.ok(props?.onChange);
  await act(async () => props.onChange({ target: { value } }));
}
function page() {
  const found = document.querySelector<HTMLElement>('.laboratory[data-instrument-id="bm-06"]');
  assert.ok(found);
  return found;
}
function output(id: string) {
  const found = page().querySelector<HTMLElement>(`[data-output="${id}"]`);
  assert.ok(found, "Missing accepted output: " + id);
  return found.textContent;
}
function recorder() {
  const found = document.querySelector<HTMLElement>('[data-experiment-recorder="bm-06"]');
  assert.ok(found);
  return found;
}

async function mount(lab: ReturnType<typeof laboratory>, tape?: TapeV2) {
  window.history.replaceState(
    {},
    "",
    "/lab/bm-06/" + (tape ? "?tape=" + encodeTapePermalink(tape) : ""),
  );
  root = createRoot(createContainer());
  await act(async () =>
    root?.render(
      <BrownianLab example={fixture.density} workerFactory={lab.inputs.workerFactories[1]} />,
    ),
  );
}

async function completedTape(patch: object = {}) {
  const lab = laboratory();
  const session = lab.bundle.sessions[1];
  const binding = createBm06TapeBinding(
    fixture.density,
    lab.inputs.workerFactories[1],
    lab.resources,
  );
  expect(
    (await applyWorkerSettings(session, { ...fixture.density.parameters, t: 4, ...patch })).kind,
  ).toBe("restored");
  const accepted = session.getSnapshot().accepted;
  assert.ok(accepted && binding.capture);
  const capture = await binding.capture(session, accepted);
  assert.ok(capture.kind === "captured", JSON.stringify(capture));
  return { lab, tape: capture.tape, binding };
}

function recording(tape: TapeV2): RecordedExperiment {
  const captured = captureRecordedStop(
    null,
    tape,
    "My spreading experiment",
    "First interval",
    "Keep this comparison",
    validateTapeV2,
  );
  assert.ok(captured.kind === "accepted", JSON.stringify(captured));
  return captured.value;
}

test("the actual spreading page saves, exports and restores a deterministic scientific stop", async () => {
  const lab = laboratory();
  await mount(lab);
  expect(lab.density).toHaveLength(0);
  expect(button("Save starting point").disabled).toBe(true);
  await edit("t", "2");
  expect(lab.density).toHaveLength(0);
  expect(button("Save starting point").disabled).toBe(true);
  await click("Apply settings");
  await until(() => !button("Save starting point").disabled);
  const probability = output("intervalProbability");
  await click("Save starting point");
  expect(recorder().textContent).toContain("scientific checkpoint and exact settings");
  expect(recorder().textContent).not.toContain("settings without a scientific checkpoint");
  await click("Save recording in notebook");
  const saved = getNotebookStore()
    .getSnapshot()
    .document.entries.find((entry) => entry.kind === "recording");
  assert.ok(saved?.kind === "recording");
  expect(saved.recording.experimentId).toBe("bm-06");
  expect(saved.frame.anchor).toBe("arg-bm-gaussian");
  const original = openNotebookRecording(saved.recording).stops[0]?.tape;
  assert.ok(original);
  expect(original.initialConditions.t).toBe(2);
  expect(original.acceptedCheckpoint.digest).toMatch(/^host:sha256:[a-f0-9]{64}$/);
  expect(original.acceptedCheckpoint.scientificState).toBeUndefined();
  const exported = readNotebookDocument(
    JSON.parse(exportNotebookJson(getNotebookStore().getSnapshot().document)),
  );
  expect(exported.entries).toEqual(getNotebookStore().getSnapshot().document.entries);
  const view = document.createElement("div");
  appendRecordingView(view, saved, () => {});
  expect(view.textContent).toContain("Saved scientific checkpoint");
  expect(view.textContent).toContain("no random stream is used");
  expect(view.textContent).not.toContain("Exact seed:");
  expect(view.querySelector("a")?.getAttribute("href")).toBe("/lab/bm-06/");

  await edit("lower", "0");
  await click("Apply settings");
  await until(
    () =>
      page().getAttribute("data-pending") === "false" &&
      output("intervalProbability") !== probability,
  );
  await click("Restore saved stop");
  await until(() => recorder().querySelector('[data-recording-outcome="replayed"]') !== null);
  expect(output("intervalProbability")).toBe(probability);
  expect(field("lower").value).toBe("-1");
  expect(field("t").value).toBe("2");
  expect(recorder().textContent).toContain(
    "reproduced and verified the recorded scientific checkpoint",
  );
  expect(lab.density.some((channel) => channel.disposed && channel.requests > 0)).toBe(true);
  expect(openNotebookRecording(saved.recording).stops[0]?.tape).toEqual(original);
});

test("a scientific URL stays inert and a delayed restore preserves newer form edits", async () => {
  const { tape } = await completedTape();
  const lab = laboratory({ densityHold: (index) => index === 0 });
  await mount(lab, tape);
  await until(() => document.querySelector('[data-replay-state="ready"]') !== null);
  expect(lab.density).toHaveLength(0);
  const previous = output("intervalProbability");
  await click("Restore recorded calculation");
  await until(() => lab.density[0]?.results.length === 1);
  await edit("upper", "3");
  expect(output("intervalProbability")).toBe(previous);
  await act(async () => lab.density[0]?.release());
  await until(() => document.querySelector('[data-replay-state="restored"]') !== null);
  expect(output("intervalProbability")).not.toBe(previous);
  expect(field("upper").value).toBe("3");
  expect(page().textContent).toContain("Your newer entries are still in the form");
  expect(lab.density[0]?.disposed).toBe(true);
});

test("cancelling a probability replay discards private worker output and retains the accepted result", async () => {
  const { tape } = await completedTape();
  const lab = laboratory({ densityHold: (index) => index === 0 });
  await mount(lab, tape);
  await until(() => document.querySelector('[data-replay-state="ready"]') !== null);
  const previous = page().getAttribute("data-snapshot-version");
  const probability = output("intervalProbability");
  await click("Restore recorded calculation");
  await until(() => lab.density[0]?.results.length === 1);
  await click("Cancel calculation");
  await until(() => lab.density[0]?.disposed === true);
  await act(async () => lab.density[0]?.release());
  expect(page().getAttribute("data-snapshot-version")).toBe(previous);
  expect(output("intervalProbability")).toBe(probability);
  expect(lab.density).toHaveLength(1);
  expect(document.querySelector('[data-replay-state="ready"]')).not.toBeNull();
  expect(button("Save starting point").disabled).toBe(true);
});

test("a SHA-shaped corrupt checkpoint cannot publish a result and offers an explicit new calculation", async () => {
  const { tape } = await completedTape();
  const corrupted = validateTapeV2({
    ...tape,
    acceptedCheckpoint: { ...tape.acceptedCheckpoint, digest: "host:sha256:" + "0".repeat(64) },
  });
  const lab = laboratory();
  await mount(lab, corrupted);
  await until(() => document.querySelector('[data-replay-state="ready"]') !== null);
  const previous = output("intervalProbability");
  await click("Restore recorded calculation");
  await until(() => document.querySelector('[data-replay-state="not-restored"]') !== null);
  expect(output("intervalProbability")).toBe(previous);
  expect(lab.density).toHaveLength(1);
  expect(lab.density[0]?.disposed).toBe(true);
  expect(button("Save starting point").disabled).toBe(true);
  await click("Calculate as a new run");
  await until(() => document.querySelector('[data-replay-state="calculated"]') !== null);
  expect(field("t").value).toBe("4");
  expect(output("intervalProbability")).not.toBe(previous);
  expect(page().textContent).toContain("The recorded result has not been verified");
  expect(corrupted.acceptedCheckpoint.digest).toBe("host:sha256:" + "0".repeat(64));
});

test("probability notebook admission refuses missing, settings-only and stochastic receipts", async () => {
  const { tape, binding } = await completedTape();
  const captured = recording(tape);
  expect(makeRecordingEntry(captured).kind).toBe("recording");
  const draft = draftTapeForSettings(binding, fixture.density.parameters);
  assert.ok(draft);
  const { lower: _lower, ...incomplete } = tape.initialConditions;
  for (const bad of [
    draft,
    { ...tape, initialConditions: incomplete },
    { ...tape, seed: "1" },
    { ...tape, streamVersion: "philox-claimed" },
    { ...tape, initialConditions: { ...tape.initialConditions, T: -1 } },
    { ...tape, modelIdentity: { ...tape.modelIdentity, artifactDigest: "host:1234" } },
  ]) {
    expect(() =>
      parseNotebookRecording({ ...captured, stops: [{ ...captured.stops[0], tape: bad }] }),
    ).toThrow();
  }
  expect(() =>
    parseNotebookRecording({
      ...captured,
      stops: [{ ...captured.stops[0], tape: { ...tape, experimentId: "bm-07" } }],
    }),
  ).toThrow();
  expect(() => parseNotebookRecording(captured, "light-quanta")).toThrow();
  for (const digest of [
    "host:sha256:",
    "host:sha256:" + "g".repeat(64),
    "host:1234",
    "sha256:" + "0".repeat(64),
  ])
    expect(isScientificCheckpoint({ digest })).toBe(false);
  expect(isScientificCheckpoint(tape.acceptedCheckpoint)).toBe(true);
  // An old source remains a private record; only its compatible laboratory may verify replay.
  const old = parseNotebookRecording({
    ...captured,
    stops: [
      {
        ...captured.stops[0],
        tape: {
          ...tape,
          modelIdentity: { ...tape.modelIdentity, artifactDigest: "host:sha256:" + "1".repeat(64) },
        },
      },
    ],
  });
  expect(openNotebookRecording(old).stops[0]?.tape.modelIdentity.artifactDigest).toBe(
    "host:sha256:" + "1".repeat(64),
  );
});
