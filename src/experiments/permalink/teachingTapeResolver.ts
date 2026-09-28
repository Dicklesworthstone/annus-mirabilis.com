/**
 * A REAL `resolveTeachingTape`, BACKED BY THE AUTHORED RECORDS (am-2rl9).
 *
 * `replayTape` has always been able to replay a walkthrough: a permalink tape may carry a
 * `teachingTapeRef`, and the replayer resolves it through `runner.resolveTeachingTape`. Until now
 * the only implementation of that hook was `fixture.ts`, which returns one hard-coded tape, so no
 * authored walkthrough could be replayed and a reader had to copy values by hand.
 *
 * This is the hook over the real corpus. The map is injected rather than read here, because this
 * module runs wherever an instrument runs and the records are YAML on disk; `loadWireTeachingTapes`
 * in src/content/teachingTapes.ts builds the map from them.
 *
 * TWO THINGS CALLED A STEP, AND THEY ARE OFF BY ONE FROM EACH OTHER. This is the trap the whole
 * file exists to name, and it was found by replaying against the authored digests rather than by
 * reading either definition.
 *
 *   A control-tape record's `checkpoints[i].stepIndex` is a CHECKPOINT index: checkpoint N is the
 *   state after N events. Measured on the-two-pulses: checkpoint 0 is the opening state with no
 *   event applied, and checkpoints 1 and 2 are reached after one and two events.
 *
 *   A permalink tape's `teachingTapeRef.stepIndex` is the INCLUSIVE INDEX OF THE LAST EVENT TO
 *   APPLY: the replayer slices `events.slice(0, stepIndex + 1)`, so stepIndex 1 applies two events.
 *   `permalink.replay.test.ts` pins that meaning, so the replayer is not wrong and must not be
 *   "fixed"; the translation belongs here.
 *
 * Using one where the other is meant lands the instrument one event past the state the walkthrough
 * names, which is a wrong state under a right label — and it is invisible without a digest to
 * compare against. Replaying the-two-pulses with the indices confused reproduced checkpoint N+1's
 * digest at every N, three times over.
 */

import type { TapeV2 } from "./types.ts";

/** The hook shape `ReplayRunner.resolveTeachingTape` declares. */
export type TeachingTapeResolver = (tapeId: string) => TapeV2 | null;

/**
 * The hook over a map of authored walkthroughs, keyed by tape id. Unknown ids return null, which is
 * what the replayer expects: it then replays the permalink tape's own conditions and events rather
 * than failing, so a link to a retired walkthrough still opens the instrument.
 */
export function createTeachingTapeResolver(
  tapes: ReadonlyMap<string, TapeV2>,
): TeachingTapeResolver {
  return (tapeId: string) => tapes.get(tapeId) ?? null;
}

/**
 * The `teachingTapeRef.stepIndex` that reaches a record's checkpoint N, or null when the checkpoint
 * cannot be addressed by a reference at all.
 *
 * Checkpoint 0 returns NULL rather than a number. It is the state after zero events, which would
 * need `stepIndex: -1`, and the schema requires a non-negative integer
 * (`teachingTapeRef.stepIndex must be a non-negative integer`). A walkthrough's opening state is
 * therefore not addressable through a teaching reference; it is what the permalink tape's own
 * `initialConditions` already carry, which is how the generated `/lab/<id>/?tape=` links work.
 */
export function teachingStepIndexForCheckpoint(checkpointIndex: number): number | null {
  if (!Number.isInteger(checkpointIndex) || checkpointIndex < 0) return null;
  return checkpointIndex === 0 ? null : checkpointIndex - 1;
}
