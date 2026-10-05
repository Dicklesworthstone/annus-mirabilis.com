import { type LabTapeBinding, replayTapeOnSession, type TapeSession } from "./sessionTape.ts";
import { resolveTeachingTape } from "./teachingTapeCatalogue.ts";
import type { TapeAcceptedCheckpoint, TapeV2 } from "./types.ts";

/**
 * The join between the authored catalogue and a live laboratory (am-2rl9). Resolve once, choose an
 * exact endpoint, then preflight against an isolated session before publishing any live settings.
 * Historical constant sets and placeholder checkpoints are never rewritten to earn replay success.
 * `asNewRun` deliberately skips that verification and MUST remain visible in the reader's outcome.
 * The laboratory still owns execution labels; a record cannot lend its model's label to a result.
 */

/** The same tape with no teaching reference, so the replayer uses the events it is given. */
function withoutTeachingRef(tape: TapeV2): TapeV2 {
  const { teachingTapeRef: _ref, ...rest } = tape;
  return rest as TapeV2;
}

export type TeachingTapeReplay =
  | Readonly<{
      kind: "replayed";
      tapeId: string;
      experimentId: string;
      runId: string;
      isNewRun: boolean;
      executedEventCount: number;
      acceptedCheckpoint: TapeAcceptedCheckpoint;
      state: Record<string, number | string>;
    }>
  | Readonly<{ kind: "unknown-walkthrough"; tapeId: string; notice: string }>
  | Readonly<{
      kind: "not-this-laboratory";
      tapeId: string;
      experimentId: string;
      recordedFor: string;
      notice: string;
    }>
  | Readonly<{
      kind: "refused";
      tapeId: string;
      experimentId: string;
      refusalCode: string;
      notice: string;
      repair?: string | undefined;
    }>;

export type TeachingTapeReplayOptions = Readonly<{
  /**
   * Replay as an explicitly new run, skipping the identity check and the checkpoint verification.
   * The result carries `isNewRun: true` and a caller that shows it must say so.
   */
  asNewRun?: boolean | undefined;
  /**
   * Play only as far as this event, counting from zero, for a page that walks a reader through one
   * step at a time. The default is the recorded accepted checkpoint, which may precede later events.
   * A verified replay must end at that checkpoint; another step requires an explicitly new run.
   * Invalid indices are refused. As in the original scrubber, a seek past the end stops at the
   * last event; the reported event count always describes the events actually applied.
   *
   * This exists because a record resolves through `teachingTapeRef`, and every authored record
   * carries a ref to ITSELF with `stepIndex: 0`. The replayer honours that ref and slices the
   * events to it, so a join that passed the record through unchanged played the first event and
   * stopped: the-two-pulses replayed 1 of its 3 events and reported success. The request this
   * function builds names the step it wants rather than inheriting the record's.
   */
  stepIndex?: number | undefined;
  /** For a test that needs a record other than the published catalogue's. */
  resolve?: ((tapeId: string) => TapeV2 | null) | undefined;
}>;

/**
 * Play an authored walkthrough on a laboratory session, resolving it from the published catalogue.
 */
export function replayTeachingTapeOn(
  binding: LabTapeBinding,
  session: TapeSession,
  tapeId: string,
  options: TeachingTapeReplayOptions = {},
): TeachingTapeReplay {
  const resolve = options.resolve ?? resolveTeachingTape;
  const experimentId = binding.environment.experimentId;
  let tape: TapeV2 | null;
  try {
    tape = resolve(tapeId);
  } catch (err: unknown) {
    return {
      kind: "refused",
      tapeId,
      experimentId,
      refusalCode: "teaching-tape-resolution-failed",
      notice: `Walkthrough ${tapeId} could not be loaded: ${String(err)}`,
    };
  }
  if (!tape)
    return {
      kind: "unknown-walkthrough",
      tapeId,
      notice: `No published walkthrough is called ${tapeId}.`,
    };
  if (tape.experimentId !== experimentId)
    return {
      kind: "not-this-laboratory",
      tapeId,
      experimentId,
      recordedFor: tape.experimentId,
      notice: `${tapeId} was recorded on ${tape.experimentId} and cannot be played on ${experimentId}.`,
    };
  if (
    options.stepIndex !== undefined &&
    (!Number.isSafeInteger(options.stepIndex) || options.stepIndex < 0)
  ) {
    return {
      kind: "refused",
      tapeId,
      experimentId,
      refusalCode: "teaching-tape-step-invalid",
      notice: `Walkthrough ${tapeId} has no step ${String(options.stepIndex)}. Choose a recorded whole-number step.`,
    };
  }
  /*
   * WHERE A REPLAY STOPS BY DEFAULT: at the state the tape's accepted checkpoint names, not at the
   * last event. The two are not always the same, and when they differ the verification cannot pass.
   * lq-05-journey-stage-e records one event at actionIndex 1 and its only checkpoint at actionIndex
   * 0, the state BEFORE that event; replaying to the last event reached a state no checkpoint in the
   * record describes, and it refused with tape-checkpoint-mismatch while every digest in the file was
   * correct. A caller that wants a particular step still names it.
   */
  const accepted = tape.acceptedCheckpoint.acceptedActionIndex;
  const upToCheckpoint = tape.events.filter((event) => event.actionIndex <= accepted).length - 1;
  const stepIndex = Math.min(options.stepIndex ?? upToCheckpoint, tape.events.length - 1);
  /*
   * A checkpoint taken before the first event asks for the initial conditions and nothing else.
   * `teachingTapeRef.stepIndex` cannot say that, because the schema requires a non-negative integer
   * and slice(0, 0 + 1) would apply one event, so that case drops the ref and empties the events
   * rather than passing a stepIndex the schema forbids. The resolver still ran: this function
   * resolved the record itself, above.
   */
  const request: TapeV2 =
    stepIndex >= 0
      ? { ...tape, teachingTapeRef: { tapeId, stepIndex } }
      : { ...withoutTeachingRef(tape), events: [] };
  // Pin the record resolved above. A second catalogue lookup could otherwise replay a different
  // record from the one whose experiment, endpoint and checkpoint were just inspected.
  const resolved = tape;
  const result = replayTapeOnSession(
    binding,
    session,
    request,
    options.asNewRun ? { forceNewRun: true } : undefined,
    (id) => (id === tapeId ? resolved : null),
  );
  if (result.kind === "success")
    return {
      kind: "replayed",
      tapeId,
      experimentId,
      runId: result.runId,
      isNewRun: result.isNewRun,
      executedEventCount: result.executedEventCount,
      acceptedCheckpoint: result.acceptedCheckpoint,
      state: result.state,
    };
  if (result.kind === "refusal")
    return {
      kind: "refused",
      tapeId,
      experimentId,
      refusalCode: result.refusalCode,
      notice: result.notice,
      repair: result.repair,
    };
  // Keep the public checkpoint refusal code when preflight discovers the mismatch before applying
  // anything. Other invalid requests still retain their distinct repairable reason.
  const checkpointMismatch =
    result.kind === "invariant-violation" || result.reason === "tape-checkpoint-action-unreachable";
  return {
    kind: "refused",
    tapeId,
    experimentId,
    refusalCode: checkpointMismatch
      ? "tape-checkpoint-mismatch"
      : result.kind === "invalid" ? result.reason : "tape-checkpoint-mismatch",
    notice: result.notice,
  };
}
