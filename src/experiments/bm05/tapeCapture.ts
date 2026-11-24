import type { VerifiablePublication } from "../../workers/scheduler/verifiedChannel.ts";
import { draftTapeForSettings } from "../permalink/draftTape.ts";
import { validateTapeV2 } from "../permalink/schema.ts";
import type {
  WorkerTapeBinding,
  WorkerTapeCapture,
  WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import type { AcceptedSnapshot, RequestToken } from "../store/instanceStore.ts";
import type { Bm05Parameters } from "./definition.ts";
import {
  bm05CheckpointDigest,
  bm05ScientificState,
  validateBm05ScientificTape,
} from "./tapeCheckpoint.ts";

const unavailable = (notice: string): WorkerTapeCapture => ({ kind: "unavailable", notice });

function sameRequest(left: RequestToken, right: RequestToken): boolean {
  return (
    left.experimentId === right.experimentId &&
    left.instanceId === right.instanceId &&
    left.runId === right.runId &&
    left.parentRunId === right.parentRunId &&
    left.actionIndex === right.actionIndex &&
    Object.entries(left.revisions).every(
      ([key, value]) => right.revisions[key as keyof typeof left.revisions] === value,
    ) &&
    Object.keys(left.parameters).length === Object.keys(right.parameters).length &&
    Object.entries(left.parameters).every(([key, value]) => Object.is(right.parameters[key], value))
  );
}

function isCurrent(session: WorkerTapeSession, accepted: AcceptedSnapshot): boolean {
  const view = session.getSnapshot();
  return (
    view.accepted === accepted &&
    view.status === "accepted" &&
    !view.pending &&
    accepted.final &&
    accepted.experimentId === "bm-05" &&
    view.requested !== null &&
    sameRequest(accepted, view.requested)
  );
}

function matchesAccepted(publication: VerifiablePublication, accepted: AcceptedSnapshot): boolean {
  return (
    publication.final &&
    publication.stepIndex === accepted.stepIndex &&
    publication.simulationTime === accepted.simulationTime &&
    sameRequest(publication, accepted)
  );
}

/** Save the complete owner recording and its selected observation without inventing earlier actions. */
export async function captureBm05Tape(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  accepted: AcceptedSnapshot,
  sourceDigest: string,
): Promise<WorkerTapeCapture> {
  if (!isCurrent(session, accepted))
    return unavailable("Finish the current walk calculation before saving its checkpoint.");
  const publication = session.acceptedPublication?.();
  if (!publication || !matchesAccepted(publication, accepted))
    return unavailable(
      "Calculate this walk trial before saving its scientific checkpoint; the displayed example has no complete recording receipt.",
    );
  try {
    const draft = draftTapeForSettings(binding, accepted.parameters);
    if (!draft)
      return unavailable("The accepted walk settings cannot be saved as a complete checkpoint.");
    const digest = await bm05CheckpointDigest(publication, sourceDigest, 0);
    if (digest.kind !== "digest") return unavailable(digest.notice);
    const tape = validateTapeV2({
      ...draft,
      acceptedCheckpoint: {
        acceptedActionIndex: 0,
        acceptedInputRevision: 0,
        digest: digest.digest,
        scientificState: bm05ScientificState(accepted.parameters as Bm05Parameters),
      },
    });
    const invalid = validateBm05ScientificTape(tape, [accepted.parameters], sourceDigest);
    if (invalid) return unavailable(invalid);
    // Hashing yields to new requests. Equal settings do not make an older accepted result current.
    if (!isCurrent(session, accepted))
      return unavailable("The walk result changed while saving. Save the newly accepted trial.");
    return { kind: "captured", tape };
  } catch {
    return unavailable(
      "The walk's scientific checkpoint could not be captured. Calculate and try again.",
    );
  }
}
