import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { bm08Laboratory, bm08ReplayFixture } from "../../testing/bm08ReplayHarness.ts";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createBm08WalkthroughTarget } from "../bm08/tape.ts";
import { draftTapeForSettings } from "./draftTape.ts";
import { LabTapeLink, type LabTapeLinkState, useWorkerTapeLink } from "./LabTapeLink.tsx";
import {
  captureRecordedStop,
  readRecordedExperiment,
  writeRecordedExperiment,
} from "./recordedExperiments.ts";
import { validateTapeV2 } from "./schema.ts";
import type { TapeV2 } from "./types.ts";
import {
  applyWorkerSettings,
  type WorkerTapeBinding,
  type WorkerTapeCapture,
  type WorkerTapeSession,
} from "./workerSessionTape.ts";

// These mounted controls use the real camera host and recording owner; only delivery is delayed.
const fixture = await bm08ReplayFixture();
let root: Root | null = null;
const sessions: WorkerTapeSession[] = [];
beforeEach(async () => {
  await installDom();
  window.history.replaceState({}, "", "/lab/bm-08/");
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  for (const session of sessions.splice(0)) session.disconnect();
  await uninstallDom();
});
async function until(check: () => boolean) {
  const end = Date.now() + 10000;
  while (!check()) {
    assert.ok(Date.now() < end, "The camera checkpoint action must finish.");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
  }
}
function recorder() {
  const element = document.querySelector<HTMLElement>('[data-experiment-recorder="bm-08"]');
  assert.ok(element);
  return element;
}
function button(label: string) {
  const found = [...recorder().querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent === label,
  );
  assert.ok(found, label);
  return found;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
function handler<T>(element: Element, name: string): (event: T) => void {
  // Happy DOM has no trusted change events; exercise the mounted React handler, as repo helpers do.
  const key = Object.keys(element).find((item) => item.startsWith("__reactProps$"));
  assert.ok(key);
  const props = (element as unknown as Record<string, Record<string, (event: T) => void>>)[key];
  const callback = props?.[name];
  assert.ok(callback);
  return callback;
}
async function mount(
  options: Parameters<typeof bm08Laboratory>[1] = {},
  wrap: (binding: WorkerTapeBinding) => WorkerTapeBinding = (binding) => binding,
) {
  const lab = bm08Laboratory(fixture, options);
  sessions.push(lab.session);
  const binding = wrap(lab.binding);
  const restored: object[] = [];
  const target = createBm08WalkthroughTarget(binding, lab.session, (parameters) =>
    restored.push(parameters),
  );
  const current: { link?: LabTapeLinkState } = {};
  function Probe() {
    const view = useSyncExternalStore(
      lab.session.subscribe,
      lab.session.getSnapshot,
      lab.session.getSnapshot,
    );
    current.link = useWorkerTapeLink(
      binding,
      lab.session,
      view.accepted?.parameters,
      true,
      () => {},
      target,
    );
    return <LabTapeLink link={current.link} workerWalkthrough={target} />;
  }
  root = createRoot(createContainer());
  await act(async () => root?.render(<Probe />));
  return { ...lab, binding, current, restored };
}
async function apply(lab: Awaited<ReturnType<typeof mount>>, patch: object = {}) {
  await act(async () => {
    const result = await applyWorkerSettings(lab.session, {
      ...lab.session.acceptedParameters(),
      ...patch,
    });
    assert.equal(result.kind, "restored");
  });
}
async function downloadedRecording() {
  const original = URL.createObjectURL;
  let saved: Blob | undefined;
  URL.createObjectURL = (blob) => {
    assert.ok(blob instanceof Blob);
    saved = blob;
    return "blob:recording-test";
  };
  try {
    await click("Download recording JSON");
    assert.ok(saved);
    const parsed = readRecordedExperiment(await saved.text(), "bm-08", validateTapeV2);
    assert.equal(parsed.kind, "accepted");
    return parsed.value;
  } finally {
    URL.createObjectURL = original;
  }
}

test("a reader saves two complete camera trials, exports exact scientific stops, and restores one through its owner", async () => {
  const lab = await mount();
  expect(lab.channels).toHaveLength(0);
  expect(button("Save starting point").disabled).toBe(true);
  await apply(lab, { seed: "18446744073709551615", noiseSeed: "9007199254740993", sigma: 0 });
  await until(() => Boolean(lab.current.link?.recordingTape));
  const first = lab.current.link?.recordingTape;
  assert.ok(first?.acceptedCheckpoint.scientificState);
  expect(first.seed).toBe("18446744073709551615");
  expect(first.initialConditions.noiseSeed).toBe("9007199254740993");
  expect(first.events).toEqual([]);
  expect(first.acceptedCheckpoint.acceptedActionIndex).toBe(0);
  expect(lab.current.link?.shareTape).toEqual(first);
  const beforeCapture = lab.session.getSnapshot();
  await click("Save starting point");
  expect(lab.session.getSnapshot()).toBe(beforeCapture);
  await apply(lab, { sigma: 0.35e-6 });
  await until(() => lab.current.link?.recordingTape?.initialConditions.sigma === 0.35e-6);
  await click("Save current scientific checkpoint");
  const recording = await downloadedRecording();
  expect(recording.stops).toHaveLength(2);
  expect(recording.stops[0]?.tape).toEqual(first);
  expect(recording.stops[1]?.tape.initialConditions.sigma).toBe(0.35e-6);
  expect(
    recording.stops.every((stop) => Boolean(stop.tape.acceptedCheckpoint.scientificState)),
  ).toBe(true);
  const select = recorder().querySelector<HTMLSelectElement>("select");
  assert.ok(select);
  const beforeSelection = lab.session.getSnapshot();
  await act(async () => {
    select.value = "0";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(lab.session.getSnapshot()).toBe(beforeSelection);
  await click("Restore saved stop");
  await until(() => recorder().querySelector('[data-recording-outcome="replayed"]') !== null);
  expect(lab.session.acceptedParameters()).toMatchObject({ sigma: 0, seed: first.seed });
  expect(recorder().textContent).toContain("verified the recorded scientific checkpoint");
  expect(lab.restored).toHaveLength(1);
  expect((await downloadedRecording()).stops[0]?.tape).toEqual(first);
});

test("an obsolete asynchronous capture can neither enable saving nor replace the newer share", async () => {
  const completions: { result: WorkerTapeCapture; release(): void }[] = [];
  const lab = await mount({}, (binding) => ({
    ...binding,
    async capture(session, accepted) {
      assert.ok(binding.capture);
      const result = await binding.capture(session, accepted);
      if (result.kind !== "captured") return result;
      return new Promise<WorkerTapeCapture>((resolve) =>
        completions.push({ result, release: () => resolve(result) }),
      );
    },
  }));
  await apply(lab, { sigma: 0.1e-6 });
  await until(() => completions.length === 1);
  await apply(lab, { sigma: 0.5e-6 });
  await until(() => completions.length === 2);
  await act(async () => completions[0]?.release());
  expect(lab.current.link?.recordingTape).toBeNull();
  expect(button("Save starting point").disabled).toBe(true);
  expect(lab.current.link?.shareTape?.initialConditions.sigma).toBe(0.5e-6);
  await act(async () => completions[1]?.release());
  await until(() => lab.current.link?.recordingTape?.initialConditions.sigma === 0.5e-6);
  expect(lab.current.link?.shareTape?.acceptedCheckpoint.scientificState).toBeDefined();
  expect(button("Save starting point").disabled).toBe(false);
});

test("cancelling a saved scientific stop preserves both the accepted trial and the recording", async () => {
  const lab = await mount({ hold: (index) => index === 1 });
  await apply(lab, { sigma: 0.1e-6 });
  await until(() => Boolean(lab.current.link?.recordingTape));
  await click("Save starting point");
  await apply(lab, { sigma: 0.5e-6 });
  const before = lab.session.getSnapshot().accepted;
  await click("Restore saved stop");
  const checking = await lab.channel(1);
  await act(async () => checking.result);
  expect(button("Restore saved stop").disabled).toBe(true);
  await click("Cancel saved-stop calculation");
  await until(() => checking.disposed);
  await act(async () => checking.release());
  expect(lab.session.getSnapshot().accepted).toBe(before);
  expect(lab.restored).toEqual([]);
  expect(recorder().textContent).toContain("1 of 64 saved stops");
  expect(recorder().textContent).toContain("Calculation stopped");
  expect(button("Restore saved stop").disabled).toBe(false);
});

test("a legacy settings-only recording opens inertly, offers a new run, and preserves its original stop", async () => {
  const lab = await mount();
  const draft = draftTapeForSettings(lab.binding, { ...fixture.example.parameters, sigma: 0.3e-6 });
  assert.ok(draft);
  const original: TapeV2 = {
    ...draft,
    modelIdentity: { ...draft.modelIdentity, artifactDigest: `host:sha256:${"0".repeat(64)}` },
  };
  const captured = captureRecordedStop(
    null,
    original,
    "Earlier settings",
    "Original stop",
    "Keep my explanation",
    validateTapeV2,
  );
  assert.equal(captured.kind, "accepted");
  const serialized = writeRecordedExperiment(captured.value, validateTapeV2);
  assert.equal(serialized.kind, "accepted");
  const input = recorder().querySelector<HTMLInputElement>('input[type="file"]');
  assert.ok(input);
  await act(async () =>
    handler<{ currentTarget: { files: File[]; value: string } }>(
      input,
      "onChange",
    )({
      currentTarget: {
        files: [new File([serialized.value], "earlier.json", { type: "application/json" })],
        value: "",
      },
    }),
  );
  await until(() => recorder().textContent?.includes("Open imported recording") === true);
  await click("Open imported recording");
  expect(lab.channels).toHaveLength(0);
  expect(recorder().textContent).toContain("without a scientific checkpoint");
  expect(recorder().textContent).not.toContain("verifies its scientific checkpoint");
  await click("Calculate saved settings as a new run");
  await until(() => recorder().querySelector('[data-recording-outcome="new-run"]') !== null);
  await until(() => Boolean(lab.current.link?.recordingTape));
  expect(lab.session.acceptedParameters()).toMatchObject({ sigma: 0.3e-6 });
  await click("Save current scientific checkpoint");
  const exported = await downloadedRecording();
  expect(exported.stops[0]?.tape).toEqual(original);
  expect(exported.stops[0]?.note).toBe("Keep my explanation");
  expect(exported.stops[1]?.tape.acceptedCheckpoint.scientificState).toBeDefined();
  expect(exported.stops[1]?.tape.modelIdentity.artifactDigest).not.toBe(
    original.modelIdentity.artifactDigest,
  );
});
