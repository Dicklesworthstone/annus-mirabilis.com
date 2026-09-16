/**
 * Deterministic replayer for version 2 control tapes (am-rt-control-tapes-0gc).
 * Handles compatibility validation with typed refusals, checkpoint restoration,
 * action seeking, and event playback.
 */
import type { RefusalCode } from "../results/refusalCodes.ts";
import { refusalCodeRegistry } from "../results/refusalCodes.ts";
import { makeRefusal, type RequestRefusal } from "../results/refusals.ts";
import { computeCheckpointDigest } from "./digest.ts";
import {
  type ControlTapeV2,
  type ReplayGrid,
  type TapeCheckpoint,
  type TapeModelIdentity,
  type TapePredictionEvent,
  validateControlTape,
} from "./schema.ts";

export interface TapeRuntimeContext {
  readonly experimentId: string;
  readonly modelIdentity: TapeModelIdentity;
  readonly constantSetId: string;
  readonly streamVersion: number;
  readonly allocationId: string;
  readonly replayGrid?: ReplayGrid | undefined;
}

export type TapeCompatibilityResult =
  | Readonly<{ compatible: true }>
  | Readonly<{
      compatible: false;
      refusalCode: RefusalCode;
      reason: string;
    }>;

export interface TapeReplayResult {
  readonly actionIndex: number;
  readonly state: Readonly<Record<string, number>>;
  readonly digest: string;
  readonly digestKind: "host" | "blake3";
  readonly activeCheckpoint: TapeCheckpoint | null;
  readonly activePredictions: readonly TapePredictionEvent[];
  readonly isRefused: boolean;
  readonly refusalCode?: RefusalCode | undefined;
  readonly refusal?: RequestRefusal | undefined;
}

/**
 * Validates compatibility of a tape with the current runtime execution context.
 */
export function validateTapeCompatibility(
  tape: ControlTapeV2,
  context: TapeRuntimeContext,
): TapeCompatibilityResult {
  if (tape.tapeVersion !== 2) {
    return Object.freeze({
      compatible: false,
      refusalCode: "tape-version-unsupported" as RefusalCode,
      reason: `Unsupported tape version ${tape.tapeVersion}; expected 2.`,
    });
  }

  if (
    tape.experimentId !== context.experimentId ||
    tape.modelIdentity.modelId !== context.modelIdentity.modelId ||
    tape.modelIdentity.modelVersion !== context.modelIdentity.modelVersion
  ) {
    return Object.freeze({
      compatible: false,
      refusalCode: "tape-model-mismatch" as RefusalCode,
      reason: `Tape model (${tape.experimentId}/${tape.modelIdentity.modelId}:v${tape.modelIdentity.modelVersion}) does not match current runtime (${context.experimentId}/${context.modelIdentity.modelId}:v${context.modelIdentity.modelVersion}).`,
    });
  }

  if (tape.modelIdentity.artifactDigest !== context.modelIdentity.artifactDigest) {
    return Object.freeze({
      compatible: false,
      refusalCode: "tape-artifact-mismatch" as RefusalCode,
      reason: `Tape computational artifact digest (${tape.modelIdentity.artifactDigest}) does not match current artifact (${context.modelIdentity.artifactDigest}).`,
    });
  }

  if (tape.constantSetId !== context.constantSetId) {
    return Object.freeze({
      compatible: false,
      refusalCode: "tape-constant-set-mismatch" as RefusalCode,
      reason: `Tape constant set '${tape.constantSetId}' does not match current constant set '${context.constantSetId}'.`,
    });
  }

  if (tape.streamVersion !== context.streamVersion) {
    return Object.freeze({
      compatible: false,
      refusalCode: "tape-stream-version-mismatch" as RefusalCode,
      reason: `Tape stream generator version ${tape.streamVersion} does not match current stream version ${context.streamVersion}.`,
    });
  }

  if (tape.allocationId !== context.allocationId) {
    return Object.freeze({
      compatible: false,
      refusalCode: "tape-allocation-mismatch" as RefusalCode,
      reason: `Tape stream allocation '${tape.allocationId}' does not match current allocation '${context.allocationId}'.`,
    });
  }

  if (tape.replayGrid !== undefined || context.replayGrid !== undefined) {
    const tapeGrid = tape.replayGrid;
    const ctxGrid = context.replayGrid;
    if (
      !tapeGrid ||
      !ctxGrid ||
      tapeGrid.baseSpacing !== ctxGrid.baseSpacing ||
      tapeGrid.horizon !== ctxGrid.horizon
    ) {
      return Object.freeze({
        compatible: false,
        refusalCode: "tape-grid-mismatch" as RefusalCode,
        reason: "Tape stochastic replay grid does not match current grid.",
      });
    }
  }

  return Object.freeze({ compatible: true });
}

export class ControlTapeReplayer {
  readonly tape: ControlTapeV2;
  readonly runtimeContext: TapeRuntimeContext;

  private isRefused = false;
  private refusalCode?: RefusalCode | undefined;
  private refusal?: RequestRefusal | undefined;
  private currentActionIndex = 0;
  private state: Record<string, number>;

  constructor(tape: ControlTapeV2 | unknown, runtimeContext: TapeRuntimeContext) {
    this.tape = validateControlTape(tape);
    this.runtimeContext = runtimeContext;
    this.state = { ...this.tape.initialConditions };

    const check = validateTapeCompatibility(this.tape, runtimeContext);
    if (!check.compatible) {
      this.isRefused = true;
      this.refusalCode = check.refusalCode;
      const def = refusalCodeRegistry[check.refusalCode];
      this.refusal = makeRefusal(
        check.refusalCode,
        { parameterIds: ["tape"] },
        {
          rankedRepairs: [
            {
              label: def ? def.repair : "Start a new run with the current model.",
              action: { parameterId: "run", value: "new" },
            },
          ],
        },
      );
    }
  }

  get refused(): boolean {
    return this.isRefused;
  }

  get activeRefusalCode(): RefusalCode | undefined {
    return this.refusalCode;
  }

  get activeRefusal(): RequestRefusal | undefined {
    return this.refusal;
  }

  get currentAction(): number {
    return this.currentActionIndex;
  }

  getCurrentState(): Readonly<Record<string, number>> {
    return Object.freeze({ ...this.state });
  }

  getTape(): ControlTapeV2 {
    return this.tape;
  }

  /**
   * Seeks to a specific logical actionIndex.
   * If replayer is refused, preserves initialConditions / last legal state.
   */
  async seekToAction(targetActionIndex: number): Promise<TapeReplayResult> {
    if (this.isRefused) {
      const initialDigest =
        this.tape.checkpoints.find((cp) => cp.actionIndex === 0)?.digest ?? "host:refused";
      return Object.freeze({
        actionIndex: 0,
        state: Object.freeze({ ...this.tape.initialConditions }),
        digest: initialDigest,
        digestKind: "host",
        activeCheckpoint: this.tape.checkpoints.find((cp) => cp.actionIndex === 0) ?? null,
        activePredictions: Object.freeze([]),
        isRefused: true,
        refusalCode: this.refusalCode,
        refusal: this.refusal,
      });
    }

    const lastEvent =
      this.tape.events.length > 0 ? this.tape.events[this.tape.events.length - 1] : undefined;
    const maxAction = lastEvent ? lastEvent.actionIndex : 0;
    const clampedAction = Math.max(0, Math.min(targetActionIndex, maxAction));

    // Find highest checkpoint <= clampedAction
    let bestCheckpoint: TapeCheckpoint | null = null;
    for (const cp of this.tape.checkpoints) {
      if (cp.actionIndex <= clampedAction) {
        if (!bestCheckpoint || cp.actionIndex > bestCheckpoint.actionIndex) {
          bestCheckpoint = cp;
        }
      }
    }

    // Reset state to initial conditions
    const workingState: Record<string, number> = { ...this.tape.initialConditions };

    // Apply all control events up to clampedAction
    const activePredictions: TapePredictionEvent[] = [];
    for (const event of this.tape.events) {
      if (event.actionIndex > clampedAction) break;
      if (event.kind === "control") {
        if (event.commandClass !== "presentation-change") {
          workingState[event.parameterId] = event.value;
        }
      } else if (event.kind === "prediction") {
        activePredictions.push(event);
      }
    }

    this.currentActionIndex = clampedAction;
    this.state = workingState;

    // Compute scientific digest for current working state
    const digestResult = await computeCheckpointDigest({
      state: workingState,
      actionIndex: clampedAction,
      stepIndex: bestCheckpoint ? bestCheckpoint.stepIndex : 0,
      simulatedTime: bestCheckpoint ? bestCheckpoint.simulatedTime : 0,
      seed: this.tape.seed,
      streamPositions: bestCheckpoint?.streamPositions,
    });

    // If seeking to an exact checkpoint, verify invariant: replayed digest must match recorded checkpoint
    if (bestCheckpoint && bestCheckpoint.actionIndex === clampedAction) {
      if (digestResult.digest !== bestCheckpoint.digest) {
        this.isRefused = true;
        this.refusalCode = "tape-model-mismatch";
        const def = refusalCodeRegistry["tape-model-mismatch"];
        this.refusal = makeRefusal(
          "tape-model-mismatch",
          { parameterIds: ["tape"] },
          {
            rankedRepairs: [
              {
                label:
                  def?.repair ||
                  "The replayed state diverged from the recorded checkpoint. Start a new run.",
                action: { parameterId: "run", value: "new" },
              },
            ],
          },
        );

        return Object.freeze({
          actionIndex: clampedAction,
          state: Object.freeze({ ...workingState }),
          digest: digestResult.digest,
          digestKind: digestResult.digestKind,
          activeCheckpoint: bestCheckpoint,
          activePredictions: Object.freeze(activePredictions),
          isRefused: true,
          refusalCode: this.refusalCode,
          refusal: this.refusal,
        });
      }
    }

    return Object.freeze({
      actionIndex: clampedAction,
      state: Object.freeze({ ...workingState }),
      digest: digestResult.digest,
      digestKind: digestResult.digestKind,
      activeCheckpoint: bestCheckpoint,
      activePredictions: Object.freeze(activePredictions),
      isRefused: false,
    });
  }

  /**
   * Advances replay to the next recorded event.
   */
  async stepForward(): Promise<TapeReplayResult> {
    const nextEvent = this.tape.events.find((e) => e.actionIndex > this.currentActionIndex);
    if (!nextEvent) {
      return this.seekToAction(this.currentActionIndex);
    }
    return this.seekToAction(nextEvent.actionIndex);
  }

  /**
   * Steps replay backward to the previous recorded event.
   */
  async stepBackward(): Promise<TapeReplayResult> {
    const prevEvents = this.tape.events.filter((e) => e.actionIndex < this.currentActionIndex);
    if (prevEvents.length === 0) {
      return this.seekToAction(0);
    }
    const prevEvent = prevEvents[prevEvents.length - 1];
    if (!prevEvent) {
      return this.seekToAction(0);
    }
    return this.seekToAction(prevEvent.actionIndex);
  }
}
