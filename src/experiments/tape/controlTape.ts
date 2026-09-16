/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/physics/controlTape.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Renamed patentId to experimentId.
 * - Removed patent-specific teaching tapes.
 * - Preserved bounded versioned tape, quantizeFloat, computeTapeDigest, and ControlTapeRecorder/ControlTapeReplayer.
 */

export interface ControlTapeEvent {
  readonly tick: number;
  readonly paramId: string;
  readonly value: number;
  readonly previousValue?: number | undefined;
}

export interface ControlTapeCheckpoint {
  readonly tick: number;
  readonly state: Record<string, number>;
  readonly digest: string;
  readonly digestKind: "host" | "blake3";
  readonly label?: string | undefined;
  readonly teachingNote?: string | undefined;
}

export interface ControlTape {
  readonly version: 1;
  readonly tapeId: string;
  readonly experimentId: string;
  readonly modelIdentity: string;
  readonly tickS: number;
  readonly initialConditions: Readonly<Record<string, number>>;
  readonly seed: number;
  readonly totalTicks: number;
  readonly events: readonly ControlTapeEvent[];
  readonly checkpoints: readonly ControlTapeCheckpoint[];
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly isTeachingSequence?: boolean | undefined;
}

export interface ReplayResult {
  readonly tick: number;
  readonly state: Record<string, number>;
  readonly digest: string;
  readonly digestKind: "host" | "blake3";
  readonly activeCheckpoint: ControlTapeCheckpoint | null;
  readonly refused: boolean;
  readonly refusalReason?: string | undefined;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string | undefined;
}

/**
 * Maximum capacity for an in-memory visitor recording.
 * At 60 ticks per second, 3600 frames equals 60 seconds of recording.
 */
export const MAX_TAPE_EVENTS = 3600;

/**
 * Quantize floating point numbers to a canonical representation.
 * Prevents non-deterministic roundoff differences across JS engines and platforms.
 */
export function quantizeFloat(val: number, precision = 6): number {
  if (!Number.isFinite(val)) return 0;
  const factor = 10 ** precision;
  return Math.round(val * factor) / factor;
}

/**
 * Computes an honest digest over canonical state.
 * Never prefixes 'blake3:' unless an admitted WASM hasher actually stepped.
 */
export function computeTapeDigest(
  state: Record<string, number>,
  tick: number,
  seed = 0,
  hasWasmHasher = false,
  wasmBlake3Digest?: string,
): { digest: string; digestKind: "host" | "blake3" } {
  if (hasWasmHasher && wasmBlake3Digest) {
    const d = wasmBlake3Digest.startsWith("blake3:")
      ? wasmBlake3Digest
      : `blake3:${wasmBlake3Digest}`;
    return { digest: d, digestKind: "blake3" };
  }

  // Canonical FNV-1a over sorted, quantized key-value pairs
  const sortedKeys = Object.keys(state).sort();
  let h = (2166136261 ^ seed ^ tick) >>> 0;
  for (const k of sortedKeys) {
    for (let i = 0; i < k.length; i++) {
      h ^= k.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const val = state[k] ?? 0;
    const qVal = quantizeFloat(val);
    const bits = Math.round(qVal * 1000000);
    h ^= bits;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return {
    digest: `host:${(h >>> 0).toString(16).padStart(8, "0")}`,
    digestKind: "host",
  };
}

/**
 * Validates whether a tape is compatible with the target experiment and model identity.
 */
export function validateTapeCompatibility(
  tape: ControlTape,
  currentExperimentId: string,
  currentModelIdentity: string,
): ValidationResult {
  if (tape.version !== 1) {
    return { valid: false, reason: `Unsupported tape version ${tape.version}; expected 1` };
  }
  if (tape.experimentId !== currentExperimentId) {
    return {
      valid: false,
      reason: `Tape belongs to '${tape.experimentId}', cannot replay on '${currentExperimentId}'`,
    };
  }
  if (tape.modelIdentity !== currentModelIdentity) {
    return {
      valid: false,
      reason: `Incompatible model identity: tape requires '${tape.modelIdentity}', current is '${currentModelIdentity}'`,
    };
  }
  return { valid: true };
}

/**
 * Tape recorder that captures parameter changes into a bounded versioned tape.
 */
export class ControlTapeRecorder {
  private events: ControlTapeEvent[] = [];
  private checkpoints: ControlTapeCheckpoint[] = [];
  private currentState: Record<string, number>;
  private isRecording = false;
  private currentTick = 0;

  constructor(
    public readonly experimentId: string,
    public readonly modelIdentity: string,
    public readonly initialConditions: Record<string, number>,
    public readonly seed = 0,
    public readonly tickS = 1 / 60,
  ) {
    this.currentState = { ...initialConditions };
    // Create initial checkpoint at tick 0
    const { digest, digestKind } = computeTapeDigest(this.currentState, 0, this.seed);
    this.checkpoints.push({
      tick: 0,
      state: { ...this.currentState },
      digest,
      digestKind,
      label: "Initial State",
    });
  }

  start() {
    this.isRecording = true;
  }

  stop() {
    this.isRecording = false;
  }

  get active(): boolean {
    return this.isRecording;
  }

  get tick(): number {
    return this.currentTick;
  }

  advanceTick(count = 1) {
    if (!this.isRecording) return;
    this.currentTick += count;

    // Auto-create checkpoint every 60 ticks (~1 second)
    if (this.currentTick % 60 === 0) {
      const { digest, digestKind } = computeTapeDigest(
        this.currentState,
        this.currentTick,
        this.seed,
      );
      this.checkpoints.push({
        tick: this.currentTick,
        state: { ...this.currentState },
        digest,
        digestKind,
      });
    }
  }

  recordEvent(paramId: string, value: number) {
    if (!this.isRecording) return;
    if (this.events.length >= MAX_TAPE_EVENTS) {
      // Memory bound reached: ignore further inputs to avoid runaway allocation
      return;
    }

    const previousValue = this.currentState[paramId];
    this.currentState[paramId] = quantizeFloat(value);

    this.events.push({
      tick: this.currentTick,
      paramId,
      value: this.currentState[paramId] ?? 0,
      previousValue: previousValue !== undefined ? quantizeFloat(previousValue) : undefined,
    });
  }

  addCheckpoint(label?: string, note?: string) {
    const { digest, digestKind } = computeTapeDigest(
      this.currentState,
      this.currentTick,
      this.seed,
    );
    this.checkpoints.push({
      tick: this.currentTick,
      state: { ...this.currentState },
      digest,
      digestKind,
      label,
      teachingNote: note,
    });
  }

  exportTape(title?: string, description?: string): ControlTape {
    return {
      version: 1,
      tapeId: `tape-${this.experimentId}-${Date.now()}`,
      experimentId: this.experimentId,
      modelIdentity: this.modelIdentity,
      tickS: this.tickS,
      initialConditions: { ...this.initialConditions },
      seed: this.seed,
      totalTicks: Math.max(this.currentTick, 1),
      events: [...this.events],
      checkpoints: [...this.checkpoints],
      title,
      description,
      isTeachingSequence: false,
    };
  }
}

/**
 * Deterministic Replayer for Control Tapes.
 * Handles forward/backward seeking, checkpoint restoration, and refusal on model mismatch.
 */
export class ControlTapeReplayer {
  private currentTick = 0;
  private state: Record<string, number>;
  private lastValidCheckpoint: ControlTapeCheckpoint;
  private isRefused = false;
  private refusalReason: string | undefined = undefined;

  constructor(
    public readonly tape: ControlTape,
    currentExperimentId: string,
    currentModelIdentity: string,
  ) {
    const validation = validateTapeCompatibility(tape, currentExperimentId, currentModelIdentity);
    if (!validation.valid) {
      this.isRefused = true;
      this.refusalReason = validation.reason;
      this.state = { ...tape.initialConditions };
      this.lastValidCheckpoint = {
        tick: 0,
        state: { ...tape.initialConditions },
        digest: "refused",
        digestKind: "host",
      };
      return;
    }

    this.state = { ...tape.initialConditions };
    const firstCp = tape.checkpoints.find((cp) => cp.tick === 0) ?? {
      tick: 0,
      state: { ...tape.initialConditions },
      ...computeTapeDigest(tape.initialConditions, 0, tape.seed),
    };
    this.lastValidCheckpoint = firstCp;
  }

  get tick(): number {
    return this.currentTick;
  }

  get currentState(): Readonly<Record<string, number>> {
    return this.state;
  }

  get refused(): boolean {
    return this.isRefused;
  }

  get reason(): string | undefined {
    return this.refusalReason;
  }

  /**
   * Seeks deterministically to targetTick.
   * If refused, refuses to step and returns last legal checkpoint state without inventing values.
   */
  seekTo(targetTick: number): ReplayResult {
    if (this.isRefused) {
      return {
        tick: 0,
        state: { ...this.tape.initialConditions },
        digest: "refused",
        digestKind: "host",
        activeCheckpoint: null,
        refused: true,
        refusalReason: this.refusalReason,
      };
    }

    const clampedTick = Math.max(0, Math.min(targetTick, this.tape.totalTicks));

    // Find latest checkpoint at or before clampedTick
    let bestCp: ControlTapeCheckpoint | null = null;
    for (const cp of this.tape.checkpoints) {
      if (cp.tick <= clampedTick) {
        if (!bestCp || cp.tick > bestCp.tick) {
          bestCp = cp;
        }
      }
    }

    const startTick = bestCp ? bestCp.tick : 0;
    const workingState: Record<string, number> = bestCp
      ? { ...bestCp.state }
      : { ...this.tape.initialConditions };

    // Apply all events between startTick and clampedTick in strict chronological order
    for (const evt of this.tape.events) {
      if (evt.tick > startTick && evt.tick <= clampedTick) {
        workingState[evt.paramId] = quantizeFloat(evt.value);
      }
    }

    this.currentTick = clampedTick;
    this.state = workingState;
    if (bestCp) {
      this.lastValidCheckpoint = bestCp;
    }

    const { digest, digestKind } = computeTapeDigest(this.state, this.currentTick, this.tape.seed);
    const exactCp = this.tape.checkpoints.find((cp) => cp.tick === clampedTick) ?? bestCp;

    return {
      tick: this.currentTick,
      state: { ...this.state },
      digest,
      digestKind,
      activeCheckpoint: exactCp ?? null,
      refused: false,
    };
  }

  stepForward(delta = 1): ReplayResult {
    return this.seekTo(this.currentTick + delta);
  }

  stepBackward(delta = 1): ReplayResult {
    return this.seekTo(this.currentTick - delta);
  }

  rewind(): ReplayResult {
    return this.seekTo(0);
  }
}
