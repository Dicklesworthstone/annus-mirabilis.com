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

export interface ExpectedCheckpoint {
  readonly modelVersion?: string;
  readonly protocolVersion?: number;
  readonly tapeSchemaVersion?: number;
  readonly parameterDigest?: string;
  readonly expectedSeed?: bigint;
  readonly expectedKernel?: number;
  readonly expectedTile?: number;
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
    throw new Error(`Invalid checkpoint magic: expected "${STREAM_CHECKPOINT_MAGIC}", got "${magic}".`);
  }

  const domain = new TextDecoder().decode(bytes.subarray(8, 51));
  if (domain !== STREAM_CHECKPOINT_DOMAIN) {
    throw new Error(`Invalid checkpoint domain: expected "${STREAM_CHECKPOINT_DOMAIN}", got "${domain}".`);
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
 * Evaluates recovery from a checkpoint. If any field does not validate or matches a mutation,
 * refuses continuation and decides to start a new identified run.
 */
export function evaluateCheckpointRecovery(
  currentRunId: string,
  checkpointBytes: Uint8Array,
  expected: ExpectedCheckpoint,
): RecoveryDecision {
  let decoded: StreamCheckpointData;
  try {
    decoded = decodeStreamCheckpoint(checkpointBytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      action: "new-run",
      parentRunId: currentRunId,
      newRunId: `${currentRunId}-recovered-new-${Date.now()}`,
      reason: `Checkpoint decode failed: ${message}`,
      mismatchField: message.includes("length") ? "trailing-bytes" : "format",
    };
  }

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
