import { type ReplayOptions, type ReplayRunner, replayTape } from "./replay.ts";
import type { TapeControlEvent, TapeReplayResult, TapeV2 } from "./types.ts";

export type PreparedReplay =
  | Readonly<{
      kind: "prepared";
      tape: TapeV2;
      /** This must remain explicit when the prepared tape is applied to the live session. */
      isNewRun: boolean;
    }>
  | Exclude<TapeReplayResult, { kind: "success" }>;

/**
 * Rehearse a replay on an ISOLATED runner before touching a reader's accepted run. Capture exactly
 * the settings and controls the replayer used, so a teaching reference is resolved once and cannot
 * change between rehearsal and application. No checkpoint is invented to make a replay pass.
 */
export function prepareTapeReplay(
  tape: TapeV2,
  trial: ReplayRunner,
  options?: ReplayOptions,
): PreparedReplay {
  let initialConditions: Record<string, number | string> = {};
  const events: TapeControlEvent[] = [];
  const result = replayTape(
    tape,
    {
      environment: trial.environment,
      ...(trial.resolveTeachingTape
        ? { resolveTeachingTape: (id: string) => trial.resolveTeachingTape?.(id) ?? null }
        : {}),
      applyInitialConditions(conditions) {
        initialConditions = { ...conditions };
        trial.applyInitialConditions({ ...conditions });
      },
      applyEvent(event) {
        const captured = Object.freeze({ ...event });
        events.push(captured);
        trial.applyEvent(captured);
      },
      getAcceptedCheckpoint: () => trial.getAcceptedCheckpoint(),
      getCurrentState: () => trial.getCurrentState(),
    },
    options,
  );
  if (result.kind !== "success") return result;
  const { teachingTapeRef: _ref, ...inline } = tape;
  return {
    kind: "prepared",
    isNewRun: result.isNewRun,
    tape: Object.freeze({
      ...inline,
      modelIdentity: Object.freeze({ ...tape.modelIdentity }),
      ...(tape.replayGrid ? { replayGrid: Object.freeze({ ...tape.replayGrid }) } : {}),
      initialConditions: Object.freeze(initialConditions),
      events: Object.freeze(events),
      acceptedCheckpoint: Object.freeze({ ...tape.acceptedCheckpoint }),
    }),
  };
}
