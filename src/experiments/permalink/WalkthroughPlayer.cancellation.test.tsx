import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { evaluatorSources } from "../../../scripts/generate-sr03.mjs";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import { evaluateSr03 } from "../../workers/operations/sr03.ts";
import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import { encodeResult } from "../results/codec.ts";
import { SR03_DEFAULTS } from "../sr03/definition.ts";
import type { PreparedSr03Example } from "../sr03/session.ts";
import { createSr03TapeBinding, createSr03WalkthroughTarget } from "../sr03/tape.ts";
import { draftTapeForSettings } from "./draftTape.ts";
import { WalkthroughPlayer } from "./WalkthroughPlayer.tsx";
import type { WorkerWalkthroughTarget } from "./walkthroughActions.ts";
import type { WalkthroughCatalogue } from "./walkthroughCheckpoints.ts";
import type { WorkerTapeSession } from "./workerSessionTape.ts";

// Calculate through the real numerical owner and its current source closure. Only message
// delivery is held below; neither the player, replay owner, scheduler nor physics is substituted.
const sourceHash = createHash("sha256");
for (const [path, source] of await evaluatorSources()) {
  sourceHash.update(`${path}\0${Buffer.byteLength(source)}\0`).update(source);
}
const sourceDigest = `source:sha256:${sourceHash.digest("hex")}`;
const evaluated = await evaluateSr03(SR03_DEFAULTS);
assert.equal(evaluated.kind, "accepted");
assert.ok(evaluated.kind === "accepted");
const example: PreparedSr03Example = {
  sourceDigest,
  parameters: SR03_DEFAULTS,
  stepIndex: evaluated.data.stepIndex,
  simulationTime: evaluated.data.simulationTime,
  results: evaluated.data.outputs.map(encodeResult),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type ChannelControl = { disposed: boolean; result: Promise<void>; release(): void };
let root: Root | null = null;
const sessions: WorkerTapeSession[] = [];
beforeEach(async () => installDom());
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  for (const session of sessions.splice(0)) session.disconnect();
  await uninstallDom();
});

function laboratory() {
  const channels: ChannelControl[] = [];
  const waiters = new Map<number, ReturnType<typeof deferred<ChannelControl>>>();
  const failures: unknown[] = [];
  const factory = (): WorkerChannel => {
    const index = channels.length;
    const result = deferred<void>();
    let listener: ((message: unknown) => void) | null = null;
    let held = true;
    const deliveries: (() => void)[] = [];
    const host = createSr03Host((message) => {
      const deliver = () => listener?.(structuredClone(message));
      if (message.messageKind === "result") {
        result.resolve();
        if (held) {
          deliveries.push(deliver);
          return;
        }
      }
      deliver();
    }, sourceDigest);
    const control: ChannelControl = {
      disposed: false,
      result: result.promise,
      release() {
        held = false;
        for (const deliver of deliveries.splice(0)) deliver();
      },
    };
    channels.push(control);
    waiters.get(index)?.resolve(control);
    return {
      send(message) {
        void host.receive(structuredClone(message)).catch((error) => failures.push(error));
      },
      listen(next) {
        listener = next;
        queueMicrotask(() => host.hello());
        return () => {
          listener = null;
        };
      },
      dispose() {
        control.disposed = true;
        host.dispose();
      },
    };
  };
  const binding = createSr03TapeBinding(example, factory);
  const session = binding.createSession("cancellable-walkthrough");
  sessions.push(session);
  const accepted: object[] = [];
  const target = createSr03WalkthroughTarget(binding, session, (parameters) =>
    accepted.push(parameters),
  );
  const catalogue: WalkthroughCatalogue = {
    walkthroughs: [
      {
        tapeId: "cancellable-stops",
        experimentId: "sr-03",
        title: "A rod in two frames",
        checkpoints: [0.2, 0.4].map((v, index) => {
          const settings = { ...SR03_DEFAULTS, v };
          const tape = draftTapeForSettings(binding, settings);
          assert.ok(tape, "The real laboratory must record its accepted settings.");
          return { actionIndex: index, label: `Frame speed ${v}`, settings, tape };
        }),
      },
    ],
    problems: [],
  };
  return {
    session,
    target,
    catalogue,
    channels,
    accepted,
    failures,
    channel(index: number) {
      const existing = channels[index];
      if (existing) return Promise.resolve(existing);
      const pending = deferred<ChannelControl>();
      waiters.set(index, pending);
      return pending.promise;
    },
  };
}

async function mount(lab: ReturnType<typeof laboratory>, target = lab.target) {
  window.history.replaceState({}, "", "/lab/sr-03/?walkthrough=cancellable-stops&stop=0");
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root?.render(createElement(WalkthroughPlayer, { target, load: async () => lab.catalogue })),
  );
}

function button(text: string) {
  const found = [...document.querySelectorAll("button")].find(
    (entry) => entry.textContent?.trim() === text,
  );
  assert.ok(found, `The player must offer ${text}.`);
  return found;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
function outcome() {
  return document
    .querySelector("[data-walkthrough-outcome]")
    ?.getAttribute("data-walkthrough-outcome");
}
function busy() {
  return document.querySelector("fieldset")?.disabled;
}
async function release(lab: ReturnType<typeof laboratory>, index: number) {
  const channel = await lab.channel(index);
  await channel.result;
  await act(async () => channel.release());
  return channel;
}

test("Cancel reaches a paused checkpoint's real worker, preserves the live result, and allows another stop", async () => {
  const lab = laboratory();
  const before = lab.session.getSnapshot();
  await mount(lab);
  expect(lab.channels).toHaveLength(0);
  await click("Restore checkpoint");
  const trial = await lab.channel(0);
  await trial.result;
  lab.session.setSchedulingPaused(true);
  expect(busy()).toBe(true);
  const cancel = button("Cancel calculation");
  expect(cancel.closest("fieldset")).toBeNull();
  expect(cancel.disabled).toBe(false);
  await click("Cancel calculation");
  expect(trial.disposed).toBe(true);
  expect(lab.session.getSnapshot()).toBe(before);
  expect(lab.accepted).toEqual([]);
  expect(busy()).toBe(false);
  expect(outcome()).toBe("cancelled");
  expect(document.activeElement).toBe(button("Restore checkpoint"));

  lab.session.setSchedulingPaused(false);
  await act(async () => trial.release());
  expect(lab.session.getSnapshot()).toBe(before);
  expect(lab.channels).toHaveLength(1);
  await click("Inspect next checkpoint");
  expect(outcome()).toBeUndefined();
  expect(lab.channels).toHaveLength(1);
  await click("Restore checkpoint");
  await release(lab, 1);
  await release(lab, 2);
  expect(outcome()).toBe("replayed");
  expect(lab.session.acceptedParameters()).toMatchObject({ v: 0.4 });
  expect(lab.accepted).toHaveLength(1);
  expect(lab.failures).toEqual([]);
});

test("cancelling a new calculation keeps the last accepted result and a retry can finish", async () => {
  const lab = laboratory();
  const before = lab.session.getSnapshot().accepted;
  await mount(lab);
  await click("Calculate these settings as a new run");
  const live = await lab.channel(0);
  await live.result;
  expect(lab.session.getSnapshot().pending).toBe(true);
  await click("Cancel calculation");
  expect(live.disposed).toBe(true);
  expect(lab.session.getSnapshot().accepted).toBe(before);
  expect(lab.session.getSnapshot().pending).toBe(false);
  expect(lab.accepted).toEqual([]);
  expect(outcome()).toBe("cancelled");
  expect(document.activeElement).toBe(button("Calculate these settings as a new run"));
  await act(async () => live.release());
  expect(lab.session.getSnapshot().accepted).toBe(before);
  expect(outcome()).toBe("cancelled");

  await click("Calculate these settings as a new run");
  await release(lab, 1);
  expect(outcome()).toBe("new-run");
  expect(lab.session.acceptedParameters()).toMatchObject({ v: 0.2 });
  expect(lab.session.getSnapshot().accepted?.runId).not.toBe(before?.runId);
  expect(lab.accepted).toHaveLength(1);
  expect(lab.failures).toEqual([]);
});

test("a cancelled adapter's delayed completion cannot unlock or replace a later replay", async () => {
  const lab = laboratory();
  const oldCompletion = deferred<void>();
  let calls = 0;
  let oldSignal: AbortSignal | undefined;
  // Delay the UI completion boundary after the real target has handled its abort. The next
  // action still uses the same production target, its real session, and real worker calculations.
  const target: WorkerWalkthroughTarget = {
    ...lab.target,
    async restore(tape, signal) {
      const first = ++calls === 1;
      if (first) oldSignal = signal;
      const restored = await lab.target.restore(tape, signal);
      if (first) await oldCompletion.promise;
      return restored;
    },
  };
  await mount(lab, target);
  await click("Restore checkpoint");
  await (await lab.channel(0)).result;
  await click("Cancel calculation");
  expect(oldSignal?.aborted).toBe(true);
  await click("Restore checkpoint");
  await (await lab.channel(1)).result;
  expect(busy()).toBe(true);
  expect(outcome()).toBeUndefined();
  await act(async () => oldCompletion.resolve());
  expect(busy()).toBe(true);
  expect(outcome()).toBeUndefined();
  await click("Restore checkpoint");
  expect(calls).toBe(2);
  await release(lab, 1);
  await release(lab, 2);
  expect(busy()).toBe(false);
  expect(outcome()).toBe("replayed");
  expect(lab.accepted).toHaveLength(1);
  expect(lab.failures).toEqual([]);
});
