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
export const HOST_NORMAL_VERSION = "philox-box-muller-host-v1";
export const U64_MAX = 18446744073709551615n;
export type StreamKey = Readonly<{ seed: string | bigint; kernel: number; tile: number }>;
export class StreamInputError extends RangeError {
  readonly code: "invalid-seed" | "invalid-parameter" | "stream-index-overflow";
  constructor(code: StreamInputError["code"], message: string) { super(message); this.name = "StreamInputError"; this.code = code; }
}
export function parseU64(value: unknown): bigint {
  if (typeof value === "bigint" && value >= 0n && value <= U64_MAX) return value;
  if (typeof value === "string" && /^(0|[1-9][0-9]{0,19})$/.test(value)) {
    const n = BigInt(value); if (n <= U64_MAX) return n;
  }
  throw new StreamInputError("invalid-seed", "Use a canonical unsigned 64-bit decimal string or bigint, never a JavaScript number.");
}
function u32(n: number): void {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new StreamInputError("invalid-parameter", "A stream word must be an unsigned 32-bit integer.");
}
/** Exact high product from 16-bit limbs; no rounded 64-bit double product. */
function highProduct(a: number, b: number): number {
  const low = (a & 65535) * (b & 65535);
  const middle = (a >>> 16) * (b & 65535) + (a & 65535) * (b >>> 16) + Math.floor(low / 65536);
  return ((a >>> 16) * (b >>> 16) + Math.floor(middle / 65536)) >>> 0;
}
function block(c0: number, c1: number, c2: number, c3: number, k0: number, k1: number): [number, number, number, number] {
  for (let i = 0; i < 10; i++) {
    if (i !== 0) { k0 = (k0 + 0x9e3779b9) >>> 0; k1 = (k1 + 0xbb67ae85) >>> 0; }
    const n0 = (highProduct(0xcd9e8d57, c2) ^ c1 ^ k0) >>> 0;
    const n2 = (highProduct(0xd2511f53, c0) ^ c3 ^ k1) >>> 0;
    const n1 = Math.imul(0xcd9e8d57, c2) >>> 0;
    c3 = Math.imul(0xd2511f53, c0) >>> 0; c0 = n0; c1 = n1; c2 = n2;
  }
  return [c0, c1, c2, c3];
}
export function philox4x32_10(counter: readonly number[], key: readonly number[]): readonly [number, number, number, number] {
  if (counter.length !== 4 || key.length !== 2) throw new StreamInputError("invalid-parameter", "Philox requires four counter words and two key words.");
  for (const word of [...counter, ...key]) u32(word);
  return block(counter[0]!, counter[1]!, counter[2]!, counter[3]!, key[0]!, key[1]!);
}
/** Series identity is in tile, not iteration order. Draw count is not step count. */
export function createPhiloxStream(key: StreamKey, startIndex: string | bigint = "0") {
  const seed = parseU64(key.seed), start = parseU64(startIndex);
  u32(key.kernel); u32(key.tile);
  const kernel = key.kernel, tile = key.tile;
  const k0 = Number(seed & 0xffffffffn), k1 = Number(seed >> 32n);
  let low = Number(start & 0xffffffffn), high = Number(start >> 32n);
  function reserve(count: 1 | 2) {
    if (high === 0xffffffff && low > 0xffffffff - count) throw new StreamInputError("stream-index-overflow", "This request would overflow the 64-bit draw counter; no draws were consumed.");
  }
  function nextBlock() {
    const result = block(low, high, tile, kernel, k0, k1);
    low = (low + 1) >>> 0; if (low === 0) high++;
    return result;
  }
  function uniform(): number {
    const words = nextBlock();
    // ((u64 >> 11) as f64) * 2^-53 in fs-rand, retaining all 53 bits.
    return (words[1] * 2097152 + (words[0] >>> 11)) / 9007199254740992;
  }
  return Object.freeze({
    key: Object.freeze({ seed: seed.toString(), kernel, tile }),
    get index(): bigint { return (BigInt(high) << 32n) | BigInt(low); },
    nextU64(): bigint { reserve(1); const w = nextBlock(); return (BigInt(w[1]) << 32n) | BigInt(w[0]); },
    nextF64(): number { reserve(1); return uniform(); },
    nextNormal(): number {
      reserve(2); const u = 1 - uniform(), v = uniform();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  });
}
