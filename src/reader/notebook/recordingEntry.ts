import { tapePayloadBytes } from "../../experiments/permalink/codecCore.ts";
import {
  readRecordedExperiment,
  RECORDING_LIMITS,
  type RecordedExperiment,
  type RecordedStop,
} from "../../experiments/permalink/recordedExperiments.ts";
import { validateTapeV2 } from "../../experiments/permalink/schema.ts";

const laboratories = Object.freeze({
  "bm-01": Object.freeze({
    experimentId: "bm-01",
    paper: "brownian-motion",
    anchor: "arg-bm-observable",
    title: "Brownian tracer",
    href: "/lab/bm-01/",
  } as const),
  "bm-05": Object.freeze({
    experimentId: "bm-05",
    paper: "brownian-motion",
    anchor: "arg-bm-independent-steps",
    title: "Random walks",
    href: "/lab/bm-05/",
  } as const),
});

export type NotebookRecordingExperiment = keyof typeof laboratories;
export function recordingLaboratory(experimentId: string) {
  return Object.hasOwn(laboratories, experimentId)
    ? laboratories[experimentId as NotebookRecordingExperiment]
    : null;
}

/**
 * Stored tapes use the existing lossless wire representation. They must pass through
 * openNotebookRecording before a recorder or worker receives expanded, owner-validated tapes.
 */
export type NotebookRecordedStop = Omit<RecordedStop, "tape"> &
  Readonly<{ tape: Readonly<Record<string, unknown>> }>;
export type NotebookRecording = Omit<RecordedExperiment, "experimentId" | "stops"> &
  Readonly<{
    experimentId: NotebookRecordingExperiment;
    stops: readonly NotebookRecordedStop[];
  }>;

export class NotebookRecordingError extends TypeError {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "NotebookRecordingError";
    this.code = code;
  }
}

const MAX_NODES = 50_000;
const MAX_DEPTH = 24;

/** Inspect descriptors before serialization: imported objects may not run getters or toJSON. */
function assertPlainData(input: unknown): void {
  let nodes = 0;
  let characters = 0;
  const ancestors = new Set<object>();
  function visit(value: unknown, depth: number): void {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH)
      throw new NotebookRecordingError(
        "notebook-recording-complexity",
        "This recording contains too much nested data.",
      );
    if (typeof value === "string") {
      characters += value.length;
      if (characters > RECORDING_LIMITS.bytes)
        throw new NotebookRecordingError(
          "notebook-recording-text-size",
          "This recording exceeds the 1 MiB size limit.",
        );
      return;
    }
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (typeof value !== "object")
      throw new NotebookRecordingError(
        "notebook-recording-json-value",
        "A recording must contain plain finite JSON data.",
      );
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype))
      throw new NotebookRecordingError(
        "notebook-recording-prototype",
        "A recording must contain plain JSON records and arrays.",
      );
    if (ancestors.has(value))
      throw new NotebookRecordingError(
        "notebook-recording-cycle",
        "A recording cannot contain cyclic data.",
      );
    ancestors.add(value);
    const keys = Reflect.ownKeys(value);
    if (array && keys.length !== value.length + 1)
      throw new NotebookRecordingError(
        "notebook-recording-array",
        "Recording arrays must be complete and have no additional fields.",
      );
    for (const key of keys) {
      if (array && key === "length") continue;
      if (
        typeof key !== "string" ||
        ["__proto__", "prototype", "constructor"].includes(key) ||
        (array && !/^(0|[1-9][0-9]*)$/.test(key))
      )
        throw new NotebookRecordingError(
          "notebook-recording-field",
          "This recording contains an unsupported JSON field.",
        );
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value"))
        throw new NotebookRecordingError(
          "notebook-recording-accessor",
          "A recording cannot contain accessors.",
        );
      characters += key.length;
      if (characters > RECORDING_LIMITS.bytes)
        throw new NotebookRecordingError(
          "notebook-recording-key-size",
          "This recording exceeds the 1 MiB size limit.",
        );
      visit(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
  }
  visit(input, 0);
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/** Call only after descriptor admission; this bounds expansion without allocating positions. */
function recordingExpansionFits(raw: unknown, wireBytes: number): boolean {
  const maxPositions = 30_000; // The tape owner's existing per-checkpoint bound.
  const maxU64 = (1n << 64n) - 1n;
  const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const u64 = (value: unknown): bigint | null => {
    if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,19})$/.test(value)) return null;
    const parsed = BigInt(value);
    return parsed <= maxU64 ? parsed : null;
  };
  if (!object(raw) || !Array.isArray(raw.stops)) return true;
  let estimatedBytes = wireBytes;
  let requiredArrayBytes = 0;
  for (const stop of raw.stops) {
    if (!object(stop) || !object(stop.tape) || !object(stop.tape.acceptedCheckpoint)) continue;
    const state = stop.tape.acceptedCheckpoint.scientificState;
    if (!object(state) || !Object.hasOwn(state, "streamPositionRanges")) continue;
    const ranges = state.streamPositionRanges;
    if (!Array.isArray(ranges) || ranges.length > maxPositions) return false;
    let positions = 0;
    let expandedArrayBytes = 2;
    for (const range of ranges) {
      if (!object(range)) return false;
      const firstTile = u64(range.firstTile);
      if (
        firstTile === null || u64(range.index) === null ||
        typeof range.allocationId !== "string" || typeof range.streamKernelId !== "string" ||
        typeof range.count !== "number" || !Number.isSafeInteger(range.count) ||
        range.count < 1 || range.count > maxPositions ||
        firstTile + BigInt(range.count - 1) > maxU64
      ) return false;
      positions += range.count;
      if (positions > maxPositions) return false;
      const positionBytes = jsonBytes({
        allocationId: range.allocationId,
        streamKernelId: range.streamKernelId,
        tile: range.firstTile,
        index: range.index,
      });
      expandedArrayBytes += range.count * positionBytes;
    }
    expandedArrayBytes += Math.max(0, positions - 1);
    requiredArrayBytes += expandedArrayBytes;
    if (requiredArrayBytes > RECORDING_LIMITS.bytes) return false;
    // First-tile digits are a lower bound. Owner admission below checks the exact expanded size.
    estimatedBytes += expandedArrayBytes - jsonBytes(ranges) +
      jsonBytes("streamPositions") - jsonBytes("streamPositionRanges");
  }
  return estimatedBytes <= RECORDING_LIMITS.bytes;
}

/**
 * Bounded JSON admission shared by notebook parsing and explicit opening. It does not compute
 * or restore any experiment. The recording owner below remains responsible for tape semantics.
 */
export function notebookRecordingSource(input: unknown): string {
  assertPlainData(input);
  const source = JSON.stringify(input);
  const bytes = new TextEncoder().encode(source).length;
  if (bytes > RECORDING_LIMITS.bytes)
    throw new NotebookRecordingError(
      "notebook-recording-byte-size",
      "This recording exceeds the 1 MiB size limit.",
    );
  if (!recordingExpansionFits(input, bytes))
    throw new NotebookRecordingError(
      "notebook-recording-stream-ranges",
      "This recording contains invalid or oversized scientific stream ranges.",
    );
  return source;
}

function admitRecording(input: unknown, paper?: string): RecordedExperiment {
  const source = notebookRecordingSource(input);
  const experimentId = input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>).experimentId
    : undefined;
  const laboratory = typeof experimentId === "string" ? recordingLaboratory(experimentId) : null;
  if (!laboratory)
    throw new NotebookRecordingError(
      "notebook-recording-instrument",
      "Notebook recordings currently support the Brownian tracer and random-walk laboratories.",
    );
  if (paper !== undefined && paper !== laboratory.paper)
    throw new NotebookRecordingError(
      "notebook-recording-paper",
      "This recording belongs to the paper declared by its laboratory.",
    );
  const admitted = readRecordedExperiment(source, laboratory.experimentId, validateTapeV2);
  if (admitted.kind !== "accepted")
    throw new NotebookRecordingError(
      "notebook-recording-envelope",
      admitted.notice,
    );
  // Expanded stops must also remain admissible to the recorder's normal capture/export path.
  notebookRecordingSource(admitted.value);
  return admitted.value;
}

function freezeData<T>(input: T): T {
  if (input && typeof input === "object") {
    for (const value of Object.values(input)) freezeData(value);
    Object.freeze(input);
  }
  return input;
}

/** Retain complete private recordings using the tape owner's lossless range compaction. */
export function parseNotebookRecording(input: unknown, paper?: string): NotebookRecording {
  const admitted = admitRecording(input, paper);
  return Object.freeze({
    ...admitted,
    experimentId: admitted.experimentId as NotebookRecordingExperiment,
    stops: Object.freeze(
      admitted.stops.map((stop) =>
        Object.freeze({
          ...stop,
          tape: freezeData(
            JSON.parse(new TextDecoder().decode(tapePayloadBytes(stop.tape))) as Record<string, unknown>,
          ),
        }),
      ),
    ),
  });
}

/** Explicit local opening validates the whole recording; it never starts replay or a worker. */
export function openNotebookRecording(recording: NotebookRecording): RecordedExperiment {
  return admitRecording(recording);
}
