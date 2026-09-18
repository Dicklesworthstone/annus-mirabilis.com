/**
 * Counter-based host RNG following FrankenSim fs-rand stream semantics v1.
 * Algorithm and KAT source: Dicklesworthstone/frankensim at
 * 5bbbfae6f7de614422f6f97f5798a3e00f8ad813, crates/fs-rand/src/{philox.rs,lib.rs}.
 * Copyright (c) 2026 Jeffrey Emanuel. MIT with OpenAI/Anthropic Rider;
 * the unmodified license and rider are in the repository's root LICENSE.
 *
 * Integer rounds and uniform mapping are exact. Gaussian conversion uses the
 * host Math library, NOT fs-math's strict transcendentals: do not claim bitwise
 * Gaussian parity with WASM or between engines. Not a cryptographic generator.
 */

export const STREAM_SEMANTICS_VERSION = 1;
export const STREAM_CHECKPOINT_VERSION = 1;
export const STREAM_CHECKPOINT_MAGIC = "FSRCKPT\0";
export const STREAM_CHECKPOINT_IDENTITY_DOMAIN = "org.frankensim.fs-rand.stream-checkpoint.v1";
export const STREAM_CHECKPOINT_CANONICAL_LEN = 83;
export const HOST_NORMAL_VERSION = "philox-box-muller-host-v1";
export const U64_MAX = 18446744073709551615n;

export type StreamKey = Readonly<{ seed: string | bigint; kernel: number; tile: number }>;

export interface StreamCheckpoint {
  readonly checkpointVersion: number;
  readonly streamSemanticsVersion: number;
  readonly key: StreamKey;
  readonly index: bigint;
}

export class StreamInputError extends RangeError {
  readonly code:
    | "invalid-seed"
    | "invalid-parameter"
    | "stream-index-overflow"
    | "invalid-checkpoint-length"
    | "invalid-checkpoint-magic"
    | "invalid-checkpoint-domain"
    | "unknown-checkpoint-version"
    | "unknown-stream-semantics-version";

  constructor(code: StreamInputError["code"], message: string) {
    super(message);
    this.name = "StreamInputError";
    this.code = code;
  }
}

export function parseU64(value: unknown): bigint {
  if (typeof value === "bigint" && value >= 0n && value <= U64_MAX) return value;
  if (typeof value === "string" && /^(0|[1-9][0-9]{0,19})$/.test(value)) {
    const n = BigInt(value);
    if (n <= U64_MAX) return n;
  }
  throw new StreamInputError(
    "invalid-seed",
    "Use a canonical unsigned 64-bit decimal string or bigint, never a JavaScript number.",
  );
}

function u32(n: number): void {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new StreamInputError(
      "invalid-parameter",
      "A stream word must be an unsigned 32-bit integer.",
    );
  }
}

/** Exact high product from 16-bit limbs; no rounded 64-bit double product. */
function highProduct(a: number, b: number): number {
  const low = (a & 65535) * (b & 65535);
  const middle = (a >>> 16) * (b & 65535) + (a & 65535) * (b >>> 16) + Math.floor(low / 65536);
  return ((a >>> 16) * (b >>> 16) + Math.floor(middle / 65536)) >>> 0;
}

function block(
  c0: number,
  c1: number,
  c2: number,
  c3: number,
  k0: number,
  k1: number,
): [number, number, number, number] {
  for (let i = 0; i < 10; i++) {
    if (i !== 0) {
      k0 = (k0 + 0x9e3779b9) >>> 0;
      k1 = (k1 + 0xbb67ae85) >>> 0;
    }
    const n0 = (highProduct(0xcd9e8d57, c2) ^ c1 ^ k0) >>> 0;
    const n2 = (highProduct(0xd2511f53, c0) ^ c3 ^ k1) >>> 0;
    const n1 = Math.imul(0xcd9e8d57, c2) >>> 0;
    c3 = Math.imul(0xd2511f53, c0) >>> 0;
    c0 = n0;
    c1 = n1;
    c2 = n2;
  }
  return [c0, c1, c2, c3];
}

export function philox4x32_10(
  counter: readonly number[],
  key: readonly number[],
): readonly [number, number, number, number] {
  if (counter.length !== 4 || key.length !== 2) {
    throw new StreamInputError(
      "invalid-parameter",
      "Philox requires four counter words and two key words.",
    );
  }
  const [c0, c1, c2, c3] = counter;
  const [k0, k1] = key;
  if (
    c0 === undefined ||
    c1 === undefined ||
    c2 === undefined ||
    c3 === undefined ||
    k0 === undefined ||
    k1 === undefined
  ) {
    throw new StreamInputError(
      "invalid-parameter",
      "Philox requires four counter words and two key words.",
    );
  }
  for (const word of [c0, c1, c2, c3, k0, k1]) u32(word);
  return block(c0, c1, c2, c3, k0, k1);
}

/**
 * Returns raw Philox block [u32; 4] for a given logical key and draw index.
 */
export function at(
  key: StreamKey,
  index: string | bigint,
): readonly [number, number, number, number] {
  const seed = parseU64(key.seed);
  const idx = parseU64(index);
  u32(key.kernel);
  u32(key.tile);
  const k0 = Number(seed & 0xffffffffn);
  const k1 = Number(seed >> 32n);
  const c0 = Number(idx & 0xffffffffn);
  const c1 = Number(idx >> 32n);
  return block(c0, c1, key.tile, key.kernel, k0, k1);
}

/**
 * Encodes canonical 83-byte StreamCheckpoint little-endian frame.
 */
export function encodeStreamCheckpoint(params: {
  checkpointVersion?: number;
  streamSemanticsVersion?: number;
  key?: StreamKey;
  seed?: string | bigint;
  kernel?: number;
  tile?: number;
  index?: string | bigint;
  nextIndex?: string | bigint;
}): Uint8Array {
  const buffer = new ArrayBuffer(STREAM_CHECKPOINT_CANONICAL_LEN);
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  // 1. Magic: 8 bytes
  const magicBytes = new TextEncoder().encode(STREAM_CHECKPOINT_MAGIC);
  u8.set(magicBytes, 0);

  // 2. Identity Domain: 43 bytes
  const domainBytes = new TextEncoder().encode(STREAM_CHECKPOINT_IDENTITY_DOMAIN);
  u8.set(domainBytes, 8);

  // 3. Checkpoint version (u32 LE at offset 51)
  const ckptVer = params.checkpointVersion ?? STREAM_CHECKPOINT_VERSION;
  u32(ckptVer);
  view.setUint32(51, ckptVer, true);

  // 4. Stream semantics version (u32 LE at offset 55)
  const streamVer = params.streamSemanticsVersion ?? STREAM_SEMANTICS_VERSION;
  u32(streamVer);
  view.setUint32(55, streamVer, true);

  // 5. Seed (u64 LE at offset 59)
  const rawSeed = params.key?.seed ?? params.seed;
  if (rawSeed === undefined) {
    throw new StreamInputError("invalid-parameter", "Missing seed in checkpoint");
  }
  const seed = parseU64(rawSeed);
  view.setBigUint64(59, seed, true);

  // 6. Kernel (u32 LE at offset 67)
  const kernel = params.key?.kernel ?? params.kernel;
  if (kernel === undefined) {
    throw new StreamInputError("invalid-parameter", "Missing kernel in checkpoint");
  }
  u32(kernel);
  view.setUint32(67, kernel, true);

  // 7. Tile (u32 LE at offset 71)
  const tile = params.key?.tile ?? params.tile;
  if (tile === undefined) {
    throw new StreamInputError("invalid-parameter", "Missing tile in checkpoint");
  }
  u32(tile);
  view.setUint32(71, tile, true);

  // 8. Next index (u64 LE at offset 75)
  const rawIdx = params.index ?? params.nextIndex;
  if (rawIdx === undefined) {
    throw new StreamInputError("invalid-parameter", "Missing index in checkpoint");
  }
  const index = parseU64(rawIdx);
  view.setBigUint64(75, index, true);

  return u8;
}

/**
 * Decodes canonical 83-byte StreamCheckpoint little-endian frame fail-closed.
 */
export function decodeStreamCheckpoint(bytes: Uint8Array): StreamCheckpoint {
  if (bytes.length !== STREAM_CHECKPOINT_CANONICAL_LEN) {
    throw new StreamInputError(
      "invalid-checkpoint-length",
      `Invalid checkpoint length: expected exactly ${STREAM_CHECKPOINT_CANONICAL_LEN} bytes, got ${bytes.length} (trailing or missing bytes refused).`,
    );
  }

  const magic = new TextDecoder().decode(bytes.subarray(0, 8));
  if (magic !== STREAM_CHECKPOINT_MAGIC) {
    throw new StreamInputError(
      "invalid-checkpoint-magic",
      `Invalid checkpoint magic: expected "${STREAM_CHECKPOINT_MAGIC}", got "${magic}".`,
    );
  }

  const domain = new TextDecoder().decode(bytes.subarray(8, 51));
  if (domain !== STREAM_CHECKPOINT_IDENTITY_DOMAIN) {
    throw new StreamInputError(
      "invalid-checkpoint-domain",
      `Invalid checkpoint domain: expected "${STREAM_CHECKPOINT_IDENTITY_DOMAIN}", got "${domain}".`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const checkpointVersion = view.getUint32(51, true);
  if (checkpointVersion !== STREAM_CHECKPOINT_VERSION) {
    throw new StreamInputError(
      "unknown-checkpoint-version",
      `Unknown checkpoint version: declared ${checkpointVersion}, supported ${STREAM_CHECKPOINT_VERSION}.`,
    );
  }

  const streamSemanticsVersion = view.getUint32(55, true);
  if (streamSemanticsVersion !== STREAM_SEMANTICS_VERSION) {
    throw new StreamInputError(
      "unknown-stream-semantics-version",
      `Unknown stream semantics version: declared ${streamSemanticsVersion}, supported ${STREAM_SEMANTICS_VERSION}.`,
    );
  }

  const seed = view.getBigUint64(59, true);
  const kernel = view.getUint32(67, true);
  const tile = view.getUint32(71, true);
  const index = view.getBigUint64(75, true);

  return Object.freeze({
    checkpointVersion,
    streamSemanticsVersion,
    key: Object.freeze({ seed: seed.toString(), kernel, tile }),
    index,
  });
}

/**
 * Series identity is in tile, not iteration order. Draw count is not step count.
 * Natural index wrapping at 2^64 mirrors upstream wrapping_add.
 */
export function createPhiloxStream(
  keyOrCheckpoint: StreamKey | StreamCheckpoint,
  startIndex: string | bigint = "0",
) {
  let effectiveKey: StreamKey;
  let effectiveStart: bigint;

  if ("checkpointVersion" in keyOrCheckpoint) {
    if (keyOrCheckpoint.checkpointVersion !== STREAM_CHECKPOINT_VERSION) {
      throw new StreamInputError(
        "unknown-checkpoint-version",
        `Unknown checkpoint version: declared ${keyOrCheckpoint.checkpointVersion}, supported ${STREAM_CHECKPOINT_VERSION}.`,
      );
    }
    if (keyOrCheckpoint.streamSemanticsVersion !== STREAM_SEMANTICS_VERSION) {
      throw new StreamInputError(
        "unknown-stream-semantics-version",
        `Unknown stream semantics version: declared ${keyOrCheckpoint.streamSemanticsVersion}, supported ${STREAM_SEMANTICS_VERSION}.`,
      );
    }
    effectiveKey = keyOrCheckpoint.key;
    effectiveStart = parseU64(keyOrCheckpoint.index);
  } else {
    effectiveKey = keyOrCheckpoint;
    effectiveStart = parseU64(startIndex);
  }

  const seed = parseU64(effectiveKey.seed);
  u32(effectiveKey.kernel);
  u32(effectiveKey.tile);
  const kernel = effectiveKey.kernel;
  const tile = effectiveKey.tile;
  const k0 = Number(seed & 0xffffffffn);
  const k1 = Number(seed >> 32n);

  let low = Number(effectiveStart & 0xffffffffn);
  let high = Number(effectiveStart >> 32n);

  function nextBlock(): [number, number, number, number] {
    const result = block(low, high, tile, kernel, k0, k1);
    low = (low + 1) >>> 0;
    if (low === 0) {
      high = (high + 1) >>> 0;
    }
    return result;
  }

  function uniform(): number {
    const words = nextBlock();
    // ((u64 >> 11) as f64) * 2^-53 in fs-rand, retaining all 53 bits.
    return (words[1] * 2097152 + (words[0] >>> 11)) / 9007199254740992;
  }

  return Object.freeze({
    key: Object.freeze({ seed: seed.toString(), kernel, tile }),

    get index(): bigint {
      return (BigInt(high) << 32n) | BigInt(low);
    },

    checkpoint(): StreamCheckpoint {
      return Object.freeze({
        checkpointVersion: STREAM_CHECKPOINT_VERSION,
        streamSemanticsVersion: STREAM_SEMANTICS_VERSION,
        key: Object.freeze({ seed: seed.toString(), kernel, tile }),
        index: (BigInt(high) << 32n) | BigInt(low),
      });
    },

    toCanonicalCheckpoint(): Uint8Array {
      return encodeStreamCheckpoint({
        checkpointVersion: STREAM_CHECKPOINT_VERSION,
        streamSemanticsVersion: STREAM_SEMANTICS_VERSION,
        seed,
        kernel,
        tile,
        index: (BigInt(high) << 32n) | BigInt(low),
      });
    },

    nextU64(): bigint {
      const w = nextBlock();
      return (BigInt(w[1]) << 32n) | BigInt(w[0]);
    },

    nextF64(): number {
      return uniform();
    },

    nextNormal(): number {
      const u = 1 - uniform();
      const v = uniform();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },

    /**
     * Lemire's widening multiply with deterministic rejection threshold (2^64 - n) % n.
     * Consumes draws deterministically; rejected draws advance the index.
     */
    nextBelow(n: number | bigint): bigint {
      const nBig = parseU64(n);
      if (nBig === 0n) {
        throw new StreamInputError(
          "invalid-parameter",
          "nextBelow(0) is meaningless; n must be > 0",
        );
      }
      const threshold = (-nBig & 0xffffffffffffffffn) % nBig;
      while (true) {
        const w = nextBlock();
        const x = (BigInt(w[1]) << 32n) | BigInt(w[0]);
        const m = x * nBig;
        const lo = m & 0xffffffffffffffffn;
        if (lo >= threshold) {
          return m >> 64n;
        }
      }
    },

    /**
     * Allocation-free bulk uniform fill bitwise-identical to sequential nextF64 calls.
     */
    fillF64(out: Float64Array): void {
      for (let i = 0; i < out.length; i++) {
        const w = block(low, high, tile, kernel, k0, k1);
        low = (low + 1) >>> 0;
        if (low === 0) {
          high = (high + 1) >>> 0;
        }
        out[i] = (w[1] * 2097152 + (w[0] >>> 11)) / 9007199254740992;
      }
    },

    /**
     * Allocation-free bulk normal fill consuming exactly 2 draws per normal.
     */
    fillNormals(out: Float64Array): void {
      for (let i = 0; i < out.length; i++) {
        const w0 = block(low, high, tile, kernel, k0, k1);
        low = (low + 1) >>> 0;
        if (low === 0) {
          high = (high + 1) >>> 0;
        }
        const u = 1 - (w0[1] * 2097152 + (w0[0] >>> 11)) / 9007199254740992;

        const w1 = block(low, high, tile, kernel, k0, k1);
        low = (low + 1) >>> 0;
        if (low === 0) {
          high = (high + 1) >>> 0;
        }
        const v = (w1[1] * 2097152 + (w1[0] >>> 11)) / 9007199254740992;

        out[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      }
    },
  });
}
