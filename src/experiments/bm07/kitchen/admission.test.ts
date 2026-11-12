import { afterEach, expect, test } from "bun:test";
import { kitchenFixture } from "../../../testing/kitchen/fixture.mjs";
import {
  createWorkerAdmission,
  type WorkerAdmission,
} from "../../../workers/scheduler/admission.ts";
import { KITCHEN_OPTIONS } from "./definition.ts";
import { createKitchenHost } from "./host.ts";
import type { KitchenRequest, KitchenResponse } from "./protocol.ts";
import { createKitchenSession } from "./session.ts";

const sourceDigest = "source:sha256:" + "a".repeat(64);
const sessions: ReturnType<typeof createKitchenSession>[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

type Connection = {
  host: ReturnType<typeof createKitchenHost>;
  message: ((message: unknown) => void) | null;
  error: (() => void) | null;
  lateMessage: ((message: unknown) => void) | null;
  lateError: (() => void) | null;
  replies: KitchenResponse[];
  disposed: boolean;
};
type Fault = "factory" | "listen" | "send";

/** Only transport timing and faults are controlled; analysis and response decoding are real. */
function laboratory(id: string, admission: WorkerAdmission, order: string[] = []) {
  const requests: KitchenRequest[] = [];
  const pending: { connection: Connection; request: KitchenRequest }[] = [];
  const connections: Connection[] = [];
  const counts = { created: 0, disposed: 0, unlistened: 0 };
  const control = {
    fault: null as Fault | null,
    onCreate: null as (() => void) | null,
    throwUnlisten: false,
    throwDispose: false,
  };
  function fault(stage: Fault) {
    if (control.fault === stage) {
      control.fault = null;
      throw new Error("Controlled " + stage + " failure.");
    }
  }
  const session = createKitchenSession(
    id,
    () => {
      counts.created++;
      fault("factory");
      let connection: Connection;
      const host = createKitchenHost((message) => {
        const response = structuredClone(message);
        connection.replies.push(response);
        connection.message?.(response);
      }, sourceDigest);
      connection = {
        host,
        message: null,
        error: null,
        lateMessage: null,
        lateError: null,
        replies: [],
        disposed: false,
      };
      connections.push(connection);
      control.onCreate?.();
      return {
        listen(onMessage: (message: unknown) => void, onError: () => void) {
          fault("listen");
          connection.message = connection.lateMessage = onMessage;
          connection.error = connection.lateError = onError;
          return () => {
            counts.unlistened++;
            connection.message = null;
            connection.error = null;
            if (control.throwUnlisten) throw new Error("Controlled unlisten failure.");
          };
        },
        send(message: unknown) {
          fault("send");
          const request = structuredClone(message) as KitchenRequest;
          requests.push(request);
          pending.push({ connection, request });
          order.push(id);
        },
        dispose() {
          counts.disposed++;
          connection.disposed = true;
          host.dispose();
          if (control.throwDispose) throw new Error("Controlled disposal failure.");
        },
      };
    },
    sourceDigest,
    admission,
  );
  sessions.push(session);
  return {
    session,
    requests,
    connections,
    counts,
    control,
    async completeNext() {
      const next = pending.shift();
      if (!next) throw new Error("Expected a real kitchen request in flight.");
      const before = next.connection.replies.length;
      await next.connection.host.receive(next.request);
      return next.connection.replies[before] ?? null;
    },
    crash() {
      const connection = connections.at(-1);
      if (!connection?.error) throw new Error("Expected a connected worker.");
      connection.error();
    },
    inject(message: unknown) {
      const connection = connections.at(-1);
      if (!connection?.message) throw new Error("Expected a connected worker.");
      connection.message(message);
    },
  };
}

async function acceptInitial(lab: ReturnType<typeof laboratory>) {
  expect(await lab.session.submit(kitchenFixture())).toBe(true);
  const response = await lab.completeNext();
  const accepted = lab.session.getSnapshot().accepted;
  if (!accepted || !response || response.result.kind !== "accepted")
    throw new Error(lab.session.getSnapshot().message || "Expected actual accepted analysis.");
  expect(accepted.snapshot).toBe(lab.session.getSnapshot().view.accepted);
  return { accepted, response };
}

function occupy(admission: WorkerAdmission) {
  const owner = {};
  admission.acquire(owner, () => {}, (error) => { throw error; });
  return () => admission.release(owner);
}

test("waiting uploads create no worker and dispatch only the newest ready document and options", async () => {
  const admission = createWorkerAdmission(1);
  const release = occupy(admission);
  const lab = laboratory("latest-upload", admission);
  await lab.session.submit(kitchenFixture());
  const old = lab.session.getSnapshot().view.requested;
  const csv = kitchenFixture({ metadata: { sample: "Latest actual kitchen fixture" } });
  const options = { ...KITCHEN_OPTIONS, axis: "y" as const, coverage: 0.9 };
  await lab.session.submit(csv, options);
  const latest = lab.session.getSnapshot().view.requested;
  expect(latest).not.toEqual(old);
  expect(latest?.parameters.documentDigest).not.toBe(old?.parameters.documentDigest);
  expect(lab.session.getSnapshot().view.pending).toBe(true);
  expect(lab.counts.created).toBe(0);
  expect(lab.requests).toEqual([]);
  expect(admission.activeCount).toBe(1);
  expect(admission.queuedCount).toBe(1);

  release();
  expect(lab.requests).toHaveLength(1);
  expect(lab.requests[0]?.token).toEqual(latest);
  expect(lab.requests[0]?.csv).toBe(csv);
  await lab.completeNext();
  expect(lab.session.getSnapshot().accepted?.csv).toBe(csv);
  expect(lab.session.getSnapshot().accepted?.report.options).toEqual(options);
  expect(lab.session.getSnapshot().accepted?.snapshot).toBe(lab.session.getSnapshot().view.accepted);
  expect(admission.activeCount).toBe(0);
  expect(admission.queuedCount).toBe(0);
});

test("separate kitchens share the budget and a coalesced follow-up rejoins behind a waiting peer", async () => {
  const admission = createWorkerAdmission(2);
  const order: string[] = [];
  const a = laboratory("a", admission, order);
  const b = laboratory("b", admission, order);
  const c = laboratory("c", admission, order);
  const first = (await acceptInitial(a)).accepted;
  await a.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
  await b.session.submit(kitchenFixture());
  await c.session.submit(kitchenFixture());
  await a.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y", coverage: 0.8 });
  await a.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y", coverage: 0.99 });
  const latest = a.session.getSnapshot().view.requested;
  expect(admission.activeCount).toBe(2);
  expect(c.requests).toEqual([]);
  expect(c.counts.created).toBe(0);

  await a.completeNext();
  expect(order).toEqual(["a", "a", "b", "c"]);
  expect(a.session.getSnapshot().accepted).toBe(first);
  expect(a.session.getSnapshot().view.pending).toBe(true);
  expect(a.requests).toHaveLength(2);
  expect(admission.activeCount).toBe(2);
  expect(admission.queuedCount).toBe(1);
  await b.completeNext();
  expect(order).toEqual(["a", "a", "b", "c", "a"]);
  expect(a.requests[2]?.token).toEqual(latest);
  expect(a.counts.created).toBe(1);
  expect(a.counts.disposed).toBe(0);
  await c.completeNext();
  await a.completeNext();
  const final = a.session.getSnapshot().accepted;
  expect(final?.report.options).toEqual({ ...KITCHEN_OPTIONS, axis: "y", coverage: 0.99 });
  expect(final?.sourceId).toBe(first.sourceId);
  expect(final?.documentDigest).toBe(first.documentDigest);
  expect(final?.snapshot.runId).toBe(first.snapshot.runId);
  expect(final?.snapshot).toBe(a.session.getSnapshot().view.accepted);
  expect(admission.activeCount).toBe(0);
  expect(admission.queuedCount).toBe(0);
});

test("hiding a waiting upload withdraws admission without changing its scientific request", async () => {
  const admission = createWorkerAdmission(1);
  const release = occupy(admission);
  const lab = laboratory("waiting-visibility", admission);
  const peer = laboratory("visible-peer", admission);
  await lab.session.submit(kitchenFixture());
  const request = lab.session.getSnapshot().view.requested;
  const state = lab.session.getSnapshot();
  lab.session.setSchedulingPaused(true);
  await peer.session.submit(kitchenFixture());
  expect(admission.queuedCount).toBe(1);
  release();
  expect(peer.requests).toHaveLength(1);
  expect(lab.requests).toEqual([]);
  expect(lab.counts.created).toBe(0);
  expect(lab.session.getSnapshot()).toBe(state);
  lab.session.setSchedulingPaused(false);
  lab.session.setSchedulingPaused(false);
  expect(admission.queuedCount).toBe(1);
  expect(lab.session.getSnapshot().view.requested).toBe(request);
  await peer.completeNext();
  expect(lab.requests[0]?.token).toEqual(request);
  await lab.completeNext();
  expect(lab.session.getSnapshot().accepted?.snapshot.runId).toBe(request?.runId);
  expect(lab.session.getSnapshot().accepted?.snapshot.revisions).toEqual(request?.revisions);
  expect(admission.activeCount).toBe(0);
});

test("hiding active work retains its reservation through acceptance and retains the idle worker", async () => {
  const admission = createWorkerAdmission(1);
  const lab = laboratory("hidden-active", admission);
  const peer = laboratory("hidden-active-peer", admission);
  await lab.session.submit(kitchenFixture());
  const token = lab.session.getSnapshot().view.requested;
  lab.session.setSchedulingPaused(true);
  await peer.session.submit(kitchenFixture());
  expect(admission.activeCount).toBe(1);
  expect(peer.requests).toEqual([]);
  expect(lab.counts.disposed).toBe(0);
  await lab.completeNext();
  const accepted = lab.session.getSnapshot().accepted;
  expect(accepted?.snapshot.runId).toBe(token?.runId);
  expect(accepted?.snapshot.revisions).toEqual(token?.revisions);
  expect(peer.requests).toHaveLength(1);
  expect(lab.counts.disposed).toBe(0);
  await lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
  expect(admission.queuedCount).toBe(0);
  lab.session.setSchedulingPaused(false);
  await peer.completeNext();
  expect(lab.counts.created).toBe(1);
  expect(lab.requests).toHaveLength(2);
  await lab.completeNext();
  expect(lab.session.getSnapshot().accepted?.sourceId).toBe(accepted?.sourceId);
  expect(lab.session.getSnapshot().accepted?.snapshot.runId).toBe(accepted?.snapshot.runId);
  expect(admission.activeCount).toBe(0);
});

for (const action of ["stop", "clear", "disconnect"] as const) {
  test(action + " withdraws waiting work and resume cannot resurrect its request", async () => {
    const admission = createWorkerAdmission(1);
    const lab = laboratory(action + "-waiting", admission);
    const { accepted } = await acceptInitial(lab);
    const release = occupy(admission);
    await lab.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y" });
    lab.session[action]();
    const ended = lab.session.getSnapshot();
    expect(ended.accepted).toBe(action === "clear" ? null : accepted);
    expect(ended.view.pending).toBe(false);
    expect(admission.queuedCount).toBe(0);
    release();
    lab.session.setSchedulingPaused(false);
    expect(lab.session.getSnapshot()).toBe(ended);
    expect(lab.requests).toHaveLength(1);
    expect(lab.counts.disposed).toBe(1);
    expect(admission.activeCount).toBe(0);
  });

  test(action + " terminates active work before admitting a peer and drops its queued revision", async () => {
    const admission = createWorkerAdmission(1);
    const lab = laboratory(action + "-active", admission);
    const peer = laboratory(action + "-peer", admission);
    const { accepted } = await acceptInitial(lab);
    await lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
    await lab.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y" });
    await peer.session.submit(kitchenFixture());
    const disposalAtPeerStart: number[] = [];
    peer.control.onCreate = () => { disposalAtPeerStart.push(lab.counts.disposed); };
    lab.session[action]();
    expect(disposalAtPeerStart).toEqual([1]);
    expect(peer.requests).toHaveLength(1);
    expect(lab.session.getSnapshot().accepted).toBe(action === "clear" ? null : accepted);
    expect(lab.session.getSnapshot().view.pending).toBe(false);
    expect(await lab.completeNext()).toBeNull();
    lab.session.setSchedulingPaused(false);
    await peer.completeNext();
    expect(lab.requests).toHaveLength(2);
    expect(admission.activeCount).toBe(0);
    expect(admission.queuedCount).toBe(0);
  });
}

for (const fault of ["factory", "listen", "send"] as const)
  test(fault + " failure frees admission, preserves accepted data, and permits a later real retry", async () => {
    const admission = createWorkerAdmission(1);
    const lab = laboratory(fault + "-failure", admission);
    const peer = laboratory(fault + "-peer", admission);
    const { accepted } = await acceptInitial(lab);
    lab.session.stop();
    const release = occupy(admission);
    lab.control.fault = fault;
    await lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
    await peer.session.submit(kitchenFixture());
    release();
    expect(peer.requests).toHaveLength(1);
    expect(lab.session.getSnapshot().accepted).toBe(accepted);
    expect(lab.session.getSnapshot().view.pending).toBe(false);
    expect(lab.session.getSnapshot().view.outcome?.outcome).toBe("invariant-violation");
    expect(admission.activeCount).toBe(1);
    expect(admission.queuedCount).toBe(0);
    await lab.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y" });
    await peer.completeNext();
    await lab.completeNext();
    expect(lab.session.getSnapshot().accepted?.report.options.axis).toBe("y");
    expect(lab.session.getSnapshot().accepted?.sourceId).toBe(accepted.sourceId);
    expect(admission.activeCount).toBe(0);
  });

test("a crash terminates its worker before releasing capacity and leaves accepted observations exportable", async () => {
  const admission = createWorkerAdmission(1);
  const lab = laboratory("crashed", admission);
  const peer = laboratory("crash-peer", admission);
  const { accepted } = await acceptInitial(lab);
  await lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
  await peer.session.submit(kitchenFixture());
  const disposalAtPeerStart: number[] = [];
  peer.control.onCreate = () => { disposalAtPeerStart.push(lab.counts.disposed); };
  lab.crash();
  expect(disposalAtPeerStart).toEqual([1]);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.session.getSnapshot().accepted?.csv).toBe(accepted.csv);
  expect(lab.session.getSnapshot().view.pending).toBe(false);
  expect(await lab.completeNext()).toBeNull();
  await peer.completeNext();
  expect(admission.activeCount).toBe(0);
});

test("a real refusal releases its reservation without destroying the reusable worker or accepted data", async () => {
  const admission = createWorkerAdmission(1);
  const lab = laboratory("refused", admission);
  const peer = laboratory("refusal-peer", admission);
  const { accepted } = await acceptInitial(lab);
  await lab.session.submit("not an observation document\n", KITCHEN_OPTIONS, false);
  await peer.session.submit(kitchenFixture());
  const response = await lab.completeNext();
  expect(response?.result.kind).toBe("refused");
  expect(lab.session.getSnapshot().view.refusal).not.toBeNull();
  expect(lab.session.getSnapshot().view.pending).toBe(false);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(peer.requests).toHaveLength(1);
  expect(lab.counts.disposed).toBe(0);
  await lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
  await peer.completeNext();
  await lab.completeNext();
  expect(lab.counts.created).toBe(1);
  expect(lab.session.getSnapshot().accepted?.report.options.coverage).toBe(0.9);
  expect(admission.activeCount).toBe(0);
});

for (const superseded of [false, true])
  test("a malformed " + (superseded ? "superseded" : "current") + " packet cannot release a still-live worker", async () => {
    const admission = createWorkerAdmission(1);
    const lab = laboratory("malformed-" + superseded, admission);
    const peer = laboratory("malformed-peer-" + superseded, admission);
    const { accepted, response } = await acceptInitial(lab);
    await lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
    if (superseded) await lab.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y" });
    await peer.session.submit(kitchenFixture());
    const disposalAtPeerStart: number[] = [];
    peer.control.onCreate = () => { disposalAtPeerStart.push(lab.counts.disposed); };
    // Corrupt a real response while the next analysis has not yet returned.
    lab.inject({ ...structuredClone(response), sourceDigest: "source:sha256:" + "b".repeat(64) });
    expect(disposalAtPeerStart).toEqual([1]);
    expect(lab.session.getSnapshot().accepted).toBe(accepted);
    expect(lab.session.getSnapshot().view.pending).toBe(false);
    expect(lab.session.getSnapshot().view.outcome?.outcome).toBe("invariant-violation");
    expect(await lab.completeNext()).toBeNull();
    await peer.completeNext();
    expect(lab.requests).toHaveLength(2);
    expect(admission.activeCount).toBe(0);
    expect(admission.queuedCount).toBe(0);
  });

test("late callbacks from a disposed channel cannot fail or release its replacement", async () => {
  const admission = createWorkerAdmission(1);
  const lab = laboratory("connection-epoch", admission);
  const peer = laboratory("epoch-peer", admission);
  const { accepted, response } = await acceptInitial(lab);
  const old = lab.connections[0];
  if (!old?.lateMessage || !old.lateError) throw new Error("Expected saved transport callbacks.");
  await lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
  lab.session.stop();
  await lab.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y" });
  await peer.session.submit(kitchenFixture());
  const state = lab.session.getSnapshot();
  old.lateMessage(structuredClone(response));
  old.lateError();
  expect(lab.session.getSnapshot()).toBe(state);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.session.getSnapshot().view.pending).toBe(true);
  expect(peer.requests).toEqual([]);
  expect(admission.activeCount).toBe(1);
  expect(await lab.completeNext()).toBeNull();
  await lab.completeNext();
  expect(lab.session.getSnapshot().accepted?.report.options.axis).toBe("y");
  expect(lab.counts.created).toBe(2);
  expect(peer.requests).toHaveLength(1);
  await peer.completeNext();
  expect(admission.activeCount).toBe(0);
});

test("acceptance cannot overwrite a clear invoked synchronously by the next admitted peer", async () => {
  const admission = createWorkerAdmission(1);
  const lab = laboratory("clear-on-release", admission);
  const peer = laboratory("clearing-peer", admission);
  await lab.session.submit(kitchenFixture());
  await peer.session.submit(kitchenFixture());
  peer.control.onCreate = () => { lab.session.clear(); };
  await lab.completeNext();
  expect(lab.session.getSnapshot().accepted).toBeNull();
  expect(lab.session.getSnapshot().view.requested).toBeNull();
  expect(lab.session.getSnapshot().view.pending).toBe(false);
  expect(lab.session.getSnapshot().message).toContain("cleared");
  expect(lab.counts.disposed).toBe(1);
  expect(peer.requests).toHaveLength(1);
  await peer.completeNext();
  expect(admission.activeCount).toBe(0);
});

for (const terminal of ["stop", "clear", "disconnect", "crash"] as const)
  test(terminal + " cannot overwrite new preparation started by an admitted peer", async () => {
    const admission = createWorkerAdmission(1);
    const lab = laboratory("prepare-on-" + terminal, admission);
    const peer = laboratory("preparing-peer-" + terminal, admission);
    const { accepted } = await acceptInitial(lab);
    await lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
    await peer.session.submit(kitchenFixture());
    const csv = kitchenFixture({ metadata: { sample: "Reentrant replacement after " + terminal } });
    let submission: Promise<boolean> | null = null;
    peer.control.onCreate = () => { submission = lab.session.submit(csv); };
    if (terminal === "crash") lab.crash();
    else lab.session[terminal]();
    expect(lab.session.getSnapshot().preparing).toBe(true);
    expect(lab.session.getSnapshot().accepted).toBe(terminal === "clear" ? null : accepted);
    expect(lab.session.getSnapshot().message).toContain("Checking");
    expect(submission).not.toBeNull();
    expect(await submission).toBe(true);
    expect(lab.session.getSnapshot().view.pending).toBe(true);
    expect(await lab.completeNext()).toBeNull();
    await peer.completeNext();
    await lab.completeNext();
    expect(lab.session.getSnapshot().accepted?.csv).toBe(csv);
    expect(lab.session.getSnapshot().accepted?.snapshot).toBe(lab.session.getSnapshot().view.accepted);
    expect(admission.activeCount).toBe(0);
  });

test("an acceptance subscriber can pause, request a revision and resume without losing admission", async () => {
  const admission = createWorkerAdmission(1);
  const lab = laboratory("subscriber-revision", admission);
  const peer = laboratory("subscriber-peer", admission);
  let requested = false;
  let revision: Promise<boolean> | null = null;
  const off = lab.session.subscribe(() => {
    if (!requested && lab.session.getSnapshot().accepted) {
      requested = true;
      lab.session.setSchedulingPaused(true);
      revision = lab.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y" });
      lab.session.setSchedulingPaused(false);
    }
  });
  await lab.session.submit(kitchenFixture());
  await peer.session.submit(kitchenFixture());
  await lab.completeNext();
  off();
  expect(revision).not.toBeNull();
  expect(await revision).toBe(true);
  const token = lab.session.getSnapshot().view.requested;
  expect(lab.requests).toHaveLength(1);
  expect(peer.requests).toHaveLength(1);
  expect(admission.queuedCount).toBe(1);
  await peer.completeNext();
  expect(lab.requests[1]?.token).toEqual(token);
  await lab.completeNext();
  expect(lab.session.getSnapshot().accepted?.report.options.axis).toBe("y");
  expect(lab.counts.created).toBe(1);
  expect(admission.activeCount).toBe(0);
});

for (const action of ["stop", "clear"] as const)
  test(action + " during factory startup disposes the orphan before another worker is admitted", async () => {
    const admission = createWorkerAdmission(1);
    const release = occupy(admission);
    const lab = laboratory("startup-" + action, admission);
    const peer = laboratory("startup-peer-" + action, admission);
    lab.control.onCreate = () => { lab.session[action](); };
    const disposedAtPeerStart: number[] = [];
    peer.control.onCreate = () => { disposedAtPeerStart.push(lab.counts.disposed); };
    await lab.session.submit(kitchenFixture());
    await peer.session.submit(kitchenFixture());
    release();
    expect(disposedAtPeerStart).toEqual([1]);
    expect(lab.connections[0]?.disposed).toBe(true);
    expect(lab.requests).toEqual([]);
    expect(lab.session.getSnapshot().view.pending).toBe(false);
    expect(lab.session.getSnapshot().accepted).toBeNull();
    expect(peer.requests).toHaveLength(1);
    await peer.completeNext();
    expect(admission.activeCount).toBe(0);
    expect(admission.queuedCount).toBe(0);
  });

test("throwing transport cleanup still releases capacity after the worker is terminated", async () => {
  const admission = createWorkerAdmission(1);
  const lab = laboratory("throwing-cleanup", admission);
  const peer = laboratory("cleanup-peer", admission);
  const { accepted } = await acceptInitial(lab);
  await lab.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y" });
  await peer.session.submit(kitchenFixture());
  lab.control.throwUnlisten = true;
  lab.control.throwDispose = true;
  const disposedAtPeerStart: boolean[] = [];
  peer.control.onCreate = () => { disposedAtPeerStart.push(lab.connections[0]?.disposed ?? false); };
  expect(() => lab.session.stop()).not.toThrow();
  expect(disposedAtPeerStart).toEqual([true]);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.session.getSnapshot().view.pending).toBe(false);
  expect(await lab.completeNext()).toBeNull();
  await peer.completeNext();
  expect(admission.activeCount).toBe(0);
});
