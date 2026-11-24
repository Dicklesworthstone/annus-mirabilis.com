import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { BM07_DEFAULTS } from "../../experiments/bm07/definition.ts";
import { createBm07WalkthroughTarget } from "../../experiments/bm07/tape.ts";
import { BM08_DEFAULTS } from "../../experiments/bm08/definition.ts";
import { createBm08WalkthroughTarget } from "../../experiments/bm08/tape.ts";
import { ExperimentRecorder } from "../../experiments/permalink/ExperimentRecorder.tsx";
import { useWorkerTapeCapture } from "../../experiments/permalink/useWorkerTapeCapture.ts";
import {
  applyWorkerSettings,
  type WorkerTapeSession,
} from "../../experiments/permalink/workerSessionTape.ts";
import { bm07Laboratory, bm07ReplayFixture } from "../../testing/bm07ReplayHarness.ts";
import { bm08Laboratory, bm08ReplayFixture } from "../../testing/bm08ReplayHarness.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { getNotebookStore } from "./browserStore.ts";

const bm07Fixture = await bm07ReplayFixture();
const bm08Fixture = await bm08ReplayFixture();
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

function laboratory(experimentId: "bm-07" | "bm-08") {
  const lab = experimentId === "bm-07" ? bm07Laboratory(bm07Fixture) : bm08Laboratory(bm08Fixture);
  sessions.push(lab.session);
  const target = experimentId === "bm-07"
    ? createBm07WalkthroughTarget(lab.binding, lab.session, () => {})
    : createBm08WalkthroughTarget(lab.binding, lab.session, () => {});
  return { ...lab, target };
}

/** The same automatic owner-capture hook and recorder used by the standalone laboratories. */
function CapturedRecorder({ lab }: { lab: ReturnType<typeof laboratory> }) {
  const captured = useWorkerTapeCapture(lab.binding, lab.session, true);
  return <ExperimentRecorder target={lab.target} tape={captured.tape} captureNotice={captured.notice} />;
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
async function textField(host: HTMLElement, label: string, value: string) {
  const caption = [...host.querySelectorAll("label")].find((item) => item.textContent === label);
  assert.ok(caption?.htmlFor);
  const input = document.getElementById(caption.htmlFor);
  assert.ok(input);
  // The repository's happy-dom harness dispatches field changes through the actual React handler.
  const key = Object.keys(input).find((item) => item.startsWith("__reactProps$"));
  assert.ok(key);
  const props = (input as unknown as Record<string, { onChange?: (event: unknown) => void }>)[key];
  const onChange = props?.onChange;
  assert.ok(onChange);
  await act(async () => { onChange({ currentTarget: { value } }); });
}

for (const experimentId of ["bm-07", "bm-08"] as const) {
  test(experimentId + " completed trial can be saved, reopened after navigation, and explicitly restored", async () => {
    const source = laboratory(experimentId);
    const sourceHost = createContainer();
    const sourceRoot = createRoot(sourceHost);
    const parameters = experimentId === "bm-07"
      ? { ...BM07_DEFAULTS, seed: "18446744073709551615", radiusKnown: true }
      : {
          ...BM08_DEFAULTS,
          seed: "18446744073709551615",
          noiseSeed: "9007199254740993",
          clickSeed: "9007199254740995",
        };
    const title = "My " + experimentId + " investigation";
    const note = "My private prediction and what the completed trial showed.";
    try {
      await act(async () => { sourceRoot.render(<CapturedRecorder lab={source} />); });
      expect(button(sourceHost, "Save starting point").disabled).toBe(true);
      expect(source.channels).toHaveLength(0);
      await act(async () => {
        expect((await applyWorkerSettings(source.session, parameters)).kind).toBe("restored");
      });
      await until(() => !button(sourceHost, "Save starting point").disabled);
      await textField(sourceHost, "Recording title", title);
      await textField(sourceHost, "What did you predict or notice? (optional)", note);
      await click(sourceHost, "Save starting point");
      await click(sourceHost, "Save recording in notebook");
      await until(() => sourceHost.textContent?.includes("Kept a copy in your notebook.") === true);
    } finally {
      await act(async () => { sourceRoot.unmount(); });
      removeContainer(sourceHost);
    }
    const store = getNotebookStore();
    store.reloadConfirmed();
    const entry = store.getSnapshot().document.entries[0];
    assert.ok(entry?.kind === "recording");
    expect(entry.title).toBe(title);
    expect(entry.recording.stops[0]?.note).toBe(note);
    expect(entry.frame.anchor).toBe("arg-bm-inference");

    const receiver = laboratory(experimentId);
    const previous = receiver.session.getSnapshot();
    const host = createContainer();
    const root = createRoot(host);
    try {
      await act(async () => { root.render(<CapturedRecorder lab={receiver} />); });
      await click(host, "Show notebook recordings");
      await until(() => host.textContent?.includes(title) === true);
      await click(host, "Open saved recording");
      await until(() => [...host.querySelectorAll("button")].some(
        (item) => item.textContent === "Open notebook recording",
      ));
      expect(receiver.session.getSnapshot()).toBe(previous);
      expect(receiver.channels).toHaveLength(0);
      await click(host, "Open notebook recording");
      expect(host.textContent).toContain(note);
      expect(receiver.session.getSnapshot()).toBe(previous);
      expect(receiver.channels).toHaveLength(0);
      await click(host, "Restore saved stop");
      await until(() => host.querySelector('[data-recording-outcome="replayed"]') !== null);
      expect(receiver.session.acceptedParameters()).toEqual(parameters);
      expect(receiver.session.acceptedPublication?.()?.recordingCheckpoint).toEqual(
        source.session.acceptedPublication?.()?.recordingCheckpoint,
      );
    } finally {
      await act(async () => { root.unmount(); });
      removeContainer(host);
    }
  });
}
