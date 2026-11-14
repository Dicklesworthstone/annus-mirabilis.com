import type { VerifiablePublication } from "../../workers/scheduler/verifiedChannel.ts";
import { draftTapeForSettings } from "../permalink/draftTape.ts";
import { validateTapeV2 } from "../permalink/schema.ts";
import type {
  WorkerTapeBinding,
  WorkerTapeCapture,
  WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import type { AcceptedSnapshot, RequestToken } from "../store/instanceStore.ts";
import {
  bm06CheckpointDigest,
  validateBm06ScientificTape,
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
    accepted.experimentId === "bm-06" &&
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

/** One complete owner result becomes a self-contained checkpoint, never an invented event log. */
export async function captureBm06Tape(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  accepted: AcceptedSnapshot,
  sourceDigest: string,
): Promise<WorkerTapeCapture> {
  if (!isCurrent(session, accepted))
    return unavailable("Finish the current probability calculation before saving its checkpoint.");
  const publication = session.acceptedPublication?.();
  if (!publication || !matchesAccepted(publication, accepted))
    return unavailable(
      "Calculate this probability trial before saving its scientific checkpoint; the displayed example has no complete calculation receipt.",
    );
  try {
    const draft = draftTapeForSettings(binding, accepted.parameters);
    if (!draft)
      return unavailable("The accepted probability settings cannot be saved as a complete checkpoint.");
    const digest = await bm06CheckpointDigest(publication, sourceDigest, 0);
    if (digest.kind !== "digest") return unavailable(digest.notice);
    const tape = validateTapeV2({
      ...draft,
      acceptedCheckpoint: {
        acceptedActionIndex: 0,
        acceptedInputRevision: 0,
        digest: digest.digest,
      },
    });
    const invalid = validateBm06ScientificTape(tape, [accepted.parameters], sourceDigest);
    if (invalid) return unavailable(invalid);
    // SHA-256 yields to the reader. An older result must not become a new share after they
    // calculate, refuse, pause or supersede this request, even if its settings look identical.
    if (!isCurrent(session, accepted))
      return unavailable("The probability result changed while saving. Save the newly accepted trial.");
    return { kind: "captured", tape };
  } catch {
    return unavailable(
      "The probability's scientific checkpoint could not be captured. Calculate and try again.",
    );
  }
}
