import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import type { WorkerWalkthroughTarget } from "../permalink/walkthroughActions.ts";
import type { WorkerTapeBinding, WorkerTapeSession } from "../permalink/workerSessionTape.ts";
import { createWorkerWalkthroughTarget } from "../permalink/workerWalkthrough.ts";
import type { Bm07Parameters } from "./definition.ts";
import { BM07_DRAFT_TAPE } from "./draftTape.ts";
import { createBm07Session, type PreparedBm07Example } from "./session.ts";
import { validateBm07ScientificTape, verifyBm07ScientificCheckpoint } from "./tapeCheckpoint.ts";

/** Links load a draft; explicit playback checks the full trajectory before accepting an estimate. */
export function createBm07TapeBinding(
  example: PreparedBm07Example,
  workerFactory: () => WorkerChannel,
): WorkerTapeBinding {
  return Object.freeze({
    ...BM07_DRAFT_TAPE,
    environment: Object.freeze({
      ...BM07_DRAFT_TAPE.environment,
      artifactDigest: example.sourceDigest.replace(/^source:/, "host:"),
    }),
    createSession: (instanceId: string) => createBm07Session(instanceId, example, workerFactory),
    scientificReplay: {
      validate: (tape, states) => validateBm07ScientificTape(tape, states, example.sourceDigest),
      verify: (tape, publication) =>
        verifyBm07ScientificCheckpoint(tape, publication, example.sourceDigest),
    },
  });
}

export function createBm07WalkthroughTarget(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  onAccepted: (parameters: Bm07Parameters) => void,
  onStarting?: () => void,
): WorkerWalkthroughTarget {
  return createWorkerWalkthroughTarget(binding, session, onAccepted, onStarting);
}
