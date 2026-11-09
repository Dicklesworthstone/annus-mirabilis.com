import { expect, spyOn, test } from "bun:test";
import assert from "node:assert/strict";
import lq01Example from "../../generated/lq01-example.json";
import sr03Example from "../../generated/sr03-example.json";
import { bm01ReplayFixture, recordBm01Checkpoints } from "../../testing/bm01ReplayHarness.ts";
import { createBm01Host } from "../../workers/host/bm01Host.ts";
import { createLq01Host } from "../../workers/host/lq01Host.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { createBm01TapeBinding } from "../bm01/tape.ts";
import type { PreparedLq01Example } from "../lq01/session.ts";
import { createLq01TapeBinding } from "../lq01/tape.ts";
import type { PreparedSr03Example } from "../sr03/session.ts";
import { createSr03TapeBinding } from "../sr03/tape.ts";
import type { RequestToken } from "../store/instanceStore.ts";
import { draftTapeForSettings } from "./draftTape.ts";
import { tapeStateDigestV2, tapeStateOf } from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeBinding,
  type WorkerTapeSession,
} from "./workerSessionTape.ts";

// Use the real numerical owners and production checkpoints. Only delivery and visibility vary.
const brownian = await bm01ReplayFixture();
const brownianStops = await recordBm01Checkpoints(
  brownian,
  brownian.example.parameters,
  [0.2, 0.4],
);
assert.ok(brownianStops[1]);
const brownianTape = brownianStops[1].tape;

type Host = ReturnType<typeof createSr03Host>;
type Case = {
  id: string;
  binding(factory: () => WorkerChannel): WorkerTapeBinding;
  host(send: (message: unknown) => void): Host;
  tape(binding: WorkerTapeBinding): TapeV2;
};

function deterministicTape(
  binding: WorkerTapeBinding,
  key: string,
  value: number | string,
): TapeV2 {
  const initial = draftTapeForSettings(binding, binding.defaults);
  assert.ok(initial);
  const checked = binding.validate({ ...binding.defaults, [key]: value });
  assert.equal(checked.kind, "accepted");
  const state = tapeStateOf(checked.data as object);
  assert.ok(state);
  return {
    ...initial,
    events: [{ actionIndex: 1, commandClass: "setup-change", paramId: key, value }],
    acceptedCheckpoint: {
      acceptedActionIndex: 1,
      acceptedInputRevision: 0,
      digest: tapeStateDigestV2(state, 1),
    },
  };
}

const cases: readonly Case[] = [
  {
    id: "bm-01 scientific",
    binding: (factory) => createBm01TapeBinding(brownian.example, factory),
    host: (send) => createBm01Host(send, brownian.sourceDigest, brownian.recorder),
    tape: () => brownianTape,
  },
  {
    id: "lq-01 deterministic",
    binding: (factory) => createLq01TapeBinding(lq01Example as PreparedLq01Example, factory),
    host: (send) => createLq01Host(send, lq01Example.sourceDigest),
    tape: (binding) => deterministicTape(binding, "delta", Math.PI),
  },
  {
    id: "sr-03 deterministic",
    binding: (factory) => createSr03TapeBinding(sr03Example as PreparedSr03Example, factory),
    host: (send) => createSr03Host(send, sr03Example.sourceDigest),
    tape: (binding) => deterministicTape(binding, "v", 0.8),
  },
];

function watchPause(session: WorkerTapeSession) {
  let subscriptions = 0;
  let disconnected = false;
  return {
    session: {
      ...session,
      subscribeSchedulingPause(listener: () => void) {
        subscriptions++;
        let attached = true;
        const off = session.subscribeSchedulingPause(listener);
        return () => {
          if (!attached) return;
          attached = false;
          subscriptions--;
          off();
        };
      },
      disconnect() {
        disconnected = true;
        session.disconnect();
      },
    },
    get subscriptions() {
      return subscriptions;
    },
    get disconnected() {
      return disconnected;
    },
  };
}

function laboratory(spec: Case, options: { hold?: boolean; wrongSource?: boolean } = {}) {
  const channels: { requests: RequestToken[]; results: number; disposed: boolean }[] = [];
  const deliveries: (() => void)[] = [];
  const failures: unknown[] = [];
  let onResult = (_channel: number) => {};
  const rawBinding = spec.binding(() => {
    const index = channels.length;
    const control = { requests: [] as RequestToken[], results: 0, disposed: false };
    channels.push(control);
    let listener: ((message: unknown) => void) | null = null;
    let failed = () => {};
    const host = spec.host((input) => {
      const message = input as { messageKind: string; sourceDigest: string };
      const deliver = () =>
        listener?.(
          structuredClone(
            options.wrongSource
              ? { ...message, sourceDigest: `source:sha256:${"0".repeat(64)}` }
              : message,
          ),
        );
      if (message.messageKind === "result") {
        control.results++;
        onResult(index);
        if (options.hold) {
          deliveries.push(deliver);
          return;
        }
      }
      deliver();
    });
    return {
      send(input) {
        const message = input as { messageKind: string; token: RequestToken };
        if (message.messageKind === "request") control.requests.push(message.token);
        void host.receive(structuredClone(input)).catch((error) => {
          failures.push(error);
          failed();
        });
      },
      listen(next, error) {
        listener = next;
        failed = error;
        queueMicrotask(() => host.hello());
        return () => {
          listener = null;
          failed = () => {};
        };
      },
      dispose() {
        control.disposed = true;
        host.dispose();
      },
    };
  });
  const owner = watchPause(rawBinding.createSession(`visible-${spec.id}`));
  const trials: ReturnType<typeof watchPause>[] = [];
  const binding = {
    ...rawBinding,
    createSession(id: string) {
      const trial = watchPause(rawBinding.createSession(id));
      trials.push(trial);
      return trial.session;
    },
  };
  return {
    owner,
    binding,
    trials,
    channels,
    failures,
    tape: spec.tape(binding),
    onResult(callback: (channel: number) => void) {
      onResult = callback;
    },
    release() {
      for (const deliver of deliveries.splice(0)) deliver();
    },
  };
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "The real checkpoint owner must settle");
    await delay(2);
  }
}
function detached(lab: ReturnType<typeof laboratory>) {
  expect(lab.owner.subscriptions).toBe(0);
  for (const trial of lab.trials) {
    expect(trial.subscriptions).toBe(0);
    expect(trial.disconnected).toBe(true);
  }
  expect(lab.failures).toEqual([]);
}

for (const spec of cases) {
  test(`${spec.id}: a hidden owner pauses a newly created checkpoint trial without spending its timeout`, async () => {
    const lab = laboratory(spec);
    const session = lab.owner.session;
    const before = session.getSnapshot();
    session.setSchedulingPaused(true);
    let completed = false;
    const restore = restoreWorkerTape(lab.binding, session, lab.tape, { timeoutMs: 200 }).then(
      (result) => {
        completed = true;
        return result;
      },
    );
    try {
      expect(lab.trials).toHaveLength(1);
      expect(lab.trials[0]?.session.getSchedulingPaused()).toBe(true);
      expect(lab.channels).toHaveLength(0);
      await delay(240);
      expect(completed).toBe(false);
      expect(session.getSnapshot()).toBe(before);
      session.setSchedulingPaused(false);
      expect(await restore).toEqual({ kind: "restored" });
      expect(session.getSnapshot().accepted?.final).toBe(true);
      expect(lab.channels).toHaveLength(2);
      expect(lab.channels[0]?.disposed).toBe(true);
      expect(lab.channels[1]?.disposed).toBe(false);
      detached(lab);
    } finally {
      session.disconnect();
    }
  });

  test(`${spec.id}: hiding between recorded states queues the next phase and resumes the same private run`, async () => {
    const lab = laboratory(spec);
    const session = lab.owner.session;
    const before = session.getSnapshot();
    lab.onResult((channel) => {
      if (channel === 0 && lab.channels[0]?.results === 1) session.setSchedulingPaused(true);
    });
    const restore = restoreWorkerTape(lab.binding, session, lab.tape);
    try {
      await until(() => lab.trials[0]?.session.getSnapshot().requested?.actionIndex === 3);
      const trial = lab.trials[0]?.session;
      assert.ok(trial);
      const requested = trial.getSnapshot().requested;
      expect(lab.channels[0]?.requests).toHaveLength(1);
      expect(trial.getSnapshot().pending).toBe(true);
      expect(trial.getSnapshot().accepted?.final).toBe(true);
      expect(session.getSnapshot()).toBe(before);
      session.setSchedulingPaused(false);
      expect(await restore).toEqual({ kind: "restored" });
      expect(lab.channels[0]?.requests[1]?.runId).toBe(requested?.runId);
      expect(lab.channels[0]?.requests[1]).toBe(requested);
      detached(lab);
    } finally {
      session.disconnect();
    }
  });

  test(`${spec.id}: a completed private trial waits for visibility before the live owner starts`, async () => {
    const lab = laboratory(spec);
    const session = lab.owner.session;
    const before = session.getSnapshot();
    lab.onResult((channel) => {
      if (channel === 0 && lab.channels[0]?.results === lab.tape.events.length + 1)
        session.setSchedulingPaused(true);
    });
    const restore = restoreWorkerTape(lab.binding, session, lab.tape);
    try {
      await until(() => session.getSnapshot().pending);
      const requested = session.getSnapshot().requested;
      expect(lab.channels).toHaveLength(1);
      expect(session.getSnapshot().accepted).toBe(before.accepted);
      expect(lab.trials[0]?.session.getSnapshot().pending).toBe(false);
      session.setSchedulingPaused(false);
      expect(await restore).toEqual({ kind: "restored" });
      expect(session.getSnapshot().accepted?.runId).toBe(requested?.runId);
      expect(session.getSnapshot().accepted?.actionIndex).toBe(requested?.actionIndex);
      expect(lab.channels[1]?.requests).toEqual([requested]);
      detached(lab);
    } finally {
      session.disconnect();
    }
  });

  for (const betweenPhases of [false, true]) {
    test(`${spec.id}: cancelling while hidden ${betweenPhases ? "between phases" : "before start"} leaves no trial or subscription to resume`, async () => {
      const lab = laboratory(spec);
      const session = lab.owner.session;
      const before = session.getSnapshot();
      const abort = new AbortController();
      if (betweenPhases) lab.onResult(() => session.setSchedulingPaused(true));
      else session.setSchedulingPaused(true);
      const restore = restoreWorkerTape(lab.binding, session, lab.tape, { signal: abort.signal });
      try {
        if (betweenPhases)
          await until(() => lab.trials[0]?.session.getSnapshot().requested?.actionIndex === 3);
        abort.abort();
        const result = await restore;
        assert.equal(result.kind, "not-restored");
        if (result.kind === "not-restored") assert.match(result.notice, /cancelled/);
        const count = lab.channels.reduce((total, channel) => total + channel.requests.length, 0);
        expect(session.getSnapshot()).toBe(before);
        detached(lab);
        session.setSchedulingPaused(false);
        await delay(0);
        expect(lab.channels.reduce((total, channel) => total + channel.requests.length, 0)).toBe(
          count,
        );
        expect(lab.channels.every((channel) => channel.disposed)).toBe(true);
      } finally {
        session.disconnect();
      }
    });
  }
}

test("cancelling the hidden live handoff preserves its accepted scientific evidence", async () => {
  const spec = cases[0];
  assert.ok(spec);
  const lab = laboratory(spec);
  const session = lab.owner.session;
  const before = session.getSnapshot();
  const abort = new AbortController();
  lab.onResult((channel) => {
    if (channel === 0 && lab.channels[0]?.results === lab.tape.events.length + 1)
      session.setSchedulingPaused(true);
  });
  const restore = restoreWorkerTape(lab.binding, session, lab.tape, { signal: abort.signal });
  try {
    await until(() => session.getSnapshot().pending);
    abort.abort();
    const result = await restore;
    assert.equal(result.kind, "not-restored");
    if (result.kind === "not-restored") assert.match(result.notice, /cancelled/);
    expect(session.getSnapshot().accepted).toBe(before.accepted);
    expect(session.getSnapshot().pending).toBe(false);
    detached(lab);
    session.setSchedulingPaused(false);
    expect(lab.channels).toHaveLength(1);
    expect(lab.channels[0]?.disposed).toBe(true);
  } finally {
    session.disconnect();
  }
});

test("a failed private worker detaches its inherited pause and keeps the live result", async () => {
  const spec = cases[2];
  assert.ok(spec);
  const lab = laboratory(spec, { wrongSource: true });
  const before = lab.owner.session.getSnapshot();
  try {
    expect((await restoreWorkerTape(lab.binding, lab.owner.session, lab.tape)).kind).toBe(
      "not-restored",
    );
    expect(lab.owner.session.getSnapshot()).toBe(before);
    detached(lab);
    lab.owner.session.setSchedulingPaused(true);
    lab.owner.session.setSchedulingPaused(false);
    expect(lab.channels).toHaveLength(1);
  } finally {
    lab.owner.session.disconnect();
  }
});

test("a stalled real request resumes only its remaining active timeout budget", async () => {
  const spec = cases[2];
  assert.ok(spec);
  const lab = laboratory(spec, { hold: true });
  const session = lab.owner.session;
  let now = 0;
  let nextTimer = 0;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  const clock = spyOn(performance, "now").mockImplementation(() => now);
  const schedule = spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: () => void,
    delay: number,
  ) => {
    const id = ++nextTimer;
    timers.set(id, { callback, delay });
    return id;
  }) as typeof setTimeout);
  const clear = spyOn(globalThis, "clearTimeout").mockImplementation(((id: number) => {
    timers.delete(id);
  }) as typeof clearTimeout);
  try {
    const restoring = applyWorkerSettings(
      session,
      { ...lab.binding.defaults, v: 0.8 },
      { timeoutMs: 300 },
    );
    for (let i = 0; i < 100 && lab.channels[0]?.results !== 1; i++) await Promise.resolve();
    expect(lab.channels[0]?.results).toBe(1);
    expect(session.getSnapshot().pending).toBe(true);
    expect([...timers.values()].map((timer) => timer.delay)).toEqual([300]);
    now = 80;
    session.setSchedulingPaused(true);
    expect(timers.size).toBe(0);
    now = 10_000;
    session.setSchedulingPaused(false);
    expect([...timers.values()].map((timer) => timer.delay)).toEqual([220]);
    now += 220;
    const timer = [...timers.values()][0];
    assert.ok(timer);
    timer.callback();
    const result = await restoring;
    assert.equal(result.kind, "not-restored");
    if (result.kind === "not-restored") assert.match(result.notice, /too long/);
    expect(lab.owner.subscriptions).toBe(0);
    expect(session.getSnapshot().pending).toBe(false);
    const stopped = session.getSnapshot();
    lab.release();
    expect(session.getSnapshot()).toBe(stopped);
  } finally {
    clear.mockRestore();
    schedule.mockRestore();
    clock.mockRestore();
    session.disconnect();
  }
});
