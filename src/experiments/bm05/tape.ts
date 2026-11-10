import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import type { WorkerWalkthroughTarget } from "../permalink/walkthroughActions.ts";
import type { WorkerTapeBinding, WorkerTapeSession } from "../permalink/workerSessionTape.ts";
import { createWorkerWalkthroughTarget } from "../permalink/workerWalkthrough.ts";
import type { Bm05Parameters } from "./definition.ts";
import { BM05_DRAFT_TAPE } from "./draftTape.ts";
import { createBm05Session, type PreparedBm05Example } from "./session.ts";
import { validateBm05ScientificTape, verifyBm05ScientificCheckpoint } from "./tapeCheckpoint.ts";

/** A shared link loads a draft; explicit playback verifies the recorded walks and results. */
export function createBm05TapeBinding(
  example: PreparedBm05Example,
  workerFactory: () => WorkerChannel,
): WorkerTapeBinding {
  return Object.freeze({
    ...BM05_DRAFT_TAPE,
    environment: Object.freeze({
      ...BM05_DRAFT_TAPE.environment,
      artifactDigest: example.sourceDigest.replace(/^source:/, "host:"),
    }),
    createSession: (instanceId: string) => createBm05Session(instanceId, example, workerFactory),
    scientificReplay: {
      validate: (tape, states) => validateBm05ScientificTape(tape, states, example.sourceDigest),
      verify: (tape, publication) =>
        verifyBm05ScientificCheckpoint(tape, publication, example.sourceDigest),
    },
  });
}

export function createBm05WalkthroughTarget(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  onAccepted: (parameters: Bm05Parameters) => void,
  onStarting?: () => void,
): WorkerWalkthroughTarget {
  return createWorkerWalkthroughTarget(binding, session, onAccepted, onStarting);
}
