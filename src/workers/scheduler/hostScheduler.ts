import { LabProtocolError, validateSourceDigest } from "../protocol/bm06.ts";
import { executionOutcomeRegistry, type ExecutionOutcomeId } from "../../experiments/results/outcomes.ts";
import type { createInstanceStore, RequestToken } from "../../experiments/store/instanceStore.ts";

export type WorkerChannel = Readonly<{
  send(message: unknown): void;
  listen(onMessage: (message: unknown) => void, onError: () => void): () => void;
  dispose(): void;
}>;
import type { ScientificResult } from "../../experiments/results/types.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
export type HostProtocol = Readonly<{
  version: string;
  decodeHello(message: unknown, digest: string): unknown;
  decodeResponse(message: unknown, token: RequestToken, digest: string): Readonly<{ token: RequestToken; result: Computation<{ outputs: readonly ScientificResult[]; stepIndex: number; simulationTime: number }> }>;
}>;
type Store = ReturnType<typeof createInstanceStore>;
export type SchedulerEvent = Readonly<{ kind: "dispatched" | "superseded" | "stale" | "completed" | "failed"; actionIndex: number }>;
/** Lazy dedicated-worker channel; newest pending request wins, with store-level ordering as a second guard. */
export function createHostScheduler(store: Store, factory: () => WorkerChannel, sourceDigest: string, protocol: HostProtocol, report: (event: SchedulerEvent) => void = () => {}) {
  validateSourceDigest(sourceDigest);
  let channel: WorkerChannel | null = null, unsubscribe: (() => void) | null = null;
  let active: RequestToken | null = null, pending: RequestToken | null = null;
  let ready = false, disposed = false, cancelSent = false;
  let epoch = 0, failures = 0;
  function notify(kind: SchedulerEvent["kind"], token: RequestToken): void {
    try { report({ kind, actionIndex: token.actionIndex }); } catch { /* Diagnostics cannot change publication. */ }
  }
  function close(): void {
    epoch++;
    unsubscribe?.(); unsubscribe = null;
    channel?.dispose(); channel = null;
    active = null; ready = false; cancelSent = false;
  }
  function fail(id: Exclude<ExecutionOutcomeId, "budget-exhausted">): void {
    const token = pending ?? active;
    pending = null;
    if (token) { store.fail(token, { outcome: id, ...executionOutcomeRegistry[id] }); notify("failed", token); }
    failures++; close();
  }
  function dispatch(): void {
    if (!ready || !channel || active || !pending || disposed) return;
    active = pending; pending = null; cancelSent = false;
    try {
      channel.send({ messageKind: "request", protocolVersion: protocol.version, sourceDigest, token: active });
      notify("dispatched", active);
    } catch { fail("transport-error"); }
  }
  function connect(): void {
    if (channel || disposed) return;
    if (failures >= 3) { fail("environment-unsupported"); return; }
    try {
      channel = factory();
      const generation = ++epoch;
      unsubscribe = channel.listen(message => {
        if (generation !== epoch || disposed) return;
        try {
          if (!ready) { protocol.decodeHello(message, sourceDigest); ready = true; dispatch(); return; }
          if (!active) return;
          const response = protocol.decodeResponse(message, active, sourceDigest);
          const token = active;
          let decision;
          if (response.result.kind === "accepted") decision = store.publish({ ...response.token, ...response.result.data, final: true });
          else if (response.result.kind === "refused") decision = store.refuse(response.token, response.result.refusal);
          else decision = store.fail(response.token, response.result.outcome);
          notify(decision.accepted ? "completed" : "stale", token);
          active = null; dispatch();
        } catch (error) { fail(error instanceof LabProtocolError ? error.code : "malformed-response"); }
      }, () => { if (generation === epoch && !disposed) fail("worker-crashed"); });
    } catch { fail("environment-unsupported"); }
  }
  return Object.freeze({
    request(token: RequestToken): void {
      if (disposed) throw new Error("The laboratory scheduler was disposed.");
      if (store.getSnapshot().requested !== token) throw new TypeError("Only the store's currently issued token can be scheduled.");
      if (pending) notify("superseded", pending);
      pending = token;
      connect();
      if (active && !cancelSent && channel) {
        try { channel.send({ messageKind: "cancel", protocolVersion: protocol.version, instanceId: active.instanceId, actionIndex: active.actionIndex }); cancelSent = true; }
        catch { fail("transport-error"); }
      }
      dispatch();
    },
    cancel(): void { pending = null; store.pause(); close(); },
    dispose(): void { if (disposed) return; disposed = true; pending = null; store.pause(); close(); },
  });
}
