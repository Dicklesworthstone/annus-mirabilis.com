import { CAMERA_GRID_DT, CAMERA_GRID_STEPS } from "../../physics/reference/inference/camera.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import type { WorkerTapeBinding, WorkerTapeSession } from "../permalink/workerSessionTape.ts";
import { createWorkerWalkthroughTarget } from "../permalink/workerWalkthrough.ts";
import type { Bm08Parameters } from "./definition.ts";
import { BM08_DRAFT_TAPE } from "./draftTape.ts";
import { createBm08Session, type PreparedBm08Example } from "./session.ts";
import { validateBm08ScientificTape, verifyBm08ScientificCheckpoint } from "./tapeCheckpoint.ts";

/** Links still load drafts only; an explicit restore verifies the actual worker publication. */
export function createBm08TapeBinding(
  example: PreparedBm08Example,
  workerFactory: () => WorkerChannel,
): WorkerTapeBinding {
  return Object.freeze({
    ...BM08_DRAFT_TAPE,
    environment: Object.freeze({
      ...BM08_DRAFT_TAPE.environment,
      artifactDigest: example.sourceDigest.replace(/^source:/, "host:"),
      replayGrid: Object.freeze({
        baseSpacing: CAMERA_GRID_DT,
        horizon: CAMERA_GRID_STEPS * CAMERA_GRID_DT,
      }),
    }),
    createSession: (instanceId: string) => createBm08Session(instanceId, example, workerFactory),
    scientificReplay: {
      validate: (tape, states) => validateBm08ScientificTape(tape, states, example.sourceDigest),
      verify: (tape, publication) =>
        verifyBm08ScientificCheckpoint(tape, publication, example.sourceDigest),
    },
  });
}

export function createBm08WalkthroughTarget(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  onAccepted: (parameters: Bm08Parameters) => void,
  onStarting?: () => void,
) {
  return createWorkerWalkthroughTarget(binding, session, onAccepted, onStarting);
}
