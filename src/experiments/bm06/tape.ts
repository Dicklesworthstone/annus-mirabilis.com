import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import type { WorkerTapeBinding } from "../permalink/workerSessionTape.ts";
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
