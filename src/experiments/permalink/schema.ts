/**
 * Runtime schema validator for Tape Schema Version 2.
 * Specification: am-inst-permalink-tape-s677, am-rt-control-tapes-0gc, am-rt-u64-identities-7ce
 */

import { COMMAND_CLASSES, type CommandClass } from "../../content/schemas/experiment.ts";
import { parseU64, U64ValidationError } from "../identity/u64.ts";
import type {
  PredictionCandidatePayload,
  PredictionForm,
  PredictionSketchPayload,
  PredictionValuesPayload,
  PredictionVerbalPayload,
  TapeAcceptedCheckpoint,
  TapeControlEvent,
  TapeModelIdentity,
  TapePredictionEvent,
  TapeReplayGrid,
  TapeTeachingRef,
  TapeV2,
} from "./types.ts";

export const MAX_PERMALINK_TAPE_EVENTS = 256;
export const MAX_PREDICTION_SKETCH_POINTS = 256;
export const MAX_PREDICTION_VALUES_COUNT = 64;

export class TapeValidationError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "tape") {
    super(`[TapeSchema] ${path}: ${message} (${code})`);
    this.name = "TapeValidationError";
    this.code = code;
    this.path = path;
  }
}

const DIGEST_PATTERN =
  /^(?:host:(?:sha256:[0-9a-f]{64}|fnv1a:[0-9a-f]{8}|[0-9a-f]{8,64})|blake3:[0-9a-f]{64})$/i;

export function validateTapeV2(raw: unknown, path = "tape"): TapeV2 {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TapeValidationError("tape-not-object", "Tape payload must be an object.", path);
  }

  const o = raw as Record<string, unknown>;

  // 1. Version check
  if (o.tapeVersion !== 2) {
    throw new TapeValidationError(
      "tape-version-unsupported",
      `Unsupported tape version "${String(o.tapeVersion)}"; expected 2.`,
      `${path}.tapeVersion`,
    );
  }

  // 2. Experiment ID
  if (typeof o.experimentId !== "string" || !o.experimentId.trim()) {
    throw new TapeValidationError(
      "tape-missing-experiment-id",
      "experimentId is required and must be a non-empty string.",
      `${path}.experimentId`,
    );
  }

  // 3. Mode check: mode must be a declared mode address (e.g. "bm-01:default" or "me-03:box-1906"), never a preset id
  if (typeof o.mode !== "string" || !o.mode.trim()) {
    throw new TapeValidationError(
      "tape-missing-mode",
      "mode is required and must be a declared mode address.",
      `${path}.mode`,
    );
  }
  if (
    o.mode.includes("preset") ||
    o.mode.endsWith("-preset") ||
    /^(?:bm|lq|sr|me)-\d{2}-[a-z0-9]+-[a-z0-9]+$/.test(o.mode)
  ) {
    throw new TapeValidationError(
      "tape-mode-is-preset-id",
      `mode "${o.mode}" appears to be a preset id. Mode must be a declared mode address, never a preset id.`,
      `${path}.mode`,
    );
  }

  // 4. Model Identity
  if (!o.modelIdentity || typeof o.modelIdentity !== "object" || Array.isArray(o.modelIdentity)) {
    throw new TapeValidationError(
      "tape-missing-model-identity",
      "modelIdentity is required and must be an object.",
      `${path}.modelIdentity`,
    );
  }
  const mid = o.modelIdentity as Record<string, unknown>;
  if (typeof mid.modelId !== "string" || !mid.modelId.trim()) {
    throw new TapeValidationError(
      "tape-missing-model-id",
      "modelIdentity.modelId is required.",
      `${path}.modelIdentity.modelId`,
    );
  }
  if (typeof mid.modelVersion !== "number" || !Number.isFinite(mid.modelVersion)) {
    throw new TapeValidationError(
      "tape-missing-model-version",
      "modelIdentity.modelVersion must be a finite number.",
      `${path}.modelIdentity.modelVersion`,
    );
  }
  const modelIdentity: TapeModelIdentity = {
    modelId: mid.modelId,
    modelVersion: mid.modelVersion,
    ...(typeof mid.artifactDigest === "string" ? { artifactDigest: mid.artifactDigest } : {}),
    ...(typeof mid.evaluatorSourceHash === "string"
      ? { evaluatorSourceHash: mid.evaluatorSourceHash }
      : {}),
  };

  // 5. Constant Set ID
  if (typeof o.constantSetId !== "string" || !o.constantSetId.trim()) {
    throw new TapeValidationError(
      "tape-missing-constant-set-id",
      "constantSetId is required.",
      `${path}.constantSetId`,
    );
  }

  // 6. Seed: strictly a canonical decimal string parsed through parseU64
  let seedStr: string;
  try {
    seedStr = parseU64(o.seed, `${path}.seed`);
  } catch (err: unknown) {
    if (err instanceof U64ValidationError) {
      throw new TapeValidationError(err.code, err.message, `${path}.seed`);
    }
    throw new TapeValidationError("u64-invalid-format", String(err), `${path}.seed`);
  }

  // 7. Stream Version and Allocation ID
  if (typeof o.streamVersion !== "number" && typeof o.streamVersion !== "string") {
    throw new TapeValidationError(
      "tape-missing-stream-version",
      "streamVersion is required.",
      `${path}.streamVersion`,
    );
  }
  if (typeof o.allocationId !== "string" || !o.allocationId.trim()) {
    throw new TapeValidationError(
      "tape-missing-allocation-id",
      "allocationId is required.",
      `${path}.allocationId`,
    );
  }

  // 8. Replay grid (optional)
  let replayGrid: TapeReplayGrid | undefined;
  if (o.replayGrid !== undefined) {
    if (typeof o.replayGrid !== "object" || o.replayGrid === null) {
      throw new TapeValidationError(
        "tape-invalid-replay-grid",
        "replayGrid must be an object.",
        `${path}.replayGrid`,
      );
    }
    const rg = o.replayGrid as Record<string, unknown>;
    if (
      typeof rg.baseSpacing !== "number" ||
      !Number.isFinite(rg.baseSpacing) ||
      rg.baseSpacing <= 0
    ) {
      throw new TapeValidationError(
        "tape-invalid-replay-grid",
        "replayGrid.baseSpacing must be a positive number.",
        `${path}.replayGrid.baseSpacing`,
      );
    }
    if (typeof rg.horizon !== "number" || !Number.isFinite(rg.horizon) || rg.horizon <= 0) {
      throw new TapeValidationError(
        "tape-invalid-replay-grid",
        "replayGrid.horizon must be a positive number.",
        `${path}.replayGrid.horizon`,
      );
    }
    replayGrid = {
      baseSpacing: rg.baseSpacing,
      horizon: rg.horizon,
    };
  }

  // 9. Initial conditions
  if (
    !o.initialConditions ||
    typeof o.initialConditions !== "object" ||
    Array.isArray(o.initialConditions)
  ) {
    throw new TapeValidationError(
      "tape-missing-initial-conditions",
      "initialConditions must be a non-null object.",
      `${path}.initialConditions`,
    );
  }
  const initialConditions: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(o.initialConditions as Record<string, unknown>)) {
    if (typeof v !== "number" && typeof v !== "string") {
      throw new TapeValidationError(
        "tape-invalid-initial-condition",
        `Initial condition "${k}" must be a number or string.`,
        `${path}.initialConditions.${k}`,
      );
    }
    if (typeof v === "number" && !Number.isFinite(v)) {
      throw new TapeValidationError(
        "tape-invalid-initial-condition",
        `Initial condition "${k}" must be a finite number.`,
        `${path}.initialConditions.${k}`,
      );
    }
    initialConditions[k] = v;
  }

  // 10. Preset ID (optional)
  let presetId: string | undefined;
  if (o.presetId !== undefined) {
    if (typeof o.presetId !== "string" || !o.presetId.trim()) {
      throw new TapeValidationError(
        "tape-invalid-preset-id",
        "presetId must be a non-empty string when provided.",
        `${path}.presetId`,
      );
    }
    presetId = o.presetId;
  }

  // 11. Events
  if (!Array.isArray(o.events)) {
    throw new TapeValidationError(
      "tape-missing-events",
      "events must be an array.",
      `${path}.events`,
    );
  }
  if (o.events.length > MAX_PERMALINK_TAPE_EVENTS) {
    throw new TapeValidationError(
      "tape-events-exceeded",
      `Tape contains ${o.events.length} events, exceeding the maximum bound of ${MAX_PERMALINK_TAPE_EVENTS}.`,
      `${path}.events`,
    );
  }

  const events: TapeControlEvent[] = [];
  let lastActionIndex = -1;
  for (let i = 0; i < o.events.length; i++) {
    const eRaw = o.events[i];
    const ePath = `${path}.events[${i}]`;
    if (!eRaw || typeof eRaw !== "object" || Array.isArray(eRaw)) {
      throw new TapeValidationError("tape-invalid-event", "Event must be an object.", ePath);
    }
    const e = eRaw as Record<string, unknown>;

    if (
      typeof e.actionIndex !== "number" ||
      !Number.isInteger(e.actionIndex) ||
      e.actionIndex < 0
    ) {
      throw new TapeValidationError(
        "tape-invalid-action-index",
        "actionIndex must be a non-negative integer.",
        `${ePath}.actionIndex`,
      );
    }
    if (e.actionIndex < lastActionIndex) {
      throw new TapeValidationError(
        "tape-events-out-of-order",
        `Events must be ordered by logical actionIndex (${e.actionIndex} < ${lastActionIndex}).`,
        `${ePath}.actionIndex`,
      );
    }
    lastActionIndex = e.actionIndex;

    if (typeof e.paramId !== "string" || !e.paramId.trim()) {
      throw new TapeValidationError(
        "tape-missing-param-id",
        "paramId is required.",
        `${ePath}.paramId`,
      );
    }

    if (!COMMAND_CLASSES.includes(e.commandClass as CommandClass)) {
      throw new TapeValidationError(
        "tape-invalid-command-class",
        `Invalid commandClass "${String(e.commandClass)}".`,
        `${ePath}.commandClass`,
      );
    }

    if (typeof e.value !== "number" && typeof e.value !== "string") {
      throw new TapeValidationError(
        "tape-invalid-event-value",
        "Event value must be a number or string.",
        `${ePath}.value`,
      );
    }
    if (typeof e.value === "number" && !Number.isFinite(e.value)) {
      throw new TapeValidationError(
        "tape-invalid-event-value",
        "Event value must be finite.",
        `${ePath}.value`,
      );
    }

    events.push({
      actionIndex: e.actionIndex,
      commandClass: e.commandClass as CommandClass,
      paramId: e.paramId,
      value: e.value,
      ...(e.previousValue !== undefined
        ? { previousValue: e.previousValue as number | string }
        : {}),
    });
  }

  // 12. Predictions (optional)
  let predictions: TapePredictionEvent[] | undefined;
  if (o.predictions !== undefined) {
    if (!Array.isArray(o.predictions)) {
      throw new TapeValidationError(
        "tape-invalid-predictions",
        "predictions must be an array when present.",
        `${path}.predictions`,
      );
    }
    predictions = [];
    for (let i = 0; i < o.predictions.length; i++) {
      const pRaw = o.predictions[i];
      const pPath = `${path}.predictions[${i}]`;
      if (!pRaw || typeof pRaw !== "object" || Array.isArray(pRaw)) {
        throw new TapeValidationError(
          "tape-invalid-prediction",
          "Prediction must be an object.",
          pPath,
        );
      }
      const p = pRaw as Record<string, unknown>;

      if (typeof p.promptId !== "string" || !p.promptId.trim()) {
        throw new TapeValidationError(
          "tape-missing-prompt-id",
          "promptId is required.",
          `${pPath}.promptId`,
        );
      }

      if (!["candidate", "sketch", "verbal", "values"].includes(p.form as PredictionForm)) {
        throw new TapeValidationError(
          "tape-invalid-prediction-form",
          `Invalid prediction form "${String(p.form)}". Must be candidate, sketch, verbal, or values.`,
          `${pPath}.form`,
        );
      }

      const form = p.form as PredictionForm;
      const payload = validatePredictionPayload(p.payload, form, `${pPath}.payload`);

      predictions.push({
        promptId: p.promptId,
        form,
        payload,
      });
    }
  }

  // 13. Teaching tape ref (optional)
  let teachingTapeRef: TapeTeachingRef | undefined;
  if (o.teachingTapeRef !== undefined) {
    if (typeof o.teachingTapeRef !== "object" || o.teachingTapeRef === null) {
      throw new TapeValidationError(
        "tape-invalid-teaching-ref",
        "teachingTapeRef must be an object.",
        `${path}.teachingTapeRef`,
      );
    }
    const tr = o.teachingTapeRef as Record<string, unknown>;
    if (typeof tr.tapeId !== "string" || !tr.tapeId.trim()) {
      throw new TapeValidationError(
        "tape-invalid-teaching-ref",
        "teachingTapeRef.tapeId is required.",
        `${path}.teachingTapeRef.tapeId`,
      );
    }
    if (typeof tr.stepIndex !== "number" || !Number.isInteger(tr.stepIndex) || tr.stepIndex < 0) {
      throw new TapeValidationError(
        "tape-invalid-teaching-ref",
        "teachingTapeRef.stepIndex must be a non-negative integer.",
        `${path}.teachingTapeRef.stepIndex`,
      );
    }
    teachingTapeRef = {
      tapeId: tr.tapeId,
      stepIndex: tr.stepIndex,
    };
  }

  // 14. Accepted checkpoint
  if (
    !o.acceptedCheckpoint ||
    typeof o.acceptedCheckpoint !== "object" ||
    Array.isArray(o.acceptedCheckpoint)
  ) {
    throw new TapeValidationError(
      "tape-missing-accepted-checkpoint",
      "acceptedCheckpoint is required and must be an object.",
      `${path}.acceptedCheckpoint`,
    );
  }
  const ac = o.acceptedCheckpoint as Record<string, unknown>;
  if (
    typeof ac.acceptedActionIndex !== "number" ||
    !Number.isInteger(ac.acceptedActionIndex) ||
    ac.acceptedActionIndex < 0
  ) {
    throw new TapeValidationError(
      "tape-invalid-accepted-action-index",
      "acceptedCheckpoint.acceptedActionIndex must be a non-negative integer.",
      `${path}.acceptedCheckpoint.acceptedActionIndex`,
    );
  }
  if (
    typeof ac.acceptedInputRevision !== "number" ||
    !Number.isInteger(ac.acceptedInputRevision) ||
    ac.acceptedInputRevision < 0
  ) {
    throw new TapeValidationError(
      "tape-invalid-accepted-input-revision",
      "acceptedCheckpoint.acceptedInputRevision must be a non-negative integer.",
      `${path}.acceptedCheckpoint.acceptedInputRevision`,
    );
  }
  if (typeof ac.digest !== "string" || !DIGEST_PATTERN.test(ac.digest)) {
    throw new TapeValidationError(
      "tape-invalid-checkpoint-digest",
      `acceptedCheckpoint.digest "${String(ac.digest)}" must start with "host:" or "blake3:" followed by hex characters.`,
      `${path}.acceptedCheckpoint.digest`,
    );
  }
  const acceptedCheckpoint: TapeAcceptedCheckpoint = {
    acceptedActionIndex: ac.acceptedActionIndex,
    acceptedInputRevision: ac.acceptedInputRevision,
    digest: ac.digest,
  };

  return {
    tapeVersion: 2,
    experimentId: o.experimentId,
    mode: o.mode,
    modelIdentity,
    constantSetId: o.constantSetId,
    seed: seedStr as import("../identity/u64.ts").U64String,
    streamVersion: o.streamVersion,
    allocationId: o.allocationId,
    ...(replayGrid ? { replayGrid } : {}),
    initialConditions,
    ...(presetId ? { presetId } : {}),
    events,
    ...(predictions ? { predictions } : {}),
    ...(teachingTapeRef ? { teachingTapeRef } : {}),
    acceptedCheckpoint,
    ...(typeof o.title === "string" ? { title: o.title } : {}),
    ...(typeof o.description === "string" ? { description: o.description } : {}),
  };
}

function validatePredictionPayload(
  raw: unknown,
  form: PredictionForm,
  path: string,
):
  | PredictionCandidatePayload
  | PredictionSketchPayload
  | PredictionVerbalPayload
  | PredictionValuesPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TapeValidationError(
      "prediction-payload-not-object",
      "Prediction payload must be an object.",
      path,
    );
  }
  const p = raw as Record<string, unknown>;

  // Reject free text in prediction payloads
  if (p.freeText !== undefined || p.note !== undefined || p.text !== undefined) {
    throw new TapeValidationError(
      "prediction-free-text-forbidden",
      "Prediction payloads must never carry free-text fields.",
      path,
    );
  }

  switch (form) {
    case "candidate": {
      if (typeof p.candidateId !== "string" || !p.candidateId.trim()) {
        throw new TapeValidationError(
          "prediction-missing-candidate-id",
          "Candidate prediction payload requires candidateId.",
          `${path}.candidateId`,
        );
      }
      return { candidateId: p.candidateId };
    }
    case "sketch": {
      if (!Array.isArray(p.points)) {
        throw new TapeValidationError(
          "prediction-missing-sketch-points",
          "Sketch prediction payload requires points array.",
          `${path}.points`,
        );
      }
      if (p.points.length > MAX_PREDICTION_SKETCH_POINTS) {
        throw new TapeValidationError(
          "prediction-sketch-points-exceeded",
          `Sketch points count (${p.points.length}) exceeds maximum limit (${MAX_PREDICTION_SKETCH_POINTS}).`,
          `${path}.points`,
        );
      }
      const points: [number, number][] = [];
      for (let i = 0; i < p.points.length; i++) {
        const pt = p.points[i];
        if (
          !Array.isArray(pt) ||
          pt.length !== 2 ||
          typeof pt[0] !== "number" ||
          typeof pt[1] !== "number" ||
          !Number.isFinite(pt[0]) ||
          !Number.isFinite(pt[1])
        ) {
          throw new TapeValidationError(
            "prediction-invalid-sketch-point",
            `Sketch point at index ${i} must be a tuple of two finite numbers [x, y].`,
            `${path}.points[${i}]`,
          );
        }
        points.push([pt[0], pt[1]]);
      }
      return { points };
    }
    case "verbal": {
      if (
        typeof p.choiceIndex !== "number" ||
        !Number.isInteger(p.choiceIndex) ||
        p.choiceIndex < 0
      ) {
        throw new TapeValidationError(
          "prediction-invalid-verbal-choice",
          "Verbal prediction payload requires a non-negative integer choiceIndex.",
          `${path}.choiceIndex`,
        );
      }
      return {
        choiceIndex: p.choiceIndex,
        ...(typeof p.choiceText === "string" ? { choiceText: p.choiceText } : {}),
      };
    }
    case "values": {
      if (!Array.isArray(p.values)) {
        throw new TapeValidationError(
          "prediction-missing-values",
          "Values prediction payload requires values array.",
          `${path}.values`,
        );
      }
      if (p.values.length > MAX_PREDICTION_VALUES_COUNT) {
        throw new TapeValidationError(
          "prediction-values-count-exceeded",
          `Values prediction count (${p.values.length}) exceeds maximum limit (${MAX_PREDICTION_VALUES_COUNT}).`,
          `${path}.values`,
        );
      }
      const values: [number, number][] = [];
      for (let i = 0; i < p.values.length; i++) {
        const item = p.values[i];
        if (
          !Array.isArray(item) ||
          item.length !== 2 ||
          typeof item[0] !== "number" ||
          typeof item[1] !== "number" ||
          !Number.isFinite(item[0]) ||
          !Number.isFinite(item[1])
        ) {
          throw new TapeValidationError(
            "prediction-invalid-value-item",
            `Values item at index ${i} must be a tuple of two finite numbers [targetId, value].`,
            `${path}.values[${i}]`,
          );
        }
        values.push([item[0], item[1]]);
      }
      return { values };
    }
  }
}
