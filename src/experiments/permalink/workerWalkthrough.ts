import { requirementsOf, settingsFromTape } from "./sessionTape.ts";
import type { WorkerWalkthroughTarget } from "./walkthroughActions.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeBinding,
  type WorkerTapeSession,
} from "./workerSessionTape.ts";

/**
 * Connect a deterministic worker's validated settings to the shared checkpoint player. A request
 * being accepted is not a completed calculation: both paths wait for this request's final result.
 * Each instrument supplies its binding and the typed form update at this boundary.
 */
export function createWorkerWalkthroughTarget<P extends object>(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  onAccepted: (parameters: P) => void,
  onStarting?: () => void,
): WorkerWalkthroughTarget {
  return {
    kind: "worker",
    experimentId: binding.environment.experimentId,
    async restore(tape, signal) {
      onStarting?.();
      const outcome = await restoreWorkerTape(binding, session, tape, { signal });
      if (outcome.kind === "restored" && !signal?.aborted) {
        onAccepted(session.acceptedParameters() as P);
      }
      return outcome;
    },
    async calculate(recorded, signal) {
      onStarting?.();
      const checked = binding.validate({
        ...binding.defaults,
        ...settingsFromTape(recorded, binding.defaults),
      });
      if (checked.kind !== "accepted") {
        return {
          kind: "not-restored",
          notice: requirementsOf(checked) || "The laboratory refuses these recorded settings.",
        };
      }
      const outcome = await applyWorkerSettings(session, checked.data as object, {
        signal,
        newRun: true,
      });
      if (outcome.kind !== "restored") return outcome;
      if (!signal?.aborted) onAccepted(session.acceptedParameters() as P);
      return { kind: "calculated" };
    },
  };
}
