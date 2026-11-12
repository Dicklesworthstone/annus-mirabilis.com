import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CameraLab } from "../../components/lab/CameraLab.tsx";
import {
  bm08Laboratory,
  bm08ReplayFixture,
  recordBm08Checkpoints,
} from "../../testing/bm08ReplayHarness.ts";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createBm08Host } from "../../workers/host/bm08Host.ts";
import { createBm08WalkthroughTarget } from "../bm08/tape.ts";
import { encodeTapePermalink } from "./codec.ts";
import { draftTapeForSettings } from "./draftTape.ts";
import { LabTapeLink, type LabTapeLinkState, useWorkerTapeLink } from "./LabTapeLink.tsx";
import type { TapeV2 } from "./types.ts";
import type { WorkerTapeSession } from "./workerSessionTape.ts";

// Every publication below comes from the real camera host; only delivery timing is controlled.
// workerLink.node.test.ts separately crosses the actual worker_threads boundary under V8.
const fixture = await bm08ReplayFixture();
const stops = await recordBm08Checkpoints(fixture);
const recorded = stops.at(-1)?.tape;
assert.ok(recorded);
let root: Root | null = null;
const sessions: WorkerTapeSession[] = [];

beforeEach(async () => installDom({ intersections: "visible" }));
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  for (const session of sessions.splice(0)) session.disconnect();
  await uninstallDom();
});

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "The explicit camera-link action must finish.");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
  }
}

function button(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>("[data-worker-tape-link] button")].find(
    (element) => element.textContent === label,
  );
}

async function click(label: string) {
  const found = button(label);
  assert.ok(found, label);
  await act(async () => found.click());
}

async function mount(tape: TapeV2, options: Parameters<typeof bm08Laboratory>[1] = {}) {
  const lab = bm08Laboratory(fixture, options);
  sessions.push(lab.session);
  const before = lab.session.getSnapshot();
  const loaded: object[] = [];
  const restored: object[] = [];
  const current: { link?: LabTapeLinkState } = {};
  const target = createBm08WalkthroughTarget(lab.binding, lab.session, (settings) =>
    restored.push(settings),
  );
  function Probe() {
    const view = useSyncExternalStore(
      lab.session.subscribe,
      lab.session.getSnapshot,
      lab.session.getSnapshot,
    );
    current.link = useWorkerTapeLink(
      lab.binding,
      lab.session,
      view.accepted?.parameters,
      true,
      (settings) => loaded.push(settings),
      target,
    );
    return <LabTapeLink link={{ ...current.link, walkthrough: undefined }} />;
  }
  window.history.replaceState({}, "", `/lab/bm-08/?tape=${encodeTapePermalink(tape)}`);
  root = createRoot(createContainer());
  await act(async () => root?.render(<Probe />));
  await until(() =>
    Boolean(current.link?.checkpoint || current.link?.notice || current.link?.note),
  );
  return { ...lab, before, current, loaded, restored };
}

test("the reader explicitly restores a shared checkpoint, then a later calculation retires its share identity", async () => {
  const original = JSON.stringify(recorded);
  const lab = await mount(recorded);
  expect(lab.channels).toHaveLength(0);
  expect(lab.session.getSnapshot()).toBe(lab.before);
  expect(lab.loaded).toEqual([]);
  expect(lab.restored).toEqual([]);
  expect(button("Restore recorded calculation")).toBeDefined();
  expect(lab.current.link?.shareTape?.acceptedCheckpoint.digest).not.toBe(
    recorded.acceptedCheckpoint.digest,
  );

  await click("Restore recorded calculation");
  await until(() => lab.current.link?.checkpoint?.phase === "restored");
  expect(lab.restored).toEqual([lab.session.acceptedParameters()]);
  expect(lab.channels).toHaveLength(2);
  expect(lab.current.link?.shareTape).toEqual(recorded);
  await until(() => Boolean(lab.current.link?.recordingTape?.acceptedCheckpoint.scientificState));
  expect(lab.current.link?.recordingTape?.events).toEqual([]);
  expect(lab.current.link?.recordingTape?.acceptedCheckpoint.acceptedActionIndex).toBe(0);
  expect(document.querySelector("[data-tape-loaded]")?.textContent).toContain(
    "original checkpoint is ready to share",
  );

  await act(async () => {
    lab.session.apply({ ...lab.session.acceptedParameters(), sigma: 0.4e-6 });
  });
  await until(() => lab.session.getSnapshot().status === "accepted");
  await until(() => lab.current.link?.recordingTape?.initialConditions.sigma === 0.4e-6);
  expect(lab.current.link?.checkpoint?.phase).toBe("ready");
  expect(lab.current.link?.shareTape?.initialConditions.sigma).toBe(0.4e-6);
  expect(lab.current.link?.shareTape?.events).toEqual([]);
  expect(lab.current.link?.shareTape?.acceptedCheckpoint.scientificState).toBeDefined();
  expect(document.querySelector("[data-tape-loaded]")).toBeNull();
  // Returning to the old controls does not revive a checkpoint that no longer owns this run.
  await act(async () => {
    lab.session.apply({ ...lab.session.acceptedParameters(), sigma: 0.2e-6 });
  });
  await until(() => lab.session.getSnapshot().status === "accepted");
  await until(() => lab.current.link?.recordingTape?.initialConditions.sigma === 0.2e-6);
  expect(lab.current.link?.shareTape?.acceptedCheckpoint.digest).not.toBe(
    recorded.acceptedCheckpoint.digest,
  );
  expect(JSON.stringify(recorded)).toBe(original);
  expect(new URL(window.location.href).searchParams.get("tape")).toBe(
    encodeTapePermalink(recorded),
  );
});

test("ordinary settings-only links still fill the form without starting or offering worker replay", async () => {
  const base = bm08Laboratory(fixture);
  const settings = { ...fixture.example.parameters, sigma: 0.4e-6 };
  const tape = draftTapeForSettings(base.binding, settings);
  base.session.disconnect();
  assert.ok(tape);
  const lab = await mount(tape);
  expect(lab.channels).toHaveLength(0);
  expect(lab.session.getSnapshot()).toBe(lab.before);
  expect(lab.loaded).toEqual([settings]);
  expect(lab.current.link?.checkpoint).toBeUndefined();
  expect(document.querySelector("[data-worker-tape-link]")).toBeNull();
  expect(document.querySelector("[data-tape-loaded]")?.textContent).toContain(
    "Apply them to calculate",
  );
});

test("a source mismatch offers a clearly separate current-model run without claiming the old result was verified", async () => {
  const historical: TapeV2 = {
    ...recorded,
    modelIdentity: { ...recorded.modelIdentity, artifactDigest: `host:sha256:${"0".repeat(64)}` },
  };
  const original = JSON.stringify(historical);
  const lab = await mount(historical);
  expect(lab.channels).toHaveLength(0);
  expect(button("Restore recorded calculation")).toBeUndefined();
  expect(button("Calculate as a new run")).toBeDefined();
  expect(document.querySelector("[data-tape-notice]")?.textContent).toContain("Recorded artifact:");
  await click("Calculate as a new run");
  await until(() => lab.current.link?.checkpoint?.phase === "calculated");
  await until(() => Boolean(lab.current.link?.recordingTape?.acceptedCheckpoint.scientificState));
  expect(lab.session.getSnapshot().accepted?.runId).not.toBe(lab.before.accepted?.runId);
  expect(lab.session.getSnapshot().accepted?.parentRunId).toBe(lab.before.accepted?.runId);
  expect(lab.channels).toHaveLength(1);
  expect(lab.restored).toEqual([lab.session.acceptedParameters()]);
  expect(lab.current.link?.shareTape?.modelIdentity.artifactDigest).toBe(
    lab.binding.environment.artifactDigest,
  );
  expect(lab.current.link?.shareTape?.acceptedCheckpoint.scientificState).toBeDefined();
  expect(lab.current.link?.shareTape?.acceptedCheckpoint.acceptedActionIndex).toBe(0);
  expect(lab.current.link?.shareTape?.acceptedCheckpoint.digest).not.toBe(
    historical.acceptedCheckpoint.digest,
  );
  expect(document.querySelector("[data-tape-loaded]")?.textContent).toContain(
    "recorded result has not been verified",
  );
  expect(JSON.stringify(historical)).toBe(original);
});

test("cancellation disposes the isolated checkpoint worker and keeps the previous accepted result", async () => {
  const lab = await mount(recorded, { hold: (index) => index === 0 });
  await click("Restore recorded calculation");
  const checking = await lab.channel(0);
  await act(async () => checking.result);
  expect(lab.current.link?.checkpoint?.phase).toBe("restoring");
  expect(lab.session.getSnapshot()).toBe(lab.before);
  await click("Cancel calculation");
  await until(() => lab.current.link?.checkpoint?.phase === "ready");
  expect(checking.disposed).toBe(true);
  expect(lab.session.getSnapshot()).toBe(lab.before);
  expect(lab.restored).toEqual([]);
  await act(async () => checking.release());
  expect(lab.session.getSnapshot()).toBe(lab.before);
  expect(button("Restore recorded calculation")).toBeDefined();
  expect(document.querySelector("[data-tape-loaded]")?.textContent).toContain(
    "Calculation stopped",
  );
});

test("a cancelled incompatible-record calculation can still be explicitly tried as a new run", async () => {
  const lab = await mount(
    {
      ...recorded,
      modelIdentity: { ...recorded.modelIdentity, artifactDigest: `host:sha256:${"0".repeat(64)}` },
    },
    { hold: (index) => index === 0 },
  );
  await click("Calculate as a new run");
  const calculating = await lab.channel(0);
  await act(async () => calculating.result);
  await click("Cancel calculation");
  await until(() => lab.current.link?.checkpoint?.phase === "not-restored");
  expect(lab.session.getSnapshot().accepted).toBe(lab.before.accepted);
  expect(button("Restore recorded calculation")).toBeUndefined();
  expect(button("Calculate as a new run")).toBeDefined();
  expect(lab.restored).toEqual([]);
});

test("newer manual work wins while a shared checkpoint is being checked", async () => {
  const lab = await mount(recorded, { hold: (index) => index === 0 });
  await click("Restore recorded calculation");
  const checking = await lab.channel(0);
  await act(async () => checking.result);
  await act(async () => {
    lab.session.apply({ ...fixture.example.parameters, sigma: 0.4e-6 });
  });
  await until(() => lab.session.getSnapshot().status === "accepted");
  const newer = lab.session.getSnapshot().accepted;
  expect(newer?.parameters.sigma).toBe(0.4e-6);
  await act(async () => checking.release());
  await until(() => lab.current.link?.checkpoint?.phase === "not-restored");
  expect(lab.session.getSnapshot().accepted).toBe(newer);
  expect(lab.restored).toEqual([]);
  expect(document.querySelector("[data-tape-notice]")?.textContent).toContain(
    "Your newer work has been kept",
  );
  await until(() => lab.current.link?.recordingTape?.initialConditions.sigma === 0.4e-6);
  expect(lab.current.link?.shareTape?.acceptedCheckpoint.scientificState).toBeDefined();
  expect(lab.current.link?.shareTape?.acceptedCheckpoint.digest).not.toBe(
    recorded.acceptedCheckpoint.digest,
  );
});

test("leaving the laboratory cancels an in-flight link restore without a late form update", async () => {
  const lab = await mount(recorded, { hold: (index) => index === 0 });
  await click("Restore recorded calculation");
  const checking = await lab.channel(0);
  await act(async () => checking.result);
  await act(async () => root?.unmount());
  root = null;
  await until(() => checking.disposed);
  await act(async () => checking.release());
  expect(lab.session.getSnapshot()).toBe(lab.before);
  expect(lab.restored).toEqual([]);
});

test("CameraLab preserves newer unapplied settings when a second control attempts an overlapping restore", async () => {
  const previousWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  let creations = 0;
  let disposals = 0;
  let held = true;
  let release: (() => void) | undefined;
  const failures: unknown[] = [];
  class CameraWorker extends EventTarget {
    private closed = false;
    private readonly host = createBm08Host((message) => {
      const deliver = () => {
        if (!this.closed)
          this.dispatchEvent(new MessageEvent("message", { data: structuredClone(message) }));
      };
      if (held && message.messageKind === "result") release = deliver;
      else deliver();
    }, fixture.sourceDigest);
    constructor() {
      super();
      creations++;
      queueMicrotask(() => {
        if (!this.closed) this.host.hello();
      });
    }
    postMessage(message: unknown) {
      void this.host.receive(structuredClone(message)).catch((error) => {
        failures.push(error);
        this.dispatchEvent(new Event("error"));
      });
    }
    terminate() {
      if (this.closed) return;
      this.closed = true;
      disposals++;
      this.host.dispose();
    }
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: CameraWorker });
  window.history.replaceState({}, "", `/lab/bm-08/?tape=${encodeTapePermalink(recorded)}`);
  root = createRoot(createContainer());
  try {
    await act(async () => root?.render(<CameraLab example={fixture.example} readings={false} />));
    await until(() => button("Restore recorded calculation") !== undefined);
    expect(creations).toBe(0);
    await click("Restore recorded calculation");
    await until(() => release !== undefined);
    const sigma = document.querySelector<HTMLInputElement>('input[name="sigma"]');
    assert.ok(sigma);
    // Happy DOM has no trusted input; call the real mounted control's React onChange boundary.
    const key = Object.keys(sigma).find((name) => name.startsWith("__reactProps$"));
    assert.ok(key);
    const props = (
      sigma as unknown as Record<string, { onChange(event: { target: HTMLInputElement }): void }>
    )[key];
    assert.ok(props);
    await act(async () => {
      sigma.value = "0.7";
      props.onChange({ target: sigma });
    });
    const player = document.querySelector<HTMLDetailsElement>('[data-walkthrough-player="bm-08"]');
    assert.ok(player);
    await act(async () => {
      player.open = true;
      player.dispatchEvent(new Event("toggle"));
    });
    const playerRestore = () =>
      [...player.querySelectorAll<HTMLButtonElement>("button")].find(
        (element) => element.textContent === "Restore checkpoint",
      );
    await until(() => playerRestore() !== undefined);
    await act(async () => playerRestore()?.click());
    await until(() => player.querySelector('[data-walkthrough-outcome="refused"]') !== null);
    expect(player.textContent).toContain("Another checkpoint");
    expect(creations).toBe(1);
    expect(sigma.value).toBe("0.7");
    const playerCalculate = [...player.querySelectorAll<HTMLButtonElement>("button")].find(
      (element) => element.textContent === "Calculate these settings as a new run",
    );
    assert.ok(playerCalculate);
    await act(async () => playerCalculate.click());
    await until(() => player.querySelector('[data-walkthrough-outcome="refused"]') !== null);
    expect(player.textContent).toContain("Another checkpoint");
    expect(creations).toBe(1);
    await act(async () => {
      held = false;
      release?.();
    });
    await until(
      () =>
        document.querySelector<HTMLElement>("[data-worker-tape-link]")?.dataset.replayState ===
        "restored",
    );
    expect(sigma.value).toBe("0.7");
    expect(document.body.textContent).toContain("Your newer entries are still in the form");
    expect(document.body.textContent).toContain("original checkpoint is ready to share");
    expect(creations).toBe(2);
    expect(failures).toEqual([]);
  } finally {
    await act(async () => root?.unmount());
    root = null;
    if (previousWorker) Object.defineProperty(globalThis, "Worker", previousWorker);
    else Reflect.deleteProperty(globalThis, "Worker");
  }
  expect(disposals).toBe(creations);
});
