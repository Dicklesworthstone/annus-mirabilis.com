import type { TapeV2 } from "./types.ts";
import type { CheckpointWalkthrough } from "./walkthroughCheckpoints.ts";

/** A reader-authored sequence of accepted settings, not a recording of animation or measurements. */
export const RECORDING_FORMAT = "annus-mirabilis-experiment";
export const RECORDING_LIMITS = Object.freeze({
  bytes: 1024 * 1024,
  stops: 64,
  title: 160,
  label: 160,
  note: 2000,
});
export type RecordedStop = Readonly<{ id: string; label: string; note: string; tape: TapeV2 }>;
export type RecordedExperiment = Readonly<{
  format: typeof RECORDING_FORMAT;
  version: 1;
  experimentId: string;
  title: string;
  stops: readonly RecordedStop[];
}>;
export type RecordingResult<T> =
  | Readonly<{ kind: "accepted"; value: T }>
  | Readonly<{ kind: "refused"; notice: string }>;

/** The wire schema stays the owner of tape admission. The browser supplies validateTapeV2. */
export type AdmitRecordingTape = (raw: unknown, path: string) => TapeV2;
const refuse = (notice: string): RecordingResult<never> => ({ kind: "refused", notice });
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number, empty = false): value is string =>
  typeof value === "string" && value.length <= max && (empty || value.trim().length > 0);
const keysAre = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

/** Bounded traversal before a tape validator sees imported data; no executable/prototype keys. */
function safeData(value: unknown): boolean {
  const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const current = pending.pop();
    if (!current || ++visited > 50000 || current.depth > 24) return false;
    if (typeof current.value === "number" && !Number.isFinite(current.value)) return false;
    if (current.value && typeof current.value === "object") {
      for (const [key, child] of Object.entries(current.value)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") return false;
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }
  return true;
}

/** Freeze detached JSON data, including nested tape settings and identity records. */
function freezeData<T>(value: T): T {
  const pending: unknown[] = [value];
  while (pending.length) {
    const current = pending.pop();
    if (current && typeof current === "object" && !Object.isFrozen(current)) {
      pending.push(...Object.values(current));
      Object.freeze(current);
    }
  }
  return value;
}

/**
 * Import is all-or-nothing and NEVER applies a stop. Each stop carries its original model identity
 * and checkpoint. Compatibility and digest verification happen later in the laboratory's restore.
 * Version one holds independent settings snapshots: it cannot pretend to record timing, random
 * trajectories, or a sequence of control events that was never observed.
 */
export function readRecordedExperiment(
  source: string,
  experimentId: string,
  admit: AdmitRecordingTape,
): RecordingResult<RecordedExperiment> {
  if (source.length > RECORDING_LIMITS.bytes ||
    new TextEncoder().encode(source).byteLength > RECORDING_LIMITS.bytes)
    return refuse("This recording exceeds the one-megabyte limit. The current recording is unchanged.");
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return refuse("This file is not valid JSON. The current recording is unchanged.");
  }
  if (!safeData(raw)) return refuse("The recording contains unsupported or excessively nested data.");
  if (!isObject(raw) || !keysAre(raw, ["format", "version", "experimentId", "title", "stops"]) ||
    raw.format !== RECORDING_FORMAT || raw.version !== 1)
    return refuse("This is not a supported Annus Mirabilis experiment recording (version 1).");
  if (raw.experimentId !== experimentId)
    return refuse("This recording belongs to a different laboratory. Open it in the laboratory where it was made.");
  if (!text(raw.title, RECORDING_LIMITS.title)) return refuse("Give the recording a short, nonempty title.");
  if (!Array.isArray(raw.stops) || raw.stops.length === 0 || raw.stops.length > RECORDING_LIMITS.stops)
    return refuse(`A recording must contain between 1 and ${RECORDING_LIMITS.stops} saved stops.`);
  const stops: RecordedStop[] = [];
  const ids = new Set<string>();
  for (const [index, stop] of raw.stops.entries()) {
    if (!isObject(stop) || !keysAre(stop, ["id", "label", "note", "tape"]) ||
      !text(stop.id, 80) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(stop.id) || ids.has(stop.id) ||
      !text(stop.label, RECORDING_LIMITS.label) || !text(stop.note, RECORDING_LIMITS.note, true))
      return refuse(`Saved stop ${index + 1} needs a short label and a note of at most ${RECORDING_LIMITS.note} characters.`);
    ids.add(stop.id);
    try {
      const tape = admit(stop.tape, `recording.stops[${index}].tape`);
      if (tape.experimentId !== experimentId) return refuse(`Saved stop ${index + 1} belongs to another laboratory.`);
      if (tape.events.length !== 0 || tape.teachingTapeRef || tape.acceptedCheckpoint.acceptedActionIndex !== 0)
        return refuse(`Saved stop ${index + 1} is not a self-contained settings snapshot.`);
      // An admission function may return nested references. Never retain an importer's mutable data.
      const detached: TapeV2 = JSON.parse(JSON.stringify(tape));
      if (!safeData(detached)) return refuse(`Saved stop ${index + 1} contains unsupported data.`);
      stops.push({ id: stop.id, label: stop.label, note: stop.note, tape: detached });
    } catch {
      return refuse(`Saved stop ${index + 1} has an invalid experiment tape. No stops have been imported.`);
    }
  }
  return { kind: "accepted", value: freezeData({
    format: RECORDING_FORMAT, version: 1, experimentId, title: raw.title, stops,
  }) };
}

/** Capture ONLY the accepted-state tape supplied by the lab, never draft form values. */
export function captureRecordedStop(
  previous: RecordedExperiment | null,
  tape: TapeV2,
  title: string,
  label: string,
  note: string,
  admit: AdmitRecordingTape,
): RecordingResult<RecordedExperiment> {
  if (previous && previous.experimentId !== tape.experimentId)
    return refuse("Start a separate recording for this laboratory; the existing recording is unchanged.");
  if (previous && previous.stops.length >= RECORDING_LIMITS.stops)
    return refuse(`The ${RECORDING_LIMITS.stops}-stop limit has been reached. Download this recording before starting another.`);
  const ids = new Set(previous?.stops.map((stop) => stop.id) ?? []);
  let nextId = (previous?.stops.length ?? 0) + 1;
  while (ids.has(`stop-${nextId}`)) ++nextId;
  try {
    return readRecordedExperiment(JSON.stringify({
      format: RECORDING_FORMAT,
      version: 1,
      experimentId: tape.experimentId,
      title,
      stops: [...(previous?.stops ?? []), { id: `stop-${nextId}`, label, note, tape }],
    }), tape.experimentId, admit);
  } catch {
    return refuse("The accepted settings could not be saved. The existing recording is unchanged.");
  }
}

/** Export the same validated, bounded format that import accepts, without adding clocks or telemetry. */
export function writeRecordedExperiment(
  recording: RecordedExperiment,
  admit: AdmitRecordingTape,
): RecordingResult<string> {
  try {
    const source = JSON.stringify(recording);
    const checked = readRecordedExperiment(source, recording.experimentId, admit);
    return checked.kind === "accepted"
      ? { kind: "accepted", value: JSON.stringify(checked.value) }
      : checked;
  } catch {
    return refuse("The recording could not be exported. It remains available on this page.");
  }
}

/** Reuse the checkpoint action adapters; they retain the distinction between replay and form loading. */
export function recordedExperimentWalkthrough(recording: RecordedExperiment): CheckpointWalkthrough {
  return {
    tapeId: `personal-${recording.experimentId}`,
    experimentId: recording.experimentId,
    title: recording.title,
    checkpoints: recording.stops.map((stop) => ({
      actionIndex: stop.tape.acceptedCheckpoint.acceptedActionIndex,
      label: stop.label,
      teachingNote: stop.note,
      settings: stop.tape.initialConditions,
      tape: stop.tape,
    })),
  };
}
