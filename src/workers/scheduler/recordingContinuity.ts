import type { createInstanceStore, RequestToken } from "../../experiments/store/instanceStore.ts";
import type { PublicationVerifier, VerifiablePublication } from "./verifiedChannel.ts";

type RecordingCheckpoint = Readonly<Record<string, string | number>>;
type Recorded = Readonly<{ token: RequestToken; checkpoint: RecordingCheckpoint }>;

/** The owner protocol validates its schema before this seam sees a publication. */
function checkpointOf(publication: VerifiablePublication): RecordingCheckpoint | null {
  const value = publication.recordingCheckpoint;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (
    !entries.every(
      ([, field]) =>
        typeof field === "string" || (typeof field === "number" && Number.isFinite(field)),
    ) ||
    !("digest" in value) ||
    typeof value.digest !== "string" ||
    !/^host:sha256:[a-f0-9]{64}$/.test(value.digest)
  )
    return null;
  return Object.freeze(Object.fromEntries(entries)) as RecordingCheckpoint;
}

function sameCheckpoint(left: RecordingCheckpoint, right: RecordingCheckpoint): boolean {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.is(left[key], right[key]))
  );
}

/**
 * Keep only the small, complete-trajectory attestation, not a duplicate particle buffer. A new
 * worker may reconstruct the recording from the same seed, but it cannot publish into that run
 * unless its model/engine/stream identity and every latent coordinate's digest still agree.
 * Candidates become trusted only after the actual store has accepted their publication.
 */
export function createRecordingContinuity(
  store: Pick<ReturnType<typeof createInstanceStore>, "getSnapshot">,
) {
  let accepted: Recorded | null = null;
  let candidate: Recorded | null = null;

  function promote(): void {
    const current = store.getSnapshot().accepted;
    if (
      candidate &&
      current?.instanceId === candidate.token.instanceId &&
      current.runId === candidate.token.runId &&
      current.actionIndex === candidate.token.actionIndex
    ) {
      accepted = candidate;
      candidate = null;
    }
  }

  return Object.freeze({
    canRetire(): boolean {
      promote();
      const current = store.getSnapshot().accepted;
      return Boolean(
        accepted &&
          current?.instanceId === accepted.token.instanceId &&
          current.runId === accepted.token.runId &&
          current.actionIndex === accepted.token.actionIndex,
      );
    },
    verifier(token: RequestToken, additional?: PublicationVerifier): PublicationVerifier {
      return async (publication) => {
        promote();
        const checkpoint = checkpointOf(publication);
        if (accepted?.token.runId === token.runId) {
          if (!checkpoint)
            return "The worker could not verify the saved recording. The previous accepted result is unchanged. Start a new independent trial to continue.";
          if (!sameCheckpoint(accepted.checkpoint, checkpoint))
            return "The worker could not recover the same recording: its calculation engine or complete trajectory differs from the accepted run. The previous accepted result is unchanged. Start a new independent trial to continue.";
        }
        const notice = additional ? await additional(publication) : null;
        if (notice !== null) return notice;
        promote();
        const current = store.getSnapshot();
        if (checkpoint && current.requested === token && current.pending)
          candidate = { token, checkpoint };
        return null;
      };
    },
  });
}
