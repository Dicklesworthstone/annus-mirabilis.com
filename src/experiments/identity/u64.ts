/**
 * Canonical unsigned 64-bit decimal identities, representations, and conversions.
 * Specification: am-rt-u64-identities-7ce
 *
 * Enforces:
 * - String grammar: "0" or [1-9]\d{0,19} up to 2^64 - 1 (18446744073709551615)
 * - Strict rejection of signs, whitespace, leading zeros, exponents, floats, hex, underscores, non-ASCII digits, and JSON numbers
 * - U64 branded bigint for arithmetic and WASM boundaries
 * - U64String branded canonical string for storage, logs, snapshots, messages, and URLs
 * - Safe index projection (< 2^53) rejecting unsafe floating-point range
 * - Exact 8-byte little-endian binary codecs
 * - Ambient entropy via crypto.getRandomValues, never Math.random
 */

declare const U64Brand: unique symbol;
/** Branded BigInt representing a verified unsigned 64-bit integer [0, 2^64 - 1]. */
export type U64 = bigint & { readonly [U64Brand]: true };

declare const U64StringBrand: unique symbol;
/** Branded canonical decimal string representing a verified unsigned 64-bit integer. */
export type U64String = string & { readonly [U64StringBrand]: true };

/** Minimum valid value for a 64-bit unsigned integer (0). */
export const U64_MIN_BIGINT = 0n;

/** Maximum valid value for a 64-bit unsigned integer (2^64 - 1). */
export const U64_MAX_BIGINT = 18446744073709551615n;
export const U64_MAX = U64_MAX_BIGINT;

/** Maximum safe integer for JavaScript Number representation (2^53 - 1 = 9007199254740991). */
export const MAX_SAFE_INTEGER_BIGINT = 9007199254740991n;

/** Maximum safe index value (2^53 - 1). */
export const SAFE_INDEX_MAX_BIGINT = MAX_SAFE_INTEGER_BIGINT;

/** Canonical unsigned decimal digits pattern: "0" or nonzero ASCII digit followed by ASCII digits. */
export const U64_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)$/;

export type U64ValidationErrorCode =
  | "u64-not-string"
  | "u64-invalid-format"
  | "u64-overflow"
  | "u64-unsafe-index"
  | "u64-invalid-bytes"
  | "u64-invalid-type";

export class U64ValidationError extends Error {
  readonly code: U64ValidationErrorCode;
  readonly path: string;

  constructor(code: U64ValidationErrorCode, message: string, path = "u64") {
    super(`[${path}] ${message} (${code})`);
    this.name = "U64ValidationError";
    this.code = code;
    this.path = path;
  }
}

/**
 * Validates that the input is a canonical unsigned 64-bit decimal string.
 * Rejects JSON numbers, signs, leading zeros, whitespace, exponents, and values > 2^64 - 1.
 */
export function parseU64(raw: unknown, path = "u64"): U64String {
  if (typeof raw !== "string") {
    throw new U64ValidationError(
      "u64-not-string",
      `Expected a canonical string for 64-bit unsigned integer, received ${typeof raw}. JSON numbers lose precision above 2^53-1.`,
      path,
    );
  }

  if (!U64_DECIMAL_PATTERN.test(raw)) {
    throw new U64ValidationError(
      "u64-invalid-format",
      `"${raw}" is not a canonical unsigned 64-bit decimal string (must be digits only, no leading zeros except "0", no signs, no whitespace).`,
      path,
    );
  }

  const val = BigInt(raw);
  if (val > U64_MAX_BIGINT) {
    throw new U64ValidationError(
      "u64-overflow",
      `"${raw}" exceeds 2^64 - 1 (${U64_MAX_BIGINT.toString()}).`,
      path,
    );
  }

  return raw as U64String;
}

/** Alias for `parseU64`. */
export const validateU64String = parseU64;

/**
 * Converts a raw string or bigint to a branded `U64` bigint.
 * Rejects numbers and out-of-range bigints.
 */
export function toBigIntU64(raw: unknown, path = "u64"): U64 {
  if (typeof raw === "bigint") {
    if (raw < U64_MIN_BIGINT || raw > U64_MAX_BIGINT) {
      throw new U64ValidationError(
        "u64-overflow",
        `BigInt value ${raw.toString()} is out of unsigned 64-bit range [0, 2^64-1].`,
        path,
      );
    }
    return raw as U64;
  }

  if (typeof raw === "string") {
    parseU64(raw, path);
    return BigInt(raw) as U64;
  }

  if (typeof raw === "number") {
    throw new U64ValidationError(
      "u64-not-string",
      `Received number ${raw}. JavaScript numbers lose precision above 2^53-1; use a canonical string or BigInt.`,
      path,
    );
  }

  throw new U64ValidationError(
    "u64-invalid-type",
    `Expected string or bigint for u64, received ${typeof raw}.`,
    path,
  );
}

/**
 * Converts a valid string, bigint, or branded u64 to its canonical decimal `U64String` representation.
 */
export function toU64String(value: string | bigint | U64 | U64String): U64String {
  if (typeof value === "string") {
    return parseU64(value);
  }

  if (typeof value === "bigint") {
    if (value < U64_MIN_BIGINT || value > U64_MAX_BIGINT) {
      throw new U64ValidationError(
        "u64-overflow",
        `BigInt value ${value.toString()} is out of unsigned 64-bit range [0, 2^64-1].`,
      );
    }
    return value.toString() as U64String;
  }

  throw new U64ValidationError(
    "u64-invalid-type",
    `Expected bigint or string for toU64String, received ${typeof value}.`,
  );
}

/**
 * Formats a 64-bit unsigned integer to a canonical string.
 */
export function formatU64(value: string | bigint | U64 | U64String): string {
  return toU64String(value);
}

/**
 * Safely converts an index or counter to a JavaScript Number if and only if it is < 2^53.
 * Throws `U64ValidationError` with code `u64-unsafe-index` if value >= 2^53 (9007199254740992).
 */
export function toSafeIndex(u: string | bigint | U64 | U64String, path = "index"): number {
  const b = typeof u === "string" ? toBigIntU64(u, path) : toBigIntU64(u, path);
  if (b > MAX_SAFE_INTEGER_BIGINT) {
    throw new U64ValidationError(
      "u64-unsafe-index",
      `Index ${b.toString()} exceeds JavaScript safe integer range (2^53 - 1 = ${MAX_SAFE_INTEGER_BIGINT.toString()}).`,
      path,
    );
  }
  return Number(b);
}

/**
 * Encodes a 64-bit unsigned integer into an 8-byte Little-Endian Uint8Array.
 */
export function toU64LittleEndianBytes(u: string | bigint | U64 | U64String): Uint8Array {
  const b = toBigIntU64(u);
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer, buf.byteOffset, 8);
  view.setBigUint64(0, b, true);
  return buf;
}

/**
 * Decodes an 8-byte Little-Endian binary representation into a branded `U64` bigint.
 */
export function fromU64LittleEndianBytes(bytes: Uint8Array | ArrayBuffer): U64 {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.byteLength !== 8) {
    throw new U64ValidationError(
      "u64-invalid-bytes",
      `Expected exactly 8 bytes for u64 little-endian conversion, received ${u8.byteLength} bytes.`,
    );
  }
  const view = new DataView(u8.buffer, u8.byteOffset, 8);
  const val = view.getBigUint64(0, true);
  return val as U64;
}

/**
 * Generates a fresh random 64-bit seed using ambient entropy from `crypto.getRandomValues`.
 * Combines two 32-bit words into a canonical `U64String`.
 * `Math.random` is never used.
 */
export function randomU64Seed(): U64String {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  const w0 = words[0] ?? 0;
  const w1 = words[1] ?? 0;
  const seedBig = (BigInt(w1) << 32n) | BigInt(w0);
  return seedBig.toString() as U64String;
}
