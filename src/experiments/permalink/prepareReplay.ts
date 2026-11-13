import { type ReplayOptions, type ReplayRunner, replayTape } from "./replay.ts";
import { validateTapeV2 } from "./schema.ts";
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
  let predictions: TapeV2["predictions"];
  try {
    // Walkthrough callers do not pass through the URL decoder. Validate and copy their
    // predictions before any rehearsal or live apply can change the supplied record.
    if (tape.predictions !== undefined) {
      predictions = Object.freeze(validateTapeV2(tape).predictions ?? []);
    }
  } catch (error) {
    return {
      kind: "invalid",
      reason: "tape-predictions-invalid",
      notice: `The recorded predictions could not be read: ${String(error)}`,
    };
  }
  let initialConditions: Record<string, number | string> = {};
  const events: TapeControlEvent[] = [];
  const result = replayTape(
    tape,
    {
      environment: trial.environment,
      ...(trial.environmentForReplay
        ? {
            environmentForReplay: (
              conditions: Readonly<Record<string, number | string>>,
              events: readonly TapeControlEvent[],
            ) => trial.environmentForReplay?.(conditions, events) ?? trial.environment,
          }
        : {}),
      ...(trial.getAcceptedRunId
        ? { getAcceptedRunId: () => trial.getAcceptedRunId?.() ?? null }
        : {}),
      ...(trial.resolveTeachingTape
        ? { resolveTeachingTape: (id: string) => trial.resolveTeachingTape?.(id) ?? null }
        : {}),
      applyInitialConditions(conditions) {
        initialConditions = { ...conditions };
        trial.applyInitialConditions({ ...conditions });
      },
      ...(trial.startNewRun
        ? {
            startNewRun(conditions: Record<string, number | string>) {
              initialConditions = { ...conditions };
              trial.startNewRun?.({ ...conditions });
            },
          }
        : {}),
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
  const { teachingTapeRef: _ref, predictions: _predictions, ...inline } = tape;
  return {
    kind: "prepared",
    isNewRun: result.isNewRun,
    tape: Object.freeze({
      ...inline,
      ...(predictions ? { predictions } : {}),
      modelIdentity: Object.freeze({ ...tape.modelIdentity }),
      ...(tape.replayGrid ? { replayGrid: Object.freeze({ ...tape.replayGrid }) } : {}),
      initialConditions: Object.freeze(initialConditions),
      events: Object.freeze(events),
      acceptedCheckpoint: Object.freeze({ ...tape.acceptedCheckpoint }),
    }),
  };
}
