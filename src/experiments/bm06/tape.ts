import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import type { TapePredictionEvent } from "../permalink/types.ts";
import type { WorkerWalkthroughTarget } from "../permalink/walkthroughActions.ts";
import type { WorkerTapeBinding, WorkerTapeSession } from "../permalink/workerSessionTape.ts";
import { createWorkerWalkthroughTarget } from "../permalink/workerWalkthrough.ts";
import type { Bm06Parameters } from "./definition.ts";
import { BM06_DRAFT_TAPE } from "./draftTape.ts";
import { createBm06Session, type PreparedBm06Example } from "./session.ts";
import { captureBm06Tape } from "./tapeCapture.ts";
import { validateBm06ScientificTape, verifyBm06ScientificCheckpoint } from "./tapeCheckpoint.ts";

/** Complete deterministic outputs are verified before either private or live owner accepts them. */
export function createBm06TapeBinding(
  example: PreparedBm06Example,
  workerFactory: () => WorkerChannel,
  resources?: Parameters<typeof createBm06Session>[3],
): WorkerTapeBinding {
  const binding: WorkerTapeBinding = {
    ...BM06_DRAFT_TAPE,
    environment: Object.freeze({
      ...BM06_DRAFT_TAPE.environment,
      artifactDigest: example.sourceDigest.replace(/^source:/, "host:"),
    }),
    createSession: (instanceId) => createBm06Session(instanceId, example, workerFactory, resources),
    capture: (session, accepted) =>
      captureBm06Tape(binding, session, accepted, example.sourceDigest),
    scientificReplay: {
      validate: (tape, states) => validateBm06ScientificTape(tape, states, example.sourceDigest),
      verify: (tape, publication) =>
        verifyBm06ScientificCheckpoint(tape, publication, example.sourceDigest),
    },
  };
  return Object.freeze(binding);
}

/** The visible laboratory accepts a replay only after its complete owner result verifies. */
export function createBm06WalkthroughTarget(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  onAccepted: (parameters: Bm06Parameters) => void,
  onStarting?: () => void,
  onPredictions?: (predictions: readonly TapePredictionEvent[]) => void,
): WorkerWalkthroughTarget {
  const target = createWorkerWalkthroughTarget(binding, session, onAccepted, onStarting);
  return {
    ...target,
    async restore(tape, signal) {
      const outcome = await target.restore(tape, signal);
      if (outcome.kind === "restored" && !signal?.aborted && tape.predictions)
        onPredictions?.(tape.predictions);
      return outcome;
    },
  };
}
