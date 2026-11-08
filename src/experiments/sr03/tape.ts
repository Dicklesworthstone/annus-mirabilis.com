import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import type { WorkerWalkthroughTarget } from "../permalink/walkthroughActions.ts";
import type { WorkerTapeBinding, WorkerTapeSession } from "../permalink/workerSessionTape.ts";
import { createWorkerWalkthroughTarget } from "../permalink/workerWalkthrough.ts";
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
  return createWorkerWalkthroughTarget(binding, session, onAccepted, onStarting);
}
