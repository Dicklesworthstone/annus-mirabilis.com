import type { AcceptedSnapshot, ExperimentView } from "../store/instanceStore.ts";
import { createWeaveEvaluator } from "./evaluate.ts";
import type { SnapshotOutput, WeaveDerived, WeavePredicate } from "./types.ts";

/** A read-only connection to the same owner the laboratory renders. No new run or worker. */
export type WeaveSession = Readonly<{
  getSnapshot(): ExperimentView;
  getServerSnapshot(): ExperimentView;
  subscribe(listener: () => void): () => void;
}>;

export type SessionWeave =
  | Readonly<{
      kind: "ready";
      accepted: AcceptedSnapshot;
      derived: WeaveDerived;
      prepared: boolean;
    }>
  | Readonly<{
      kind: "inactive";
      reason: "no-result" | "pending" | "refused" | "unavailable" | "wrong-instance";
    }>;

/**
 * Read the published scalars and statuses, never the form or an array's first element.
 * Duplicate identities are unusable, not last-writer-wins. A typed non-value stays a non-value.
 */
export function weaveOutputs(snapshot: AcceptedSnapshot): Readonly<Record<string, SnapshotOutput>> {
  const outputs: Record<string, SnapshotOutput> = Object.create(null);
  const seen = new Set<string>();
  const ambiguous = new Set<string>();
  for (const output of snapshot.outputs) {
    if (seen.has(output.quantityId)) {
      ambiguous.add(output.quantityId);
      continue;
    }
    seen.add(output.quantityId);
    outputs[output.quantityId] = Object.freeze({
      quantityId: output.quantityId,
      status: output.status,
      ...(output.status === "value" && typeof output.value === "number" && Number.isFinite(output.value)
        ? { value: output.value }
        : {}),
    });
  }
  for (const id of ambiguous) delete outputs[id];
  return Object.freeze(outputs);
}

/**
 * The missing publication-to-reader join (am-read-result-weave-jex). Each source owns its own
 * hysteresis and subscribes to every publication while mounted, including ones React batches.
 * It keeps derived flags beside their exact accepted snapshot, without mutating the store.
 * Repeated reads return the same frozen object, as useSyncExternalStore requires.
 */
export function createSessionWeave(
  session: WeaveSession,
  options: Readonly<{
    instrumentId: string;
    constantSetId: string;
    predicates: readonly WeavePredicate[];
  }>,
) {
  const predicates = options.predicates.filter((p) => p.instrumentId === options.instrumentId);
  const evaluator = createWeaveEvaluator(predicates);
  const serverView = session.getServerSnapshot();
  const instanceId = serverView.accepted?.instanceId ?? serverView.requested?.instanceId;
  let previousView: ExperimentView | undefined;
  let previousAccepted: AcceptedSnapshot | undefined;
  let derived: WeaveDerived | undefined;
  let current: SessionWeave = Object.freeze({ kind: "inactive", reason: "no-result" });
  const listeners = new Set<() => void>();
  let disconnect: (() => void) | undefined;

  function read(view: ExperimentView): SessionWeave {
    if (view === previousView) return current;
    previousView = view;
    const accepted = view.accepted;
    const wrong = accepted && (accepted.experimentId !== options.instrumentId ||
      (instanceId !== undefined && accepted.instanceId !== instanceId));
    const stale = accepted && view.requested &&
      (accepted.runId !== view.requested.runId || accepted.actionIndex !== view.requested.actionIndex);
    const reason = wrong ? "wrong-instance" : view.refusal || view.status === "refused" ? "refused" :
      view.status === "unavailable" ? "unavailable" : view.pending || stale ? "pending" :
      !accepted ? "no-result" : undefined;
    if (reason || !accepted) {
      // A refusal must not preserve a previously lit hysteresis state. Pending merely hides it;
      // it does not evaluate yesterday's results against today's requested inputs.
      if (reason === "refused" || reason === "unavailable" || reason === "wrong-instance") {
        evaluator.reset();
        previousAccepted = undefined;
        derived = undefined;
      }
      current = Object.freeze({ kind: "inactive", reason: reason ?? "no-result" });
      return current;
    }
    if (accepted !== previousAccepted || !derived) {
      derived = evaluator.evaluate({
        runId: accepted.runId,
        snapshotVersion: accepted.snapshotVersion,
        constantSetId: options.constantSetId,
        outputs: weaveOutputs(accepted),
        refused: false,
      });
      previousAccepted = accepted;
    }
    current = Object.freeze({ kind: "ready", accepted, derived, prepared: accepted === serverView.accepted });
    return current;
  }

  const serverSnapshot = read(serverView);
  const getSnapshot = () => read(session.getSnapshot());
  return Object.freeze({
    getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!disconnect) {
        // A disconnected period can contain unseen publications. Re-enter conservatively,
        // rather than carrying hysteresis across a sequence this subscriber did not observe.
        evaluator.reset();
        previousView = undefined;
        previousAccepted = undefined;
        derived = undefined;
        disconnect = session.subscribe(() => {
          const before = current;
          getSnapshot();
          if (current !== before) for (const notify of [...listeners]) notify();
        });
        getSnapshot();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          disconnect?.();
          disconnect = undefined;
        }
      };
    },
  });
}
