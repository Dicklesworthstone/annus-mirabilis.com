import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import type { WorkerWalkthroughTarget } from "../permalink/walkthroughActions.ts";
import type { WorkerTapeBinding, WorkerTapeSession } from "../permalink/workerSessionTape.ts";
import { createWorkerWalkthroughTarget } from "../permalink/workerWalkthrough.ts";
import type { Bm01Parameters } from "./definition.ts";
import { BM01_DRAFT_TAPE } from "./draftTape.ts";
import { createBm01Session, type PreparedBm01Example } from "./session.ts";
import { validateBm01ScientificTape, verifyBm01ScientificCheckpoint } from "./tapeCheckpoint.ts";

/** Ordinary links load settings; explicit playback verifies both the complete path and results. */
export function createBm01TapeBinding(
  example: PreparedBm01Example,
  workerFactory: () => WorkerChannel,
): WorkerTapeBinding {
  return Object.freeze({
    ...BM01_DRAFT_TAPE,
    environment: Object.freeze({
      ...BM01_DRAFT_TAPE.environment,
      artifactDigest: example.sourceDigest.replace(/^source:/, "host:"),
    }),
    createSession: (instanceId: string) => createBm01Session(instanceId, example, workerFactory),
    scientificReplay: {
      validate: (tape, states) => validateBm01ScientificTape(tape, states, example.sourceDigest),
      verify: (tape, publication) =>
        verifyBm01ScientificCheckpoint(tape, publication, example.sourceDigest),
    },
  });
}

export function createBm01WalkthroughTarget(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  onAccepted: (parameters: Bm01Parameters) => void,
  onStarting?: () => void,
): WorkerWalkthroughTarget {
  return createWorkerWalkthroughTarget(binding, session, onAccepted, onStarting);
}
