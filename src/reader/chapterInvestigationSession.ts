import type { RequestRefusal } from "../experiments/results/refusals.ts";
import type { ExperimentView } from "../experiments/store/instanceStore.ts";

type Attempt = Readonly<{ kind: string; refusal?: RequestRefusal }>;
type Operation = (input: unknown) => Attempt;
type Session = Readonly<{
  getSnapshot(): ExperimentView;
  subscribe(listener: () => void): () => void;
  apply: Operation;
  startNewRun: Operation;
}>;

/**
 * These synchronous owners retain their accepted snapshot when parameter validation refuses an
 * attempt. The chapter must retain that evidence too, without offering it as the new reading.
 * Forward every operation and result unchanged; only the availability of capture is qualified.
 */
export function chapterInvestigationSession<S extends Session>(owner: S) {
  let state: "ready" | "pending" | "refused" | "unavailable" = "ready";
  let refusal: RequestRefusal | null = null;
  let previous: ExperimentView | undefined;
  let view: ExperimentView = owner.getSnapshot();
  let disconnect: (() => void) | undefined;
  const listeners = new Set<() => void>();

  function getSnapshot(): ExperimentView {
    const accepted = owner.getSnapshot();
    if (accepted !== previous) {
      previous = accepted;
      view =
        state === "ready"
          ? accepted
          : Object.freeze({
              ...accepted,
              status: state,
              pending: state === "pending",
              refusal,
            });
    }
    return view;
  }
  function publish() {
    previous = undefined;
    getSnapshot();
    for (const listener of listeners) listener();
  }
  function observe<F extends Operation>(operation: F): F {
    return ((input: unknown) => {
      state = "pending";
      refusal = null;
      publish();
      try {
        const result = operation(input);
        state = result.kind === "accepted" ? "ready" : "refused";
        refusal = result.refusal ?? null;
        publish();
        return result;
      } catch (error) {
        state = "unavailable";
        publish();
        throw error;
      }
    }) as F;
  }
  return Object.freeze({
    ...owner,
    getSnapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      disconnect ??= owner.subscribe(publish);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          disconnect?.();
          disconnect = undefined;
        }
      };
    },
    apply: observe(owner.apply),
    startNewRun: observe(owner.startNewRun),
    /** A form can refuse text before calling the owner, or explicitly return to its kept result. */
    validationStateChanged(validation: "invalid" | "restored") {
      state = validation === "invalid" ? "refused" : "ready";
      refusal = null;
      publish();
    },
  });
}
