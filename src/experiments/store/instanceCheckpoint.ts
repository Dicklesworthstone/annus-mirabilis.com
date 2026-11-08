import { parseResult, type Revisions } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import type { AcceptedSnapshot, Parameters, Publication, RunRecord } from "./instanceStore.ts";

/** Transport budgets, never scientific truncation: an oversized checkpoint is unavailable. */
export const MAX_INSTANCE_CHECKPOINT_BYTES = 24 * 1024;
export const MAX_CHECKPOINT_OUTPUTS = 128;
export const MAX_CHECKPOINT_ARRAY_ELEMENTS = 1024;
export const MAX_CHECKPOINT_TOTAL_ARRAY_ELEMENTS = 2048;

export type InstanceCheckpoint = Readonly<{
  checkpointVersion: 1;
  accepted: Omit<AcceptedSnapshot, "outputs"> & Readonly<{ outputs: readonly string[] }>;
  /** The current run's lineage; earlier run records are not an unbounded history archive. */
  run: RunRecord;
}>;

export type InstanceCheckpointRestore =
  | Readonly<{ kind: "restored" }>
  | Readonly<{ kind: "not-restored"; notice: string }>;

/** A malformed or incompatible checkpoint is rejected input, never a scientific output status. */
export class CheckpointValidationError extends TypeError {
  readonly code = "invalid-parameter";
  constructor(message: string) {
    super(message);
    this.name = "CheckpointValidationError";
  }
}

export function rejectCheckpoint(message: string): never {
  throw new CheckpointValidationError(message);
}

const encoder = new TextEncoder();

/** Canonical bounded JSON preserves finite IEEE-754 scalars, including negative zero. */
export function checkpointJson(value: unknown, maxBytes = MAX_INSTANCE_CHECKPOINT_BYTES): string {
  const parts: string[] = [];
  let bytes = 0;
  let nodes = 0;
  const append = (part: string) => {
    if (part.length > maxBytes || bytes + encoder.encode(part).length > maxBytes)
      rejectCheckpoint("The checkpoint exceeds its byte budget.");
    bytes += encoder.encode(part).length;
    parts.push(part);
  };
  function visit(item: unknown, depth: number): void {
    if (++nodes > 8192 || depth > 16) rejectCheckpoint("The checkpoint is too complex.");
    if (item === null) {
      append("null");
      return;
    }
    if (typeof item === "number") {
      if (!Number.isFinite(item)) rejectCheckpoint("Checkpoint numbers must be finite.");
      append(Object.is(item, -0) ? "-0" : String(item));
      return;
    }
    if (typeof item === "string" || typeof item === "boolean") {
      append(JSON.stringify(item));
      return;
    }
    if (Array.isArray(item)) {
      if (item.length > 4096) rejectCheckpoint("The checkpoint has too many entries.");
      append("[");
      for (let i = 0; i < item.length; i++) {
        if (i) append(",");
        visit(item[i], depth + 1);
      }
      append("]");
      return;
    }
    if (
      !item ||
      typeof item !== "object" ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(item))
    )
      rejectCheckpoint("Checkpoints contain plain data only.");
    const keys = Reflect.ownKeys(item);
    if (keys.length > 256 || keys.some((key) => typeof key !== "string"))
      rejectCheckpoint("The checkpoint has too many or invalid fields.");
    append("{");
    for (const [index, key] of (keys as string[]).sort().entries()) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
        rejectCheckpoint("Checkpoint accessors and hidden fields are not data.");
      if (index) append(",");
      append(JSON.stringify(key));
      append(":");
      visit(descriptor.value, depth + 1);
    }
    append("}");
  }
  visit(value, 0);
  return parts.join("");
}

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    rejectCheckpoint("A checkpoint record is missing.");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length || keys.some((key) => !Object.hasOwn(result, key)))
    rejectCheckpoint("A checkpoint has missing or unknown fields.");
  return result;
}
const count = (value: unknown, minimum = 0): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value >= Number.MAX_SAFE_INTEGER
  )
    rejectCheckpoint("A checkpoint counter is invalid or exhausted.");
  return value;
};
const text = (value: unknown, limit = 768): string => {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    rejectCheckpoint("A checkpoint identity is missing or too long.");
  return value;
};
function finiteTime(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    rejectCheckpoint("A checkpoint time is invalid.");
  return value;
}

/** Validate all wire data before allocating typed buffers or changing an owner's counters. */
export function decodeInstanceCheckpoint(input: unknown): Readonly<{
  checkpoint: InstanceCheckpoint;
  publication: Publication;
  snapshotVersion: number;
  runNumber: number;
}> {
  const raw = record(JSON.parse(checkpointJson(input)), ["checkpointVersion", "accepted", "run"]);
  if (raw.checkpointVersion !== 1)
    rejectCheckpoint("The checkpoint schema version is unsupported.");
  const snapshot = record(raw.accepted, [
    "experimentId",
    "instanceId",
    "runId",
    "parentRunId",
    "actionIndex",
    "revisions",
    "parameters",
    "stepIndex",
    "simulationTime",
    "final",
    "snapshotVersion",
    "outputs",
  ]);
  const instanceId = text(snapshot.instanceId, 512);
  const experimentId = text(snapshot.experimentId, 64);
  const runId = text(snapshot.runId);
  const prefix = `${instanceId}/run/`;
  const suffix = runId.startsWith(prefix) ? runId.slice(prefix.length) : "";
  if (!/^[1-9][0-9]*$/.test(suffix))
    rejectCheckpoint("The checkpoint run does not belong to its instance.");
  const runNumber = count(Number(suffix), 1);
  const actionIndex = count(snapshot.actionIndex, 1);
  const snapshotVersion = count(snapshot.snapshotVersion, 1);
  if (runNumber > actionIndex || snapshot.final !== true)
    rejectCheckpoint("Only a complete accepted checkpoint can be restored.");
  const parentRunId = runNumber === 1 ? null : `${instanceId}/run/${runNumber - 1}`;
  if (snapshot.parentRunId !== parentRunId)
    rejectCheckpoint("The checkpoint's run lineage is inconsistent.");
  const revisionRecord = record(snapshot.revisions, [
    "input",
    "observer",
    "measurement",
    "estimator",
  ]);
  const revisions: Revisions = {
    input: count(revisionRecord.input),
    observer: count(revisionRecord.observer),
    measurement: count(revisionRecord.measurement),
    estimator: count(revisionRecord.estimator),
  };
  if (
    revisions.input < runNumber ||
    Object.values(revisions).some((revision) => revision > actionIndex) ||
    Object.values(revisions).reduce((total, revision) => total + revision, 0) > actionIndex
  )
    rejectCheckpoint("The checkpoint's revisions are inconsistent with its actions.");
  const parameters = snapshot.parameters;
  if (
    !parameters ||
    typeof parameters !== "object" ||
    Array.isArray(parameters) ||
    Object.entries(parameters).some(
      ([key, value]) => !key.trim() || !["number", "string", "boolean"].includes(typeof value),
    )
  )
    rejectCheckpoint("The checkpoint parameters must be a scalar record.");
  if (
    !Array.isArray(snapshot.outputs) ||
    snapshot.outputs.length === 0 ||
    snapshot.outputs.length > MAX_CHECKPOINT_OUTPUTS
  )
    rejectCheckpoint("The checkpoint output count is invalid.");
  let elements = 0;
  const outputs: ScientificResult[] = snapshot.outputs.map((encoded) => {
    if (typeof encoded !== "string" || encoded.length > MAX_INSTANCE_CHECKPOINT_BYTES)
      rejectCheckpoint("A checkpoint output could not be read.");
    const wire: unknown = JSON.parse(encoded);
    if (
      wire &&
      typeof wire === "object" &&
      "value" in wire &&
      wire.value &&
      typeof wire.value === "object"
    ) {
      if (
        !("values" in wire.value) ||
        !Array.isArray(wire.value.values) ||
        wire.value.values.length > MAX_CHECKPOINT_ARRAY_ELEMENTS
      )
        rejectCheckpoint("A checkpoint output exceeds its array budget.");
      elements += wire.value.values.length;
      if (elements > MAX_CHECKPOINT_TOTAL_ARRAY_ELEMENTS)
        rejectCheckpoint("The checkpoint exceeds its total array budget.");
    }
    return parseResult(encoded);
  });
  const run = record(raw.run, [
    "runId",
    "parentRunId",
    "forkedAtSimulatedTime",
    "startedAtActionIndex",
  ]);
  if (
    run.runId !== runId ||
    run.parentRunId !== parentRunId ||
    count(run.startedAtActionIndex, runNumber) > actionIndex
  )
    rejectCheckpoint("The checkpoint run record does not match its accepted snapshot.");
  if (run.forkedAtSimulatedTime !== null) finiteTime(run.forkedAtSimulatedTime);
  const publication: Publication = {
    experimentId,
    instanceId,
    runId,
    parentRunId,
    actionIndex,
    revisions,
    parameters: parameters as Parameters,
    stepIndex: count(snapshot.stepIndex),
    simulationTime: finiteTime(snapshot.simulationTime),
    final: true,
    outputs,
  };
  return {
    checkpoint: raw as unknown as InstanceCheckpoint,
    publication,
    snapshotVersion,
    runNumber,
  };
}

/** A final accepted result only; draft/refused inputs and private UI text never enter a checkpoint. */
export function encodeInstanceCheckpoint(
  accepted: AcceptedSnapshot,
  run: RunRecord,
): InstanceCheckpoint | null {
  if (!accepted.final || accepted.outputs.length > MAX_CHECKPOINT_OUTPUTS) return null;
  try {
    let elements = 0;
    const outputs = accepted.outputs.map((output) => {
      if (output.status !== "value" || typeof output.value === "number")
        return checkpointJson(output);
      const length = output.value.length;
      elements += length;
      if (length > MAX_CHECKPOINT_ARRAY_ELEMENTS || elements > MAX_CHECKPOINT_TOTAL_ARRAY_ELEMENTS)
        rejectCheckpoint("The accepted result exceeds its checkpoint array budget.");
      return checkpointJson({
        ...output,
        value: { encoding: "float64-json-v1", values: Array.from(output.value.copy()) },
      });
    });
    const encoded = { checkpointVersion: 1, accepted: { ...accepted, outputs }, run };
    return decodeInstanceCheckpoint(encoded).checkpoint;
  } catch {
    return null;
  }
}
