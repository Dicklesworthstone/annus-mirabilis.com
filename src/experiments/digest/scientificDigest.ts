/**
 * The canonical scientific digest (am-rt-command-classes-dzp requirement 4), delivered here
 * because am-rt-control-tapes-0gc needs a working, to-spec digest for tape checkpoints before
 * that bead lands. Canonical byte encoding: fields sorted by id; canonical SI values as
 * IEEE-754 binary64 bit patterns, little-endian; 64-bit integers as fixed-width little-endian
 * (reusing the u64 identity codec, never a second one); seeds as their canonical decimal
 * strings in UTF-8 (so a seed above 2^53 is hashed from its exact digits, never from a
 * precision-losing JS number); typed arrays with an explicit layout id and shape; presentation
 * state excluded by the caller before this module ever sees it. The digest is SHA-256 over
 * those bytes via Web Crypto (available in browsers, workers, and Bun), written
 * `host:sha256:<hex>`. Host code never produces a digest labeled `blake3`.
 */
import { toU64LittleEndianBytes, type U64, type U64String } from "../identity/u64.ts";

export interface DigestFields {
  readonly [key: string]: DigestValue;
}

export interface DigestArray extends ReadonlyArray<DigestValue> {}

export type DigestValue =
  | number
  | bigint
  | U64
  | U64String
  | string
  | Uint8Array
  | Float64Array
  | Uint32Array
  | DigestArray
  | DigestFields;

const TAG = Object.freeze({
  float64: 0,
  u64: 1,
  utf8: 2,
  uint8Array: 3,
  float64Array: 4,
  uint32Array: 5,
  array: 6,
  object: 7,
});

function u32LeBytes(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, true);
  return buf;
}

function float64LeBytes(n: number): Uint8Array {
  const buf = new Uint8Array(8);
  // DataView never normalizes -0 vs +0: setFloat64 preserves the sign bit exactly.
  new DataView(buf.buffer).setFloat64(0, n, true);
  return buf;
}

function utf8LengthPrefixed(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const out = new Uint8Array(4 + bytes.length);
  out.set(u32LeBytes(bytes.length), 0);
  out.set(bytes, 4);
  return out;
}

function typedArrayBytes(
  layoutId: number,
  shape: readonly number[],
  bytes: Uint8Array,
): Uint8Array {
  const parts: Uint8Array[] = [
    Uint8Array.of(layoutId),
    u32LeBytes(shape.length),
    ...shape.map((dim) => u32LeBytes(dim)),
    u32LeBytes(bytes.length),
    bytes,
  ];
  return concatBytes(parts);
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function isU64Like(value: unknown): value is bigint {
  return typeof value === "bigint";
}

/** Encodes one value with a leading type tag, so two structurally different values (a number
 * versus its string form, a nested object versus a flattened one) can never collide. */
function encodeValue(value: DigestValue): Uint8Array {
  if (typeof value === "number") {
    return concatBytes([Uint8Array.of(TAG.float64), float64LeBytes(value)]);
  }
  if (isU64Like(value)) {
    return concatBytes([Uint8Array.of(TAG.u64), toU64LittleEndianBytes(value)]);
  }
  if (typeof value === "string") {
    return concatBytes([Uint8Array.of(TAG.utf8), utf8LengthPrefixed(value)]);
  }
  if (value instanceof Uint8Array) {
    return concatBytes([Uint8Array.of(TAG.uint8Array), typedArrayBytes(0, [value.length], value)]);
  }
  if (value instanceof Float64Array) {
    // Float64Array is host-endian in memory; re-encode each element explicitly as LE so the
    // digest never depends on host byte order.
    const le = concatBytes(Array.from(value, float64LeBytes));
    return concatBytes([Uint8Array.of(TAG.float64Array), typedArrayBytes(1, [value.length], le)]);
  }
  if (value instanceof Uint32Array) {
    const le = concatBytes(Array.from(value, u32LeBytes));
    return concatBytes([Uint8Array.of(TAG.uint32Array), typedArrayBytes(2, [value.length], le)]);
  }
  if (Array.isArray(value)) {
    const items = (value as readonly DigestValue[]).map(encodeValue);
    return concatBytes([Uint8Array.of(TAG.array), u32LeBytes(items.length), ...items]);
  }
  if (value && typeof value === "object") {
    return concatBytes([Uint8Array.of(TAG.object), encodeFields(value as DigestFields)]);
  }
  throw new TypeError(`Unsupported digest value: ${typeof value}`);
}

/** Encodes a field map sorted by key, so field order in the caller's object literal never
 * changes the digest. */
export function encodeFields(fields: DigestFields): Uint8Array {
  const keys = Object.keys(fields).sort();
  const parts: Uint8Array[] = [u32LeBytes(keys.length)];
  for (const key of keys) {
    parts.push(utf8LengthPrefixed(key));
    parts.push(encodeValue(fields[key] as DigestValue));
  }
  return concatBytes(parts);
}

export type DigestKind = "host" | "blake3";
export type Digest = Readonly<{ digest: string; digestKind: DigestKind }>;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hashes canonical fields with SHA-256 over Web Crypto and labels the result `host:sha256:`.
 * Host code never produces a `blake3:`-labeled digest; that prefix is earned only once
 * fs-blake3 is bound in the browser and actually steps. */
export async function scientificDigest(fields: DigestFields): Promise<Digest> {
  const bytes = encodeFields(fields);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Object.freeze({ digest: `host:sha256:${toHex(hashBuffer)}`, digestKind: "host" as const });
}

/** Named digest helpers (am-rt-command-classes-dzp requirement 4). Each is a thin, explicit
 * label over `scientificDigest` so a caller never has to remember which fields belong to
 * which invariant; the full invariant-checking controller is out of scope here. */
export function latentPathDigest(fields: DigestFields): Promise<Digest> {
  return scientificDigest(fields);
}
export function eventSetDigest(fields: DigestFields): Promise<Digest> {
  return scientificDigest(fields);
}
export function worldlineDigest(fields: DigestFields): Promise<Digest> {
  return scientificDigest(fields);
}
export function observationDataDigest(fields: DigestFields): Promise<Digest> {
  return scientificDigest(fields);
}
export function estimateDigest(fields: DigestFields): Promise<Digest> {
  return scientificDigest(fields);
}
