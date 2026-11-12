import { requirementsOf, settingsFromTape } from "./sessionTape.ts";
import type { WorkerWalkthroughTarget } from "./walkthroughActions.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeBinding,
  type WorkerTapeSession,
} from "./workerSessionTape.ts";

/**
 * Connect a worker's validated settings and checkpoint policy to the shared player. A request
 * being accepted is not a completed calculation: both paths wait for this request's final result.
 * Each instrument supplies its binding and the typed form update at this boundary.
 */
export function createWorkerWalkthroughTarget<P extends object>(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  onAccepted: (parameters: P) => void,
  onStarting?: () => void,
): WorkerWalkthroughTarget {
  // URL restoration and the catalogue player share this target. Refuse their overlap before
  // onStarting captures a form revision; a refused second request must not rebase the first.
  let working = false;
  const busy = () => ({
    kind: "not-restored" as const,
    notice:
      "Another checkpoint calculation is still running. Wait for it to finish or cancel it first.",
  });
  return {
    kind: "worker",
    experimentId: binding.environment.experimentId,
    async restore(tape, signal) {
      if (working) return busy();
      working = true;
      try {
        onStarting?.();
        const outcome = await restoreWorkerTape(binding, session, tape, { signal });
        if (outcome.kind === "restored" && !signal?.aborted) {
          onAccepted(session.acceptedParameters() as P);
        }
        return outcome;
      } finally {
        working = false;
      }
    },
    async calculate(recorded, signal) {
      if (working) return busy();
      working = true;
      try {
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
      } finally {
        working = false;
      }
    },
  };
}
