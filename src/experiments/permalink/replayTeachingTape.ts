import { type ReplayRunner, replayTape } from "./replay.ts";
import { createSessionReplayRunner, type LabTapeBinding, type TapeSession } from "./sessionTape.ts";
import { resolveTeachingTape } from "./teachingTapeCatalogue.ts";
import type { TapeAcceptedCheckpoint, TapeV2 } from "./types.ts";

/*
 * THE JOIN BETWEEN AN AUTHORED WALKTHROUGH AND A LABORATORY THAT CAN RUN IT (am-2rl9).
 *
 * Both halves existed and nothing called them together. `resolveTeachingTape` is a real resolver
 * over the generated catalogue of authored records, and `createSessionReplayRunner` is a real
 * ReplayRunner over a live laboratory session; until this, the only caller that held both at once
 * was a test fixture. This is the function a laboratory calls to play a named walkthrough.
 *
 * WHAT IT DOES NOT DO, MEASURED 2026-09-28 AND STATED HERE BECAUSE THE SHAPE OF THE RESULT DEPENDS
 * ON IT. No authored record replays on its laboratory today, and the reasons are in the records
 * rather than in this path:
 *
 *   - identity. All 22 records declare `streamVersion: 1`; 24 of the 28 laboratory bindings declare
 *     `streamVersion: "deterministic"`, the sentinel for a laboratory that draws nothing. Checked
 *     against the real bindings, 12 of the 12 convertible walkthroughs refuse before a single event
 *     is applied: 8 on `tape-stream-version-mismatch`, 3 on `tape-constant-set-mismatch`, 1 on
 *     `tape-allocation-mismatch`.
 *   - the checkpoint. Six of the seven walkthroughs whose laboratory has a live session carry a
 *     placeholder digest of one repeated digit (`host:sha256:2222…` and its siblings). The seventh,
 *     the-two-pulses, carries `host:15a92e1cf64617f2`, which matches no digest this codebase
 *     computes: not over the replayed state and not over the record's own state, at any of the four
 *     action indices, in any of the three digest forms.
 *
 * So the refusals below are reported rather than hidden, and `asNewRun` exists for the caller that
 * means it: it is the replayer's `forceNewRun`, which skips BOTH the identity check and the
 * checkpoint verification and returns a run marked new. It is not a way to make a refusal go away,
 * and a caller that passes it says so to the reader.
 *
 * WHAT THIS PATH DOES HONOUR, demonstrated in replayTeachingTape.test.ts rather than asserted here:
 * replaying twice reaches the same state and the same checkpoint digest; and an `observer-change`
 * event re-describes rather than restarts, keeping the accepted run id while the setup-changes
 * before it each start a new one. Execution labels are untouched: this applies parameters to a
 * laboratory and never says what computed the result, so a snapshot stays labelled by whoever
 * computed it and a record's `modelIdentity` cannot earn a label here.
 */

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
   * step at a time. The default is the whole walkthrough.
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
  const tape = resolve(tapeId);
  const experimentId = binding.environment.experimentId;
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
  const runner: ReplayRunner = {
    ...createSessionReplayRunner(binding, session),
    resolveTeachingTape: resolve,
  };
  const last = Math.max(0, tape.events.length - 1);
  const stepIndex = Math.min(Math.max(0, options.stepIndex ?? last), last);
  const request: TapeV2 = { ...tape, teachingTapeRef: { tapeId, stepIndex } };
  const result = replayTape(request, runner, options.asNewRun ? { forceNewRun: true } : undefined);
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
  // An invalid replay and a violated checkpoint are refusals too, as far as a reader is concerned,
  // and each carries the code that says which: nothing here is reported as a success.
  return {
    kind: "refused",
    tapeId,
    experimentId,
    refusalCode: result.kind === "invariant-violation" ? "tape-checkpoint-mismatch" : result.reason,
    notice: result.notice,
  };
}
