import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { BM01_DEFAULTS } from "../../experiments/bm01/definition.ts";
import { createBm01WalkthroughTarget } from "../../experiments/bm01/tape.ts";
import { BM05_DEFAULTS } from "../../experiments/bm05/definition.ts";
import { createBm05WalkthroughTarget } from "../../experiments/bm05/tape.ts";
import { ExperimentRecorder } from "../../experiments/permalink/ExperimentRecorder.tsx";
import {
  captureRecordedStop,
  writeRecordedExperiment,
} from "../../experiments/permalink/recordedExperiments.ts";
import { validateTapeV2 } from "../../experiments/permalink/schema.ts";
import {
  applyWorkerSettings,
  type WorkerTapeSession,
} from "../../experiments/permalink/workerSessionTape.ts";
import { HOST_WALK_NORMALS } from "../../physics/reference/diffusion/walks.ts";
import { bm01Laboratory, bm01ReplayFixture } from "../../testing/bm01ReplayHarness.ts";
import { bm05Laboratory, bm05ReplayFixture } from "../../testing/bm05ReplayHarness.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { HOST_TRACER_RECORDER } from "../../workers/operations/bm01.ts";
import { getNotebookStore } from "./browserStore.ts";
import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
import { readNotebookDocument } from "./migrations/teachBack.ts";
import { mountNotebookMergePanel } from "./mergePanel.ts";
import { mountNotebookPanel } from "./panel.ts";
import { openNotebookRecording } from "./recordingEntry.ts";
import { makeRecordingEntry, saveNotebookRecording } from "./saveRecording.ts";
import { NOTEBOOK_KEY } from "./schema.ts";

const bm01Fixture = await bm01ReplayFixture();
const bm05Fixture = await bm05ReplayFixture();
const sessions: WorkerTapeSession[] = [];

beforeEach(async () => {
  await installDom();
  getNotebookStore().reloadConfirmed();
  getNotebookStore().clearConfirmed();
});
afterEach(async () => {
  for (const session of sessions.splice(0)) session.disconnect();
  getNotebookStore().clearConfirmed();
  await uninstallDom();
});

function laboratory(experimentId: "bm-01" | "bm-05") {
  const lab = experimentId === "bm-01"
    ? bm01Laboratory(bm01Fixture, { recorder: () => HOST_TRACER_RECORDER })
    : bm05Laboratory(bm05Fixture, { normals: () => HOST_WALK_NORMALS });
  sessions.push(lab.session);
  const target = experimentId === "bm-01"
    ? createBm01WalkthroughTarget(lab.binding, lab.session, () => {})
    : createBm05WalkthroughTarget(lab.binding, lab.session, () => {});
  return { ...lab, target };
}

async function completedTrial(experimentId: "bm-01" | "bm-05") {
  const lab = laboratory(experimentId);
  const parameters = experimentId === "bm-01"
    ? { ...BM01_DEFAULTS, seed: "18446744073709551615", M: 4, H: 1, interval: 0.2 }
    : {
        ...BM05_DEFAULTS,
        seed: "18446744073709551615",
        kernel: "gaussian",
        walkers: 8,
        runSteps: 8,
        n: 4,
      };
  expect((await applyWorkerSettings(lab.session, parameters)).kind).toBe("restored");
  const accepted = lab.session.getSnapshot().accepted;
  assert.ok(accepted && lab.binding.capture);
  const capture = await lab.binding.capture(lab.session, accepted);
  assert.ok(capture.kind === "captured", JSON.stringify(capture));
  return { lab, parameters, tape: capture.tape };
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find((item) => item.textContent === label);
  assert.ok(found, "Missing button: " + label);
  return found;
}
async function click(host: HTMLElement, label: string) {
  await act(async () => { button(host, label).click(); });
}
async function until(ready: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!ready() && Date.now() < deadline) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  expect(ready()).toBe(true);
}
function changeHandler(element: HTMLElement): (event: unknown) => void {
  // This repository's happy-dom harness requires the actual React props handler for changes.
  const key = Object.keys(element).find((item) => item.startsWith("__reactProps$"));
  assert.ok(key);
  const props = (element as unknown as Record<string, { onChange?: (event: unknown) => void }>)[key];
  assert.ok(props?.onChange);
  return props.onChange;
}
async function textField(host: HTMLElement, label: string, value: string) {
  const caption = [...host.querySelectorAll("label")].find((item) => item.textContent === label);
  assert.ok(caption?.htmlFor);
  const input = document.getElementById(caption.htmlFor);
  assert.ok(input);
  await act(async () => {
    changeHandler(input)({ currentTarget: { value } });
  });
}

for (const experimentId of ["bm-01", "bm-05"] as const) {
  test(experimentId + " ordinary recorder saves to notebook, returns after navigation and restores only on request", async () => {
    const trial = await completedTrial(experimentId);
    const sourceHost = createContainer();
    const sourceRoot = createRoot(sourceHost);
    const title = experimentId + " private experiment";
    const note = "My observation <script>never run this</script>";
    try {
      await act(async () => {
        sourceRoot.render(<ExperimentRecorder target={trial.lab.target} tape={trial.tape} />);
      });
      await textField(sourceHost, "Recording title", title);
      await textField(sourceHost, "Label for the next stop (optional)", "The stop I want to return to");
      await textField(sourceHost, "What did you predict or notice? (optional)", note);
      await click(sourceHost, "Save starting point");
      await click(sourceHost, "Save recording in notebook");
      await until(() => sourceHost.textContent?.includes("Kept a copy in your notebook.") === true);
      expect([...sourceHost.querySelectorAll("button")].every((item) => item.type === "button")).toBe(true);
    } finally {
      await act(async () => {
        sourceRoot.unmount();
      });
      removeContainer(sourceHost);
    }

    const store = getNotebookStore();
    expect(store.getSnapshot().persistence).toBe("saved");
    expect(window.localStorage.getItem(NOTEBOOK_KEY)).not.toBeNull();
    store.reloadConfirmed();
    const saved = store.getSnapshot().document.entries[0];
    assert.ok(saved?.kind === "recording");
    expect(saved.title).toBe(title);
    expect(saved.recording.stops[0]?.note).toBe(note);
    const imported = readNotebookDocument(JSON.parse(exportNotebookJson(store.getSnapshot().document)));
    expect(imported.entries).toEqual([saved]);
    const html = exportNotebookHtml(imported);
    expect(html).toContain("never run this");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(openNotebookRecording(saved.recording).stops[0]?.tape.seed).toBe("18446744073709551615");

    const receiver = laboratory(experimentId);
    const before = receiver.session.getSnapshot();
    const preview = store.previewImport({
      ...imported,
      entries: [{ ...saved, id: saved.id + "-copy" }],
    });
    assert.ok(preview.ok);
    const mergeHost = createContainer();
    const mergePanel = mountNotebookMergePanel(
      mergeHost, store, preview.review, () => {}, () => {},
    );
    try {
      expect(mergeHost.textContent).toContain("Inspect the complete saved recording");
      expect(mergeHost.querySelector("pre")?.textContent).toContain("18446744073709551615");
      expect(mergeHost.querySelector("pre")?.textContent).toContain(note);
      expect(mergeHost.querySelector("script")).toBeNull();
      expect(store.getSnapshot().document.entries).toEqual([saved]);
      expect(receiver.channels).toHaveLength(0);
    } finally {
      mergePanel.dispose();
      removeContainer(mergeHost);
    }
    const panelHost = createContainer();
    const panel = mountNotebookPanel(panelHost, store, () => {}, { inline: true });
    try {
      expect(panelHost.textContent).toContain(note);
      expect(panelHost.querySelector("script")).toBeNull();
      const link = panelHost.querySelector<HTMLAnchorElement>('[data-notebook-recording] a');
      expect(link?.getAttribute("href")).toBe("/lab/" + experimentId + "/");
      expect(link?.getAttribute("href")).not.toContain(saved.id);
      expect(link?.getAttribute("href")).not.toContain("?");
      expect(receiver.channels).toHaveLength(0);
      expect(receiver.session.getSnapshot()).toBe(before);
    } finally {
      panel.dispose();
      removeContainer(panelHost);
    }

    const receiverHost = createContainer();
    const receiverRoot = createRoot(receiverHost);
    try {
      await act(async () => {
        receiverRoot.render(<ExperimentRecorder target={receiver.target} tape={null} />);
      });
      await click(receiverHost, "Show notebook recordings");
      await until(() => receiverHost.textContent?.includes(title) === true);
      await click(receiverHost, "Open saved recording");
      await until(() =>
        [...receiverHost.querySelectorAll("button")].some(
          (item) => item.textContent === "Open notebook recording",
        ),
      );
      expect(receiver.session.getSnapshot()).toBe(before);
      expect(receiver.channels).toHaveLength(0);
      await click(receiverHost, "Open notebook recording");
      expect(receiverHost.textContent).toContain(note);
      expect(receiver.session.getSnapshot()).toBe(before);
      expect(receiver.channels).toHaveLength(0);
      await click(receiverHost, "Restore saved stop");
      await until(() => receiverHost.querySelector('[data-recording-outcome="replayed"]') !== null);
      expect(receiver.session.acceptedParameters()).toEqual(trial.parameters);
      expect(receiver.session.acceptedPublication?.()?.recordingCheckpoint).toEqual(
        trial.lab.session.acceptedPublication?.()?.recordingCheckpoint,
      );
      expect(store.getSnapshot().document.entries).toEqual([saved]);
    } finally {
      await act(async () => {
        receiverRoot.unmount();
      });
      removeContainer(receiverHost);
    }
  });
}

test("notebook and file selection share one import generation and never start replay", async () => {
  const trial = await completedTrial("bm-05");
  const captured = captureRecordedStop(null, trial.tape, "Notebook choice", "One stop", "Private note", validateTapeV2);
  assert.ok(captured.kind === "accepted");
  assert.throws(
    () => makeRecordingEntry({ ...captured.value, experimentId: "me-01" }),
    { name: "NotebookRecordingError", code: "notebook-recording-save-instrument" },
  );
  expect(saveNotebookRecording(getNotebookStore(), captured.value).ok).toBe(true);
  function fileSource(title: string) {
    const result = writeRecordedExperiment({ ...captured.value, title }, validateTapeV2);
    assert.ok(result.kind === "accepted");
    return result.value;
  }
  const receiver = laboratory("bm-05");
  const before = receiver.session.getSnapshot();
  const host = createContainer();
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(<ExperimentRecorder target={receiver.target} tape={null} />);
    });
    await click(host, "Show notebook recordings");
    await until(() => host.textContent?.includes("Notebook choice") === true);
    const input = host.querySelector<HTMLInputElement>('input[type="file"]');
    assert.ok(input);
    const selectFile = changeHandler(input);
    let finishRead: (text: string) => void = () => { throw new Error("File read did not begin"); };
    const slow = fileSource("Older slow file");
    await act(async () => {
      selectFile({ currentTarget: {
        value: "", files: [{ size: slow.length, text: () => new Promise<string>((resolve) => { finishRead = resolve; }) }],
      } });
    });
    await click(host, "Open saved recording");
    await until(() =>
      [...host.querySelectorAll("button")].some(
        (item) => item.textContent === "Open notebook recording",
      ),
    );
    await act(async () => {
      finishRead(slow);
      await Promise.resolve();
    });
    expect(button(host, "Open notebook recording").parentElement?.textContent).toContain("Notebook choice");
    expect(host.textContent).not.toContain("Older slow file");

    const newer = fileSource("Newer file choice");
    await act(async () => {
      button(host, "Open saved recording").click();
      selectFile({ currentTarget: {
        value: "", files: [{ size: newer.length, text: () => Promise.resolve(newer) }],
      } });
    });
    await until(() =>
      [...host.querySelectorAll("button")].some(
        (item) => item.textContent === "Open imported recording",
      ),
    );
    expect(button(host, "Open imported recording").parentElement?.textContent).toContain("Newer file choice");
    expect(receiver.session.getSnapshot()).toBe(before);
    expect(receiver.channels).toHaveLength(0);
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(host);
  }
});
