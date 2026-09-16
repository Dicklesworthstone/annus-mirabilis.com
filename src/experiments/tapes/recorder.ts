/**
 * Tape recorder that captures quantized control events, classified by command class,
 * structured prediction events, and scientific checkpoints into a version 2 control tape.
 * (am-rt-control-tapes-0gc).
 */
import type { CommandClass } from "../commands/types.ts";
import { parseU64, type U64String } from "../identity/u64.ts";
import { computeCheckpointDigest } from "./digest.ts";
import { type ParameterQuantizationPolicies, quantizeParameter } from "./quantize.ts";
import {
  type CheckpointStreamPosition,
  type ControlTapeV2,
  MAX_TAPE_EVENTS,
  type PredictionPromptSpec,
  type ReplayGrid,
  type TapeCheckpoint,
  type TapeControlEvent,
  type TapeEventEntry,
  type TapeModelIdentity,
  type TapePredictionEvent,
  TapeValidationError,
  validateControlTape,
  validatePredictionPayload,
} from "./schema.ts";

export interface ControlTapeRecorderOptions {
  readonly tapeId: string;
  readonly experimentId: string;
  readonly mode: string;
  readonly modelIdentity: TapeModelIdentity;
  readonly constantSetId: string;
  readonly seed: U64String | string | bigint | number;
  readonly streamVersion: number;
  readonly allocationId: string;
  readonly replayGrid?: ReplayGrid | undefined;
  readonly initialConditions: Readonly<Record<string, number>>;
  readonly quantizationPolicies?: ParameterQuantizationPolicies | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly isTeachingSequence?: boolean | undefined;
  readonly onBoundExceeded?: (() => void) | undefined;
}

export interface RecordControlEventParams {
  readonly commandClass: CommandClass;
  readonly commandId: string;
  readonly parameterId: string;
  readonly value: number;
  readonly previousValue?: number | undefined;
  readonly atSimulatedTime?: number | undefined;
}

export interface RecordPredictionEventParams {
  readonly instrumentId: string;
  readonly promptId: string;
  readonly payload: unknown;
  readonly promptSpec: PredictionPromptSpec;
}

export interface RecordCheckpointParams {
  readonly stepIndex: number;
  readonly simulatedTime: number;
  readonly checkpointVersion?: number | undefined;
  readonly streamSemanticsVersion?: number | undefined;
  readonly streamPositions?: readonly CheckpointStreamPosition[] | undefined;
  readonly label?: string | undefined;
  readonly teachingNote?: string | undefined;
}

export class ControlTapeRecorder {
  readonly tapeId: string;
  readonly experimentId: string;
  readonly mode: string;
  readonly modelIdentity: TapeModelIdentity;
  readonly constantSetId: string;
  readonly seed: U64String;
  readonly streamVersion: number;
  readonly allocationId: string;
  readonly replayGrid?: ReplayGrid | undefined;
  readonly initialConditions: Readonly<Record<string, number>>;
  readonly quantizationPolicies?: ParameterQuantizationPolicies | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly isTeachingSequence?: boolean | undefined;
  readonly onBoundExceeded?: (() => void) | undefined;

  private currentActionIndex = 0;
  private currentState: Record<string, number>;
  private events: TapeEventEntry[] = [];
  private checkpoints: TapeCheckpoint[] = [];
  private boundExceeded = false;

  constructor(options: ControlTapeRecorderOptions) {
    this.tapeId = options.tapeId;
    this.experimentId = options.experimentId;
    this.mode = options.mode;
    this.modelIdentity = options.modelIdentity;
    this.constantSetId = options.constantSetId;
    this.seed = parseU64(options.seed, "recorder.seed");
    this.streamVersion = options.streamVersion;
    this.allocationId = options.allocationId;
    this.replayGrid = options.replayGrid;
    this.initialConditions = Object.freeze({ ...options.initialConditions });
    this.quantizationPolicies = options.quantizationPolicies;
    this.title = options.title;
    this.description = options.description;
    this.isTeachingSequence = options.isTeachingSequence;
    this.onBoundExceeded = options.onBoundExceeded;
    this.currentState = { ...options.initialConditions };
  }

  get hasExceededEventBound(): boolean {
    return this.boundExceeded;
  }

  get currentAction(): number {
    return this.currentActionIndex;
  }

  getCurrentState(): Readonly<Record<string, number>> {
    return Object.freeze({ ...this.currentState });
  }

  getEvents(): readonly TapeEventEntry[] {
    return Object.freeze([...this.events]);
  }

  getCheckpoints(): readonly TapeCheckpoint[] {
    return Object.freeze([...this.checkpoints]);
  }

  /**
   * Records a classified control parameter change.
   * Quantizes value according to parameter policy if available.
   * Presentation changes do not update the latent scientific state.
   */
  recordControlEvent(params: RecordControlEventParams): boolean {
    if (this.events.length >= MAX_TAPE_EVENTS) {
      this.boundExceeded = true;
      this.onBoundExceeded?.();
      return false;
    }

    if (
      params.commandClass === "physical-intervention" &&
      (params.atSimulatedTime === undefined || !Number.isFinite(params.atSimulatedTime))
    ) {
      throw new TapeValidationError(
        "a physical-intervention event needs a finite atSimulatedTime.",
        `events[${this.events.length}]`,
      );
    }

    let quantizedValue = params.value;
    if (this.quantizationPolicies?.[params.parameterId]) {
      quantizedValue = quantizeParameter(
        params.parameterId,
        params.value,
        this.quantizationPolicies,
      );
    }

    const previousValue =
      params.previousValue !== undefined
        ? params.previousValue
        : this.currentState[params.parameterId];

    // Presentation changes never modify scientific state
    if (params.commandClass !== "presentation-change") {
      this.currentState[params.parameterId] = quantizedValue;
    }

    const event: TapeControlEvent = Object.freeze({
      kind: "control",
      actionIndex: ++this.currentActionIndex,
      commandClass: params.commandClass,
      commandId: params.commandId,
      parameterId: params.parameterId,
      value: quantizedValue,
      previousValue,
      atSimulatedTime: params.atSimulatedTime,
    });

    this.events.push(event);
    return true;
  }

  /**
   * Records a validated prediction event.
   * Values payloads are quantized by the parameter policy if applicable.
   */
  recordPredictionEvent(params: RecordPredictionEventParams): boolean {
    if (this.events.length >= MAX_TAPE_EVENTS) {
      this.boundExceeded = true;
      this.onBoundExceeded?.();
      return false;
    }

    const path = `events[${this.events.length}].prediction`;
    let validated = validatePredictionPayload(params.payload, params.promptSpec, path);

    // If values prediction and quantization policies exist, quantize each target
    if (validated.form === "values" && this.quantizationPolicies) {
      const quantizedTargets = validated.targets.map((t) => {
        const policy = this.quantizationPolicies?.[t.targetId];
        const val = policy
          ? quantizeParameter(t.targetId, t.value, this.quantizationPolicies)
          : t.value;
        return { targetId: t.targetId, value: val };
      });
      validated = { form: "values", targets: quantizedTargets };
    }

    const event: TapePredictionEvent = Object.freeze({
      kind: "prediction",
      actionIndex: ++this.currentActionIndex,
      instrumentId: params.instrumentId,
      promptId: params.promptId,
      payload: validated,
    });

    this.events.push(event);
    return true;
  }

  /**
   * Records a scientific checkpoint at the current action and step index.
   */
  async recordCheckpoint(params: RecordCheckpointParams): Promise<TapeCheckpoint> {
    const { digest, digestKind } = await computeCheckpointDigest({
      state: this.currentState,
      actionIndex: this.currentActionIndex,
      stepIndex: params.stepIndex,
      simulatedTime: params.simulatedTime,
      seed: this.seed,
      streamPositions: params.streamPositions,
    });

    const checkpoint: TapeCheckpoint = Object.freeze({
      actionIndex: this.currentActionIndex,
      stepIndex: params.stepIndex,
      simulatedTime: params.simulatedTime,
      digest,
      digestKind,
      checkpointVersion: params.checkpointVersion ?? 1,
      streamSemanticsVersion: params.streamSemanticsVersion ?? this.streamVersion,
      seed: this.seed,
      streamPositions: Object.freeze(params.streamPositions ? [...params.streamPositions] : []),
      label: params.label,
      teachingNote: params.teachingNote,
    });

    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  /**
   * Returns the final frozen ControlTapeV2 structure, validated against the schema.
   */
  getTape(): ControlTapeV2 {
    const raw = {
      tapeVersion: 2,
      tapeId: this.tapeId,
      experimentId: this.experimentId,
      mode: this.mode,
      modelIdentity: this.modelIdentity,
      constantSetId: this.constantSetId,
      seed: this.seed,
      streamVersion: this.streamVersion,
      allocationId: this.allocationId,
      replayGrid: this.replayGrid,
      initialConditions: this.initialConditions,
      events: this.events,
      checkpoints: this.checkpoints,
      title: this.title,
      description: this.description,
      isTeachingSequence: this.isTeachingSequence,
    };

    return validateControlTape(raw);
  }
}
