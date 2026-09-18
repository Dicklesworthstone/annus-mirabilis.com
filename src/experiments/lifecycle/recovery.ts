/**
 * Annus Mirabilis: Checkpoint Codec, Integrity Validation, and Crash Recovery
 *
 * Implements AGENTS.md "Worker behavior, memory, and lifecycle":
 * - Recovery validates model version, protocol version, tape schema, parameters,
 *   seed, and stream semantics before continuing; otherwise begins a visibly new run.
 * - Encodes and decodes the canonical 83-byte little-endian StreamCheckpoint frame:
 *   - magic: "FSRCKPT\0" (8 bytes)
 *   - domain: "org.frankensim.fs-rand.stream-checkpoint.v1" (43 bytes)
 *   - checkpoint version: u32 (4 bytes)
 *   - stream-semantics version: u32 (4 bytes)
 *   - seed: u64 (8 bytes)
 *   - kernel: u32 (4 bytes)
 *   - tile: u32 (4 bytes)
 *   - next index: u64 (8 bytes)
 *   - Total: 83 bytes, decoded fail-closed with trailing bytes refused.
 */

export const STREAM_CHECKPOINT_MAGIC = "FSRCKPT\0";
export const STREAM_CHECKPOINT_DOMAIN = "org.frankensim.fs-rand.stream-checkpoint.v1";
export const STREAM_CHECKPOINT_FRAME_LENGTH = 83;

export interface StreamCheckpointData {
  readonly magic: string;
  readonly domain: string;
  readonly checkpointVersion: number;
  readonly streamSemanticsVersion: number;
  readonly seed: bigint;
  readonly kernel: number;
  readonly tile: number;
  readonly nextIndex: bigint;
}

export interface CheckpointEnvelope {
  readonly checkpointBytes: Uint8Array;
  readonly modelVersion?: string;
  readonly protocolVersion?: number;
  readonly tapeSchemaVersion?: number;
  readonly parameterDigest?: string;
}

export interface ExpectedCheckpoint {
  readonly modelVersion?: string;
  readonly protocolVersion?: number;
  readonly tapeSchemaVersion?: number;
  readonly parameterDigest?: string;
  readonly expectedSeed?: bigint;
  readonly expectedKernel?: number;
  readonly expectedTile?: number;
  readonly expectedNextIndex?: bigint;
}

export type RecoveryDecision =
  | { readonly action: "continue"; readonly checkpoint: StreamCheckpointData }
  | {
      readonly action: "new-run";
      readonly parentRunId: string;
      readonly newRunId: string;
      readonly reason: string;
      readonly mismatchField: string;
    };

export interface CrashRecoveryResult {
  readonly isPaused: boolean;
  readonly explanation: string;
  readonly decision: RecoveryDecision;
}

/**
 * Encodes canonical 83-byte StreamCheckpoint frame.
 */
export function encodeStreamCheckpoint(params: {
  checkpointVersion?: number;
  streamSemanticsVersion?: number;
  seed: bigint;
  kernel: number;
  tile: number;
  nextIndex: bigint;
}): Uint8Array {
  const buffer = new ArrayBuffer(STREAM_CHECKPOINT_FRAME_LENGTH);
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  // 1. Magic (8 bytes)
  const magicBytes = new TextEncoder().encode(STREAM_CHECKPOINT_MAGIC);
  u8.set(magicBytes, 0);

  // 2. Domain (43 bytes)
  const domainBytes = new TextEncoder().encode(STREAM_CHECKPOINT_DOMAIN);
  u8.set(domainBytes, 8);

  // 3. Checkpoint version (u32 LE at offset 51)
  view.setUint32(51, params.checkpointVersion ?? 1, true);

  // 4. Stream semantics version (u32 LE at offset 55)
  view.setUint32(55, params.streamSemanticsVersion ?? 1, true);

  // 5. Seed (u64 LE at offset 59)
  view.setBigUint64(59, params.seed, true);

  // 6. Kernel (u32 LE at offset 67)
  view.setUint32(67, params.kernel, true);

  // 7. Tile (u32 LE at offset 71)
  view.setUint32(71, params.tile, true);

  // 8. Next index (u64 LE at offset 75)
  view.setBigUint64(75, params.nextIndex, true);

  return u8;
}

/**
 * Decodes canonical 83-byte StreamCheckpoint frame fail-closed.
 */
export function decodeStreamCheckpoint(bytes: Uint8Array): StreamCheckpointData {
  if (bytes.length !== STREAM_CHECKPOINT_FRAME_LENGTH) {
    throw new Error(
      `Invalid checkpoint length: expected exactly ${STREAM_CHECKPOINT_FRAME_LENGTH} bytes, got ${bytes.length} (trailing or missing bytes refused fail-closed).`,
    );
  }

  const magic = new TextDecoder().decode(bytes.subarray(0, 8));
  if (magic !== STREAM_CHECKPOINT_MAGIC) {
    throw new Error(
      `Invalid checkpoint magic: expected "${STREAM_CHECKPOINT_MAGIC}", got "${magic}".`,
    );
  }

  const domain = new TextDecoder().decode(bytes.subarray(8, 51));
  if (domain !== STREAM_CHECKPOINT_DOMAIN) {
    throw new Error(
      `Invalid checkpoint domain: expected "${STREAM_CHECKPOINT_DOMAIN}", got "${domain}".`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const checkpointVersion = view.getUint32(51, true);
  const streamSemanticsVersion = view.getUint32(55, true);
  const seed = view.getBigUint64(59, true);
  const kernel = view.getUint32(67, true);
  const tile = view.getUint32(71, true);
  const nextIndex = view.getBigUint64(75, true);

  return {
    magic,
    domain,
    checkpointVersion,
    streamSemanticsVersion,
    seed,
    kernel,
    tile,
    nextIndex,
  };
}

/**
 * Handles worker crash or WebGL context loss: pauses with explanation and evaluates checkpoint.
 */
export function handleLaboratoryCrashOrContextLoss(params: {
  event: "worker-crash" | "webgl-context-lost";
  currentRunId: string;
  checkpoint: Uint8Array | CheckpointEnvelope;
  expected: ExpectedCheckpoint;
}): CrashRecoveryResult {
  const explanation =
    params.event === "worker-crash"
      ? "Laboratory worker crashed: execution paused. Preserving simulated time and validating checkpoint before recovery."
      : "WebGL context lost: rendering paused. Preserving simulated time and validating checkpoint before recovery.";

  const decision = evaluateCheckpointRecovery(
    params.currentRunId,
    params.checkpoint,
    params.expected,
  );

  return {
    isPaused: true,
    explanation,
    decision,
  };
}

/**
 * Evaluates recovery from a checkpoint. If any field does not validate or matches a mutation,
 * refuses continuation and decides to start a new identified run.
 */
export function evaluateCheckpointRecovery(
  currentRunId: string,
  checkpoint: Uint8Array | CheckpointEnvelope,
  expected: ExpectedCheckpoint,
): RecoveryDecision {
  const isEnvelope = !(checkpoint instanceof Uint8Array);
  const envelope: CheckpointEnvelope | null = isEnvelope ? checkpoint : null;
  const bytes = isEnvelope ? checkpoint.checkpointBytes : checkpoint;

  // 1. Envelope metadata checks (model version, protocol, tape schema, parameter digest)
  if (
    expected.modelVersion !== undefined &&
    envelope?.modelVersion !== undefined &&
    envelope.modelVersion !== expected.modelVersion
  ) {
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Model version mismatch: expected ${expected.modelVersion}, got ${envelope.modelVersion}`,
      mismatchField: "modelVersion",
    };
  }

  if (
    expected.protocolVersion !== undefined &&
    envelope?.protocolVersion !== undefined &&
    envelope.protocolVersion !== expected.protocolVersion
  ) {
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Protocol version mismatch: expected ${expected.protocolVersion}, got ${envelope.protocolVersion}`,
      mismatchField: "protocolVersion",
    };
  }

  if (
    expected.tapeSchemaVersion !== undefined &&
    envelope?.tapeSchemaVersion !== undefined &&
    envelope.tapeSchemaVersion !== expected.tapeSchemaVersion
  ) {
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Tape schema version mismatch: expected ${expected.tapeSchemaVersion}, got ${envelope.tapeSchemaVersion}`,
      mismatchField: "tapeSchemaVersion",
    };
  }

  if (
    expected.parameterDigest !== undefined &&
    envelope?.parameterDigest !== undefined &&
    envelope.parameterDigest !== expected.parameterDigest
  ) {
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Parameter digest mismatch: expected ${expected.parameterDigest}, got ${envelope.parameterDigest}`,
      mismatchField: "parameterDigest",
    };
  }

  // 2. Decode StreamCheckpoint frame fail-closed
  let decoded: StreamCheckpointData;
  try {
    decoded = decodeStreamCheckpoint(bytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    let mismatchField = "format";
    if (message.includes("length")) {
      mismatchField = "trailing-bytes";
    } else if (message.includes("magic")) {
      mismatchField = "magic";
    } else if (message.includes("domain")) {
      mismatchField = "domain";
    }

    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Checkpoint decode failed: ${message}`,
      mismatchField,
    };
  }

  // 3. Frame field checks
  if (expected.expectedSeed !== undefined && decoded.seed !== expected.expectedSeed) {
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Seed mismatch in checkpoint: expected ${expected.expectedSeed}, got ${decoded.seed}`,
      mismatchField: "seed",
    };
  }

  if (expected.expectedKernel !== undefined && decoded.kernel !== expected.expectedKernel) {
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Kernel id mismatch in checkpoint: expected ${expected.expectedKernel}, got ${decoded.kernel}`,
      mismatchField: "kernel",
    };
  }

  if (expected.expectedTile !== undefined && decoded.tile !== expected.expectedTile) {
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Tile id mismatch in checkpoint: expected ${expected.expectedTile}, got ${decoded.tile}`,
      mismatchField: "tile",
    };
  }

  if (
    expected.expectedNextIndex !== undefined &&
    decoded.nextIndex !== expected.expectedNextIndex
  ) {
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Next index mismatch in checkpoint: expected ${expected.expectedNextIndex}, got ${decoded.nextIndex}`,
      mismatchField: "index",
    };
  }

  if (decoded.checkpointVersion !== 1) {
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Unsupported checkpoint version: ${decoded.checkpointVersion}`,
      mismatchField: "checkpointVersion",
    };
  }

  if (decoded.streamSemanticsVersion !== 1) {
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Unsupported stream semantics version: ${decoded.streamSemanticsVersion}`,
      mismatchField: "streamSemanticsVersion",
    };
  }

  return {
    action: "continue",
    checkpoint: decoded,
  };
}
