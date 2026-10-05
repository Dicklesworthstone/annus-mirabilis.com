import type { ControlTapeV2 } from "../tapes/schema.ts";
import type { TapeV2 } from "./types.ts";

/** A recorded stop, not a recomputed or invented checkpoint (am-rt-control-tapes-0gc). */
export type WalkthroughCheckpoint = Readonly<{
  actionIndex: number;
  label: string;
  teachingNote?: string | undefined;
  /** Canonical settings at this stop. Loading these into a form is NOT a verified replay. */
  settings: Readonly<Record<string, number | string>>;
  /** Self-contained replay request. Null when the authored checkpoint cannot cross the wire. */
  tape: TapeV2 | null;
  unavailable?: string | undefined;
}>;

export type CheckpointWalkthrough = Readonly<{
  tapeId: string;
  experimentId: string;
  title: string;
  description?: string | undefined;
  checkpoints: readonly WalkthroughCheckpoint[];
}>;

export type WalkthroughCatalogue = Readonly<{
  walkthroughs: readonly CheckpointWalkthrough[];
  problems: readonly string[];
}>;

export type CheckpointPrefix = Readonly<{
  record: ControlTapeV2;
  actionIndex: number;
  label: string;
  teachingNote?: string | undefined;
  settings: Readonly<Record<string, number | string>>;
}>;

/**
 * Recover each authored stop from the opening state, including when seeking backwards. A stop
 * keeps its OWN digest and only the events at or before it; it never borrows the final digest.
 * Predictions stay in the prefix for the converter, but are not treated as parameter changes.
 * Action indices need not be consecutive and several controls may share an action index.
 */
export function checkpointPrefixes(record: ControlTapeV2): readonly CheckpointPrefix[] {
  return record.checkpoints.map((checkpoint) => {
    const events = record.events.filter((event) => event.actionIndex <= checkpoint.actionIndex);
    const settings: Record<string, number | string> = { ...record.initialConditions };
    for (const event of events) {
      if (event.kind === "control") settings[event.parameterId] = event.value;
    }
    return {
      record: { ...record, events, checkpoints: [checkpoint] },
      actionIndex: checkpoint.actionIndex,
      label: checkpoint.label || `Checkpoint at action ${checkpoint.actionIndex}`,
      ...(checkpoint.teachingNote ? { teachingNote: checkpoint.teachingNote } : {}),
      settings,
    };
  });
}

/** A bad selector must not silently run the final stop or reset to the opening state. */
export function checkpointAt(
  walkthrough: CheckpointWalkthrough,
  index: number,
): WalkthroughCheckpoint | null {
  return Number.isInteger(index) && index >= 0 ? (walkthrough.checkpoints[index] ?? null) : null;
}
