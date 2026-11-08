import type { WorkerChannel } from "../../workers/scheduler/lq01Scheduler.ts";
import type { WorkerWalkthroughTarget } from "../permalink/walkthroughActions.ts";
import type { WorkerTapeBinding, WorkerTapeSession } from "../permalink/workerSessionTape.ts";
import { createWorkerWalkthroughTarget } from "../permalink/workerWalkthrough.ts";
import type { Lq01Parameters } from "./definition.ts";
import { LQ01_DRAFT_TAPE } from "./draftTape.ts";
import { createLq01Session, type PreparedLq01Example } from "./session.ts";

/** Ordinary shared links load the form; explicit playback uses this exact worker source. */
export function createLq01TapeBinding(
  example: PreparedLq01Example,
  workerFactory: () => WorkerChannel,
): WorkerTapeBinding {
  return Object.freeze({
    ...LQ01_DRAFT_TAPE,
    environment: Object.freeze({
      ...LQ01_DRAFT_TAPE.environment,
      artifactDigest: example.sourceDigest.replace(/^source:/, "host:"),
    }),
    createSession: (instanceId: string) => createLq01Session(instanceId, example, workerFactory),
  });
}

export function createLq01WalkthroughTarget(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  onAccepted: (parameters: Lq01Parameters) => void,
  onStarting?: () => void,
): WorkerWalkthroughTarget {
  return createWorkerWalkthroughTarget(binding, session, onAccepted, onStarting);
}
