/**
 * LQ-08's ?tape= permalink: the tape a reader shares, and the replay that restores it
 * (am-inst-permalink-tape-s677).
 *
 * The first laboratory to read a tape. The tape carries the accepted settings as its initial
 * conditions; restoring replays them through the laboratory's own session, so the same validator,
 * owner and store produce the restored state, and the checkpoint digest confirms replay reached it.
 */
import type { U64String } from "../identity/u64.ts";
import { decodeTapePermalinkInBrowser } from "../permalink/browserCodec.ts";
import { type ReplayRunner, replayTape } from "../permalink/replay.ts";
import type { ExperimentEnvironment, TapeAcceptedCheckpoint, TapeV2 } from "../permalink/types.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import { computeTapeDigest } from "../tape/controlTape.ts";
import { LQ08_DEFAULTS, LQ08_MODEL, type Lq08Parameters } from "./definition.ts";
import { validateLq08Parameters } from "./parameters.ts";
import { createLq08Session } from "./session.ts";

type Lq08Session = ReturnType<typeof createLq08Session>;

/**
 * content/experiments/lq-08.yaml's tapeModel (lq-08, version 1) and the constant set LQ08_MODEL
 * computes with. LQ-08 draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
export const LQ08_TAPE_ENVIRONMENT: ExperimentEnvironment = Object.freeze({
  experimentId: "lq-08",
  mode: "lq-08:default",
  modelId: "lq-08",
  modelVersion: 1,
  constantSetId: LQ08_MODEL.constantSetId,
  streamVersion: "deterministic",
  allocationId: "deterministic",
});

const settings = (p: Lq08Parameters): Record<string, number> => ({ ...p });

/**
 * FNV-1a over the accepted settings quantized to 10⁻⁶ (computeTapeDigest). It confirms that replay
 * reached the recorded settings; the exact values travel in the tape's initial conditions.
 */
function checkpointDigest(p: Lq08Parameters, actionIndex: number): string {
  return computeTapeDigest(settings(p), actionIndex, 0).digest;
}

/**
 * Replays a tape through LQ-08's own session: its validator, owner and store. A setting the
 * laboratory refuses stops the replay, and refusalSentence() keeps the laboratory's own sentence
 * for it, since replayTape's notice carries the raw error.
 */
export function createLq08ReplayRunner(
  session: Lq08Session,
): ReplayRunner & Readonly<{ refusalSentence(): string }> {
  let actionIndex = 0;
  let refusal = "";
  const apply = (patch: Record<string, number | string>) => {
    const outcome = session.apply(patch);
    if (outcome.kind === "accepted") return;
    const requirements = outcome.kind === "refused" ? outcome.refusal.details?.requirements : "";
    refusal =
      typeof requirements === "string" && requirements
        ? requirements
        : "The shared settings could not be applied.";
    throw new ExperimentRuntimeError("parameters-rejected", refusal, "lq-08");
  };
  return {
    refusalSentence: () => refusal,
    environment: LQ08_TAPE_ENVIRONMENT,
    applyInitialConditions(conditions) {
      apply(conditions);
      actionIndex = 0;
    },
    applyEvent(event) {
      apply({ [event.paramId]: event.value });
      actionIndex = event.actionIndex;
    },
    getAcceptedCheckpoint(): TapeAcceptedCheckpoint {
      return {
        acceptedActionIndex: actionIndex,
        acceptedInputRevision: session.getSnapshot().accepted?.revisions.input ?? 0,
        digest: checkpointDigest(session.acceptedParameters(), actionIndex),
      };
    },
    getCurrentState() {
      return settings(session.acceptedParameters());
    },
  };
}

/**
 * The tape for a set of accepted settings. Its checkpoint is the one a fresh laboratory reaches by
 * replaying it, so a reader who opens the link gets the same checkpoint back.
 */
export function lq08TapeFor(p: Lq08Parameters): TapeV2 {
  const probe = createLq08Session("lq-08-tape-checkpoint");
  const runner = createLq08ReplayRunner(probe);
  runner.applyInitialConditions(settings(p));
  const tape: TapeV2 = {
    tapeVersion: 2,
    experimentId: LQ08_TAPE_ENVIRONMENT.experimentId,
    mode: LQ08_TAPE_ENVIRONMENT.mode,
    modelIdentity: {
      modelId: LQ08_TAPE_ENVIRONMENT.modelId,
      modelVersion: LQ08_TAPE_ENVIRONMENT.modelVersion,
    },
    constantSetId: LQ08_TAPE_ENVIRONMENT.constantSetId,
    seed: "0" as U64String,
    streamVersion: LQ08_TAPE_ENVIRONMENT.streamVersion,
    allocationId: LQ08_TAPE_ENVIRONMENT.allocationId,
    initialConditions: settings(p),
    events: [],
    acceptedCheckpoint: runner.getAcceptedCheckpoint(),
  };
  return Object.freeze(tape);
}

export type Lq08TapeRestore =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "restored" }>
  | Readonly<{ kind: "not-restored"; notice: string }>;

/**
 * Restores a decoded tape into the laboratory. Anything short of a verified replay leaves the
 * settings the reader already had, and says why in a sentence.
 */
export function restoreLq08Tape(session: Lq08Session, tape: TapeV2): Lq08TapeRestore {
  if (tape.experimentId !== LQ08_TAPE_ENVIRONMENT.experimentId) {
    return {
      kind: "not-restored",
      notice: `This shared state could not be restored: it was recorded in another laboratory, ${tape.experimentId}.`,
    };
  }
  // The laboratory's own sentence for a setting it would refuse, before anything is replayed.
  const checked = validateLq08Parameters({ ...LQ08_DEFAULTS, ...tape.initialConditions });
  if (checked.kind !== "accepted") {
    const requirements = checked.kind === "refused" ? checked.refusal.details?.requirements : "";
    return {
      kind: "not-restored",
      notice: `This shared state could not be restored. ${typeof requirements === "string" && requirements ? requirements : "Its settings are not ones this laboratory accepts."}`,
    };
  }
  const before = settings(session.acceptedParameters());
  const runner = createLq08ReplayRunner(session);
  const replayed = replayTape(tape, runner);
  if (replayed.kind === "success") return { kind: "restored" };
  // A refusal stops before anything is applied; an invalid or unverified replay may not have.
  session.apply(before);
  const refused = runner.refusalSentence();
  return {
    kind: "not-restored",
    notice:
      replayed.kind === "refusal"
        ? `${replayed.notice} ${replayed.repair}`
        : replayed.kind === "invalid" && refused
          ? `This shared state could not be restored. ${refused}`
          : replayed.notice,
  };
}

/** Reads ?tape= from the page's address and restores it; "absent" when there is none. */
export async function restoreLq08FromUrl(
  session: Lq08Session,
  href: string,
): Promise<Lq08TapeRestore> {
  // A URL, not the string: a bare string with no "?" is read as a tape itself (extractTapeParam),
  // so every ordinary page load would report a link it could not restore.
  let address: URL;
  try {
    address = new URL(href);
  } catch {
    return { kind: "absent" };
  }
  const decoded = await decodeTapePermalinkInBrowser(address);
  if (decoded.kind === "absent") return { kind: "absent" };
  if (decoded.kind === "invalid") return { kind: "not-restored", notice: decoded.notice };
  return restoreLq08Tape(session, decoded.tape);
}
