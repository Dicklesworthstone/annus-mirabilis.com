/**
 * Tape schema version 2 (am-rt-control-tapes-0gc). Adapts the donor's bounded versioned tape
 * (src/experiments/tape/controlTape.ts) with four required changes: events are ordered by a
 * logical actionIndex rather than a UI tick; seeds are canonical U64String, never a JS number
 * (the donor's `(2166136261 ^ seed ^ tick) >>> 0` coerces a seed to 32 bits, so seeds differing
 * only above bit 32 collided); every event carries a command class; and quantization follows
 * each parameter's own declared policy rather than a blanket 6 decimal places.
 */
import { COMMAND_CLASSES, type CommandClass } from "../commands/types.ts";
import type { U64String } from "../identity/u64.ts";
import { parseU64 } from "../identity/u64.ts";

export const TAPE_VERSION = 2;

/** A dot in a tape id is permitted only between two digits, matching the site's general slug
 * grammar (e.g. `the-boost-to-0.6c`). */
export const TAPE_ID_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.\d[a-z0-9]*)?(?:-[a-z0-9]+(?:\.\d[a-z0-9]*)?)*$/;

export class TapeValidationError extends TypeError {
  readonly path: string;
  constructor(message: string, path: string) {
    super(`[tape] ${path}: ${message}`);
    this.name = "TapeValidationError";
    this.path = path;
  }
}

export type ReplayGrid = Readonly<{ baseSpacing: number; horizon: number }>;

export type TapeModelIdentity = Readonly<{
  modelId: string;
  modelVersion: string;
  /** The admitted artifact digest, or (for a host TypeScript evaluator with no compiled
   * artifact) the evaluator's own source hash. Exactly one of these identifies the model. */
  artifactDigest: string;
}>;

// ---- Control events -------------------------------------------------------------------------

export type TapeControlEvent = Readonly<{
  kind: "control";
  actionIndex: number;
  commandClass: CommandClass;
  commandId: string;
  parameterId: string;
  value: number;
  previousValue?: number | undefined;
  /** Required for, and only meaningful for, `physical-intervention`. */
  atSimulatedTime?: number | undefined;
}>;

// ---- Prediction events -----------------------------------------------------------------------

export const PREDICTION_FORMS = ["candidate", "sketch", "verbal", "values"] as const;
export type PredictionForm = (typeof PREDICTION_FORMS)[number];

export type SketchPoint = readonly [number, number];

export type PredictionPayload =
  | Readonly<{ form: "candidate"; candidateId: string }>
  | Readonly<{ form: "sketch"; points: readonly SketchPoint[] }>
  | Readonly<{ form: "verbal"; directionId: string; shapeId: string }>
  | Readonly<{ form: "values"; targets: readonly Readonly<{ targetId: string; value: number }>[] }>;

export type TapePredictionEvent = Readonly<{
  kind: "prediction";
  actionIndex: number;
  instrumentId: string;
  promptId: string;
  payload: PredictionPayload;
}>;

export type TapeEventEntry = TapeControlEvent | TapePredictionEvent;

/** The exact ids a prediction event's payload is checked against; owned by the prompt's own
 * authoring record (`am-inst-predict-mode-ti7m`), passed in here rather than duplicated. */
export type PredictionPromptSpec = Readonly<{
  promptId: string;
  candidateIds: readonly string[];
  verbalChoices: Readonly<{ directionIds: readonly string[]; shapeIds: readonly string[] }>;
  valueTargetIds: readonly string[];
  /** The two axis ranges a sketch's points are quantized against (per axis, [min, max]). */
  sketchAxisRanges?:
    | Readonly<{ x: readonly [number, number]; y: readonly [number, number] }>
    | undefined;
}>;

export const MAX_SKETCH_POINTS = 64;
export const SKETCH_QUANTUM = 1e-3;

const FREE_TEXT_FORBIDDEN_FIELDS = ["text", "note", "comment", "freeText", "answer"] as const;

function assertNoFreeText(payload: Record<string, unknown>, path: string): void {
  for (const field of FREE_TEXT_FORBIDDEN_FIELDS) {
    if (field in payload) {
      throw new TapeValidationError(
        `prediction payload must not carry free text ("${field}").`,
        path,
      );
    }
  }
}

export function validatePredictionPayload(
  raw: unknown,
  prompt: PredictionPromptSpec,
  path: string,
): PredictionPayload {
  if (!raw || typeof raw !== "object")
    throw new TapeValidationError("expected a prediction payload object.", path);
  const o = raw as Record<string, unknown>;
  assertNoFreeText(o, path);
  if (typeof o.form !== "string" || !(PREDICTION_FORMS as readonly string[]).includes(o.form)) {
    throw new TapeValidationError(`unknown prediction form "${String(o.form)}".`, path);
  }
  const form = o.form as PredictionForm;

  if (form === "candidate") {
    if (typeof o.candidateId !== "string" || !prompt.candidateIds.includes(o.candidateId)) {
      throw new TapeValidationError(
        `candidateId "${String(o.candidateId)}" is not one of the prompt's authored candidates (${prompt.candidateIds.join(", ")}).`,
        path,
      );
    }
    return { form: "candidate", candidateId: o.candidateId };
  }

  if (form === "sketch") {
    if (!Array.isArray(o.points))
      throw new TapeValidationError("a sketch must carry a points array.", path);
    if (o.points.length > MAX_SKETCH_POINTS) {
      throw new TapeValidationError(
        `a sketch may carry at most ${MAX_SKETCH_POINTS} points (got ${o.points.length}).`,
        path,
      );
    }
    const xRange = prompt.sketchAxisRanges?.x ?? [0, 1];
    const yRange = prompt.sketchAxisRanges?.y ?? [0, 1];
    const points: SketchPoint[] = o.points.map((p: unknown, i: number) => {
      if (
        !Array.isArray(p) ||
        p.length !== 2 ||
        typeof p[0] !== "number" ||
        typeof p[1] !== "number"
      ) {
        throw new TapeValidationError(`sketch point ${i} must be a [x, y] number pair.`, path);
      }
      const qx = quantizeFraction(p[0], xRange, SKETCH_QUANTUM);
      const qy = quantizeFraction(p[1], yRange, SKETCH_QUANTUM);
      return [qx, qy] as const;
    });
    return { form: "sketch", points };
  }

  if (form === "verbal") {
    if (
      typeof o.directionId !== "string" ||
      !prompt.verbalChoices.directionIds.includes(o.directionId)
    ) {
      throw new TapeValidationError(
        `directionId "${String(o.directionId)}" is not one of the prompt's verbalChoices (${prompt.verbalChoices.directionIds.join(", ")}).`,
        path,
      );
    }
    if (typeof o.shapeId !== "string" || !prompt.verbalChoices.shapeIds.includes(o.shapeId)) {
      throw new TapeValidationError(
        `shapeId "${String(o.shapeId)}" is not one of the prompt's verbalChoices (${prompt.verbalChoices.shapeIds.join(", ")}).`,
        path,
      );
    }
    return { form: "verbal", directionId: o.directionId, shapeId: o.shapeId };
  }

  // form === "values"
  if (!Array.isArray(o.targets))
    throw new TapeValidationError("a values prediction must carry a targets array.", path);
  const targets = o.targets.map((t: unknown, i: number) => {
    if (!t || typeof t !== "object")
      throw new TapeValidationError(`target ${i} must be an object.`, path);
    const to = t as Record<string, unknown>;
    if (typeof to.targetId !== "string" || !prompt.valueTargetIds.includes(to.targetId)) {
      throw new TapeValidationError(
        `targetId "${String(to.targetId)}" is not one of the prompt's valueTargets (${prompt.valueTargetIds.join(", ")}).`,
        path,
      );
    }
    if (typeof to.value !== "number" || !Number.isFinite(to.value)) {
      throw new TapeValidationError(`target "${to.targetId}" needs a finite numeric value.`, path);
    }
    return { targetId: to.targetId, value: to.value };
  });
  return { form: "values", targets };
}

function quantizeFraction(
  value: number,
  range: readonly [number, number],
  quantum: number,
): number {
  const [min, max] = range;
  const span = max - min || 1;
  const fraction = (value - min) / span;
  const quantized = Math.round(fraction / quantum) * quantum;
  return min + quantized * span;
}

// ---- Checkpoints ------------------------------------------------------------------------------

export type CheckpointStreamPosition = Readonly<{
  allocationId: string;
  /** The value fs-rand stores in `StreamKey.kernel`; named apart from any step kernel per
   * decision (i) of am-fs-capability-audit-byc. */
  streamKernelId: string;
  tile: U64String;
  index: U64String;
}>;

/** A number a teaching tape tells the reader to expect on screen at this checkpoint (for
 * example "0.79 μm"). `constantSetId` is required, never inferred from the tape's own
 * top-level constant set, because a teaching tape may walk a reader through more than one
 * constant set on the same recorded inputs (am-bm-01-tracer-ensemble-hdly: "every displayed
 * number names its constant set"). */
export type ExpectedDisplayValue = Readonly<{
  label: string;
  value: number;
  unit: string;
  constantSetId: string;
}>;

export type TapeCheckpoint = Readonly<{
  actionIndex: number;
  stepIndex: number;
  simulatedTime: number;
  digest: string;
  digestKind: "host" | "blake3";
  checkpointVersion: number;
  streamSemanticsVersion: number;
  seed: U64String;
  streamPositions: readonly CheckpointStreamPosition[];
  label?: string | undefined;
  teachingNote?: string | undefined;
  expectedDisplayValues?: readonly ExpectedDisplayValue[] | undefined;
}>;

// ---- The tape itself ----------------------------------------------------------------------

export type ControlTapeV2 = Readonly<{
  tapeVersion: 2;
  tapeId: string;
  experimentId: string;
  mode: string;
  modelIdentity: TapeModelIdentity;
  constantSetId: string;
  seed: U64String;
  streamVersion: number;
  allocationId: string;
  replayGrid?: ReplayGrid | undefined;
  initialConditions: Readonly<Record<string, number>>;
  events: readonly TapeEventEntry[];
  checkpoints: readonly TapeCheckpoint[];
  title?: string | undefined;
  description?: string | undefined;
  isTeachingSequence?: boolean | undefined;
}>;

/** In-memory recordings stop here with a visible notice; compact URL serialization (which may
 * apply a different, smaller bound) belongs to am-inst-permalink-tape-s677. */
export const MAX_TAPE_EVENTS = 3600;

export function isValidTapeId(id: string): boolean {
  return TAPE_ID_PATTERN.test(id);
}

function assertActionIndicesOrdered(events: readonly TapeEventEntry[], path: string): void {
  let previous = -1;
  for (const event of events) {
    if (event.actionIndex <= previous) {
      throw new TapeValidationError(
        `actionIndex must strictly increase; got ${event.actionIndex} after ${previous}.`,
        path,
      );
    }
    previous = event.actionIndex;
  }
}

export function validateControlTape(raw: unknown, path = "tape"): ControlTapeV2 {
  if (!raw || typeof raw !== "object") throw new TapeValidationError("expected an object.", path);
  const o = raw as Record<string, unknown>;
  if (o.tapeVersion !== TAPE_VERSION) {
    throw new TapeValidationError(
      `unsupported tapeVersion "${String(o.tapeVersion)}"; expected ${TAPE_VERSION}.`,
      path,
    );
  }
  if (typeof o.tapeId !== "string" || !isValidTapeId(o.tapeId)) {
    throw new TapeValidationError(`invalid tapeId "${String(o.tapeId)}".`, path);
  }
  if (typeof o.experimentId !== "string" || !o.experimentId.trim()) {
    throw new TapeValidationError("experimentId is required.", path);
  }
  if (typeof o.mode !== "string" || !o.mode.trim())
    throw new TapeValidationError("mode is required.", path);
  const modelIdentity = validateModelIdentity(o.modelIdentity, `${path}.modelIdentity`);
  if (typeof o.constantSetId !== "string" || !o.constantSetId.trim()) {
    throw new TapeValidationError("constantSetId is required.", path);
  }
  const seed = parseU64(o.seed, `${path}.seed`);
  if (!Number.isInteger(o.streamVersion) || (o.streamVersion as number) < 1) {
    throw new TapeValidationError("streamVersion must be a positive integer.", path);
  }
  if (typeof o.allocationId !== "string" || !o.allocationId.trim()) {
    throw new TapeValidationError("allocationId is required.", path);
  }
  const replayGrid =
    o.replayGrid === undefined ? undefined : validateReplayGrid(o.replayGrid, `${path}.replayGrid`);
  if (
    !o.initialConditions ||
    typeof o.initialConditions !== "object" ||
    Array.isArray(o.initialConditions)
  ) {
    throw new TapeValidationError(
      "initialConditions must be an object of canonical SI values.",
      path,
    );
  }
  for (const [key, value] of Object.entries(o.initialConditions as Record<string, unknown>)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TapeValidationError(`initialConditions.${key} must be a finite number.`, path);
    }
  }
  if (!Array.isArray(o.events)) throw new TapeValidationError("events must be an array.", path);
  if (o.events.length > MAX_TAPE_EVENTS) {
    throw new TapeValidationError(
      `events exceed the ${MAX_TAPE_EVENTS}-event bound (got ${o.events.length}); recording must stop with a notice, never a silent drop.`,
      path,
    );
  }
  const events = o.events.map((e, i) => validateEventEntry(e, `${path}.events[${i}]`));
  assertActionIndicesOrdered(events, `${path}.events`);
  if (!Array.isArray(o.checkpoints))
    throw new TapeValidationError("checkpoints must be an array.", path);
  const checkpoints = o.checkpoints.map((c, i) =>
    validateCheckpoint(c, `${path}.checkpoints[${i}]`),
  );

  return Object.freeze({
    tapeVersion: TAPE_VERSION,
    tapeId: o.tapeId,
    experimentId: o.experimentId,
    mode: o.mode,
    modelIdentity,
    constantSetId: o.constantSetId,
    seed,
    streamVersion: o.streamVersion as number,
    allocationId: o.allocationId,
    replayGrid,
    initialConditions: Object.freeze({ ...(o.initialConditions as Record<string, number>) }),
    events: Object.freeze(events),
    checkpoints: Object.freeze(checkpoints),
    title: typeof o.title === "string" ? o.title : undefined,
    description: typeof o.description === "string" ? o.description : undefined,
    isTeachingSequence:
      typeof o.isTeachingSequence === "boolean" ? o.isTeachingSequence : undefined,
  });
}

function validateModelIdentity(raw: unknown, path: string): TapeModelIdentity {
  if (!raw || typeof raw !== "object")
    throw new TapeValidationError("expected a model identity object.", path);
  const o = raw as Record<string, unknown>;
  if (typeof o.modelId !== "string" || !o.modelId.trim())
    throw new TapeValidationError("modelId is required.", path);
  if (typeof o.modelVersion !== "string" || !o.modelVersion.trim()) {
    throw new TapeValidationError("modelVersion is required.", path);
  }
  if (typeof o.artifactDigest !== "string" || !o.artifactDigest.trim()) {
    throw new TapeValidationError(
      "artifactDigest (or the evaluator source hash) is required.",
      path,
    );
  }
  return Object.freeze({
    modelId: o.modelId,
    modelVersion: o.modelVersion,
    artifactDigest: o.artifactDigest,
  });
}

function validateReplayGrid(raw: unknown, path: string): ReplayGrid {
  if (!raw || typeof raw !== "object")
    throw new TapeValidationError("expected a replay grid object.", path);
  const o = raw as Record<string, unknown>;
  if (typeof o.baseSpacing !== "number" || !(o.baseSpacing > 0)) {
    throw new TapeValidationError("baseSpacing must be a positive number.", path);
  }
  if (typeof o.horizon !== "number" || !(o.horizon > 0)) {
    throw new TapeValidationError("horizon must be a positive number.", path);
  }
  return Object.freeze({ baseSpacing: o.baseSpacing, horizon: o.horizon });
}

function validateEventEntry(raw: unknown, path: string): TapeEventEntry {
  if (!raw || typeof raw !== "object")
    throw new TapeValidationError("expected an event object.", path);
  const o = raw as Record<string, unknown>;
  if (o.kind === "prediction") {
    if (typeof o.instrumentId !== "string" || !o.instrumentId.trim()) {
      throw new TapeValidationError("prediction event needs instrumentId.", path);
    }
    if (typeof o.promptId !== "string" || !o.promptId.trim()) {
      throw new TapeValidationError("prediction event needs promptId.", path);
    }
    if (typeof o.actionIndex !== "number" || !Number.isInteger(o.actionIndex)) {
      throw new TapeValidationError("actionIndex must be an integer.", path);
    }
    // The payload was already validated against its prompt by the recorder (which alone has
    // the prompt spec); here we only check shape, since replay trusts a tape it already accepted.
    if (!o.payload || typeof o.payload !== "object") {
      throw new TapeValidationError("prediction event needs a payload.", path);
    }
    return Object.freeze({
      kind: "prediction",
      actionIndex: o.actionIndex,
      instrumentId: o.instrumentId,
      promptId: o.promptId,
      payload: o.payload as PredictionPayload,
    });
  }
  if (o.kind !== "control")
    throw new TapeValidationError(`unknown event kind "${String(o.kind)}".`, path);
  if (typeof o.actionIndex !== "number" || !Number.isInteger(o.actionIndex)) {
    throw new TapeValidationError("actionIndex must be an integer.", path);
  }
  if (
    typeof o.commandClass !== "string" ||
    !(COMMAND_CLASSES as readonly string[]).includes(o.commandClass)
  ) {
    throw new TapeValidationError(`invalid commandClass "${String(o.commandClass)}".`, path);
  }
  if (typeof o.commandId !== "string" || !o.commandId.trim())
    throw new TapeValidationError("commandId is required.", path);
  if (typeof o.parameterId !== "string" || !o.parameterId.trim()) {
    throw new TapeValidationError("parameterId is required.", path);
  }
  if (typeof o.value !== "number" || !Number.isFinite(o.value)) {
    throw new TapeValidationError("value must be a finite canonical SI number.", path);
  }
  if (o.commandClass === "physical-intervention" && typeof o.atSimulatedTime !== "number") {
    throw new TapeValidationError("a physical-intervention event needs atSimulatedTime.", path);
  }
  return Object.freeze({
    kind: "control",
    actionIndex: o.actionIndex,
    commandClass: o.commandClass as CommandClass,
    commandId: o.commandId,
    parameterId: o.parameterId,
    value: o.value,
    previousValue: typeof o.previousValue === "number" ? o.previousValue : undefined,
    atSimulatedTime: typeof o.atSimulatedTime === "number" ? o.atSimulatedTime : undefined,
  });
}

function validateCheckpoint(raw: unknown, path: string): TapeCheckpoint {
  if (!raw || typeof raw !== "object")
    throw new TapeValidationError("expected a checkpoint object.", path);
  const o = raw as Record<string, unknown>;
  if (typeof o.actionIndex !== "number" || !Number.isInteger(o.actionIndex)) {
    throw new TapeValidationError("actionIndex must be an integer.", path);
  }
  if (typeof o.stepIndex !== "number" || !Number.isInteger(o.stepIndex) || o.stepIndex < 0) {
    throw new TapeValidationError("stepIndex must be a nonnegative integer.", path);
  }
  if (typeof o.simulatedTime !== "number" || !Number.isFinite(o.simulatedTime)) {
    throw new TapeValidationError("simulatedTime must be a finite number.", path);
  }
  if (typeof o.digest !== "string" || !o.digest.trim())
    throw new TapeValidationError("digest is required.", path);
  if (o.digestKind !== "host" && o.digestKind !== "blake3") {
    throw new TapeValidationError(
      `digestKind must be "host" or "blake3", got "${String(o.digestKind)}".`,
      path,
    );
  }
  if (o.digestKind === "host" && !o.digest.startsWith("host:")) {
    throw new TapeValidationError(
      `a "host" checkpoint must carry a "host:"-prefixed digest, got "${o.digest}".`,
      path,
    );
  }
  if (o.digestKind === "blake3" && !o.digest.startsWith("blake3:")) {
    throw new TapeValidationError(
      `a "blake3" checkpoint must carry a "blake3:"-prefixed digest, got "${o.digest}".`,
      path,
    );
  }
  if (!Number.isInteger(o.checkpointVersion) || (o.checkpointVersion as number) < 1) {
    throw new TapeValidationError("checkpointVersion must be a positive integer.", path);
  }
  if (!Number.isInteger(o.streamSemanticsVersion) || (o.streamSemanticsVersion as number) < 1) {
    throw new TapeValidationError("streamSemanticsVersion must be a positive integer.", path);
  }
  const seed = parseU64(o.seed, `${path}.seed`);
  if (!Array.isArray(o.streamPositions))
    throw new TapeValidationError("streamPositions must be an array.", path);
  const streamPositions = o.streamPositions.map((s, i) =>
    validateStreamPosition(s, `${path}.streamPositions[${i}]`),
  );
  const expectedDisplayValues =
    o.expectedDisplayValues === undefined
      ? undefined
      : validateExpectedDisplayValues(o.expectedDisplayValues, `${path}.expectedDisplayValues`);
  return Object.freeze({
    actionIndex: o.actionIndex,
    stepIndex: o.stepIndex,
    simulatedTime: o.simulatedTime,
    digest: o.digest,
    digestKind: o.digestKind,
    checkpointVersion: o.checkpointVersion as number,
    streamSemanticsVersion: o.streamSemanticsVersion as number,
    seed,
    streamPositions: Object.freeze(streamPositions),
    label: typeof o.label === "string" ? o.label : undefined,
    teachingNote: typeof o.teachingNote === "string" ? o.teachingNote : undefined,
    expectedDisplayValues,
  });
}

/** Every expected displayed value must name the constant set it was computed under
 * (am-bm-01-tracer-ensemble-hdly): a value with no `constantSetId`, or an empty one, fails
 * validation rather than being silently accepted as unlabeled. */
function validateExpectedDisplayValues(
  raw: unknown,
  path: string,
): readonly ExpectedDisplayValue[] {
  if (!Array.isArray(raw))
    throw new TapeValidationError("expectedDisplayValues must be an array.", path);
  return Object.freeze(
    raw.map((entry, i) => {
      const entryPath = `${path}[${i}]`;
      if (!entry || typeof entry !== "object")
        throw new TapeValidationError("expected an expected-display-value object.", entryPath);
      const o = entry as Record<string, unknown>;
      if (typeof o.label !== "string" || !o.label.trim())
        throw new TapeValidationError("label is required.", entryPath);
      if (typeof o.value !== "number" || !Number.isFinite(o.value))
        throw new TapeValidationError("value must be a finite number.", entryPath);
      if (typeof o.unit !== "string" || !o.unit.trim())
        throw new TapeValidationError("unit is required.", entryPath);
      if (typeof o.constantSetId !== "string" || !o.constantSetId.trim()) {
        throw new TapeValidationError(
          `expected display value "${o.label}" must name its constantSetId; an unlabeled displayed number is not admitted.`,
          entryPath,
        );
      }
      return Object.freeze({
        label: o.label,
        value: o.value,
        unit: o.unit,
        constantSetId: o.constantSetId,
      });
    }),
  );
}

function validateStreamPosition(raw: unknown, path: string): CheckpointStreamPosition {
  if (!raw || typeof raw !== "object")
    throw new TapeValidationError("expected a stream position object.", path);
  const o = raw as Record<string, unknown>;
  if (typeof o.allocationId !== "string" || !o.allocationId.trim()) {
    throw new TapeValidationError("allocationId is required.", path);
  }
  if (typeof o.streamKernelId !== "string" || !o.streamKernelId.trim()) {
    throw new TapeValidationError("streamKernelId is required.", path);
  }
  const tile = parseU64(o.tile, `${path}.tile`);
  const index = parseU64(o.index, `${path}.index`);
  return Object.freeze({
    allocationId: o.allocationId,
    streamKernelId: o.streamKernelId,
    tile,
    index,
  });
}
