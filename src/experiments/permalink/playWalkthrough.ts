import { replayTeachingTapeOn, type TeachingTapeReplayOptions } from "./replayTeachingTape.ts";
import type { LabTapeBinding, TapeSession } from "./sessionTape.ts";

/*
 * WHAT A READER GETS WHEN THEY PRESS PLAY ON A RECORDED WALKTHROUGH (am-2rl9).
 *
 * `replayTeachingTapeOn` is the join and speaks in outcomes and refusal codes. This turns one of
 * those into a sentence a reader can act on, and it is a separate function from the component so the
 * reader's path can be tested a layer below the click: what the button does is this, and the button
 * is the two lines that call it.
 *
 * WHAT IT DOES NOT TOUCH. It applies the record's initial conditions and its events to the
 * laboratory's own session, and reads nothing else back. The execution label is the laboratory's,
 * computed from the snapshot the replay produced, so a record's `modelIdentity` cannot earn a label
 * here: AGENTS.md's rule is that a replayed snapshot is labelled by whoever computed it, never
 * "FrankenSim" because a tape said so, and the only way to honour that is for this path to have no
 * opinion about labels at all. It has none.
 *
 * A REFUSAL IS THE READER'S TOO. Four of the twelve convertible walkthroughs refuse on identity by
 * design, because their record and their laboratory disagree about the constant set or the stream
 * allocation, and those are differences about the world rather than about vocabulary. The notice and
 * the repair come from `checkTapeCompatibility`, which already writes them for a reader, so they are
 * passed through rather than reworded here.
 */

export type WalkthroughPlay =
  | Readonly<{
      kind: "played";
      tapeId: string;
      /** One sentence: what was applied. The laboratory adds what the numbers now say. */
      notice: string;
      steps: number;
      /** True means the recorded identity and checkpoint were deliberately not verified. */
      isNewRun: boolean;
      parameters: Readonly<Record<string, number | string>>;
    }>
  | Readonly<{
      kind: "refused";
      tapeId: string;
      notice: string;
      /** What it would take, when the refusal knows. */
      repair?: string | undefined;
      code: string;
    }>;

const STEPS = (count: number) =>
  count === 0 ? "its opening settings" : count === 1 ? "one step" : `${count} steps`;

export function playWalkthrough(
  binding: LabTapeBinding,
  session: TapeSession,
  tapeId: string,
  options: TeachingTapeReplayOptions = {},
): WalkthroughPlay {
  const result = replayTeachingTapeOn(binding, session, tapeId, options);
  switch (result.kind) {
    case "replayed":
      return {
        kind: "played",
        tapeId,
        steps: result.executedEventCount,
        isNewRun: result.isNewRun,
        parameters: result.state,
        notice: result.isNewRun
          ? `An explicitly new run is in the laboratory: ${STEPS(result.executedEventCount)} applied using the current model. The recorded identity and checkpoint were not verified; this is not a reproduced recorded result.`
          : `The recorded walkthrough is in the laboratory: ${STEPS(result.executedEventCount)} applied, and the numbers below are this laboratory's own.`,
      };
    case "unknown-walkthrough":
      return {
        kind: "refused",
        tapeId,
        code: "unknown-walkthrough",
        notice: result.notice,
      };
    case "not-this-laboratory":
      return {
        kind: "refused",
        tapeId,
        code: "not-this-laboratory",
        notice: result.notice,
      };
    default:
      return {
        kind: "refused",
        tapeId,
        code: result.refusalCode,
        notice: result.notice,
        repair: result.repair,
      };
  }
}
