import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import { requirementsOf, settingsFromTape } from "../permalink/sessionTape.ts";
import type { WorkerWalkthroughTarget } from "../permalink/walkthroughActions.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeBinding,
  type WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import type { Sr03Parameters } from "./definition.ts";
import { SR03_DRAFT_TAPE } from "./draftTape.ts";
import { createSr03Session, type PreparedSr03Example } from "./session.ts";

/**
 * Explicit checkpoint playback uses the real rod laboratory, including its worker and publication
 * protocol. Ordinary ?tape= links retain the draft binding and still start no calculation on arrival.
 */
export function createSr03TapeBinding(
  example: PreparedSr03Example,
  workerFactory: () => WorkerChannel,
): WorkerTapeBinding {
  return Object.freeze({
    ...SR03_DRAFT_TAPE,
    environment: Object.freeze({
      ...SR03_DRAFT_TAPE.environment,
      artifactDigest: example.sourceDigest.replace(/^source:/, "host:"),
    }),
    createSession: (instanceId: string) => createSr03Session(instanceId, example, workerFactory),
  });
}

/** Connect explicit playback to the live lab; update its controls only after final acceptance. */
export function createSr03WalkthroughTarget(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  onAccepted: (parameters: Sr03Parameters) => void,
  onStarting?: () => void,
): WorkerWalkthroughTarget {
  return {
    kind: "worker",
    experimentId: binding.environment.experimentId,
    async restore(tape, signal) {
      onStarting?.();
      const outcome = await restoreWorkerTape(binding, session, tape, { signal });
      if (outcome.kind === "restored" && !signal?.aborted) {
        onAccepted(session.acceptedParameters() as Sr03Parameters);
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
      if (!signal?.aborted) onAccepted(session.acceptedParameters() as Sr03Parameters);
      return { kind: "calculated" };
    },
  };
}
