/**
 * The parts of the ?tape= codec that do not compress: bounds, Base64URL, the payload, and the JSON
 * and schema checks with their reader notices (am-inst-permalink-tape-s677).
 *
 * No node: import may enter this file. codec.ts compresses with node:zlib for the server and the
 * tests; browserCodec.ts compresses with CompressionStream for the pages. Both call these, so a link
 * one writes the other reads, and a refusal says the same thing in either.
 */
import { TapeValidationError, validateTapeV2 } from "./schema.ts";
import type { TapeDecodeResult, TapeV2 } from "./types.ts";

export const MAX_PERMALINK_URL_LENGTH = 2048;

/**
 * Maximum decompressed size of a tape payload (32 KiB).
 *
 * Provenance / Sizing Rationale:
 * A maximal valid tape payload (256 events + full initial conditions + predictions + metadata)
 * serializes to approximately 3.5–4.5 KiB of JSON. A limit of 32 KiB (32,768 bytes) provides
 * an ~8x safety ceiling for future metadata expansion while capping decompression work
 * against decompression bombs or crafted degenerate inputs.
 *
 * Measured Cost:
 * Inflating malicious or unconstrained junk at the URL-length cap (2,048 characters) without
 * an output cap was measured at ~47ms, violating the 5ms per-input bounded fuzz requirement.
 * With maxOutputLength capped at 32 KiB, inflate aborts early in < 0.2ms.
 */
export const MAX_DECOMPRESSED_TAPE_BYTES = 32 * 1024;

export type EncodeTapeOptions = Readonly<{
  includePredictions?: boolean | undefined;
}>;

/**
 * Node's Buffer, when it is the real one. A page's bundle can carry a Buffer polyfill that has no
 * base64url encoding: Chromium and WebKit threw "Unknown encoding: base64url" on the first LQ-08
 * tape link, so a present Buffer is not enough; it has to say it knows the encoding.
 */
function nodeBase64UrlBuffer(): typeof Buffer | null {
  return typeof Buffer !== "undefined" && Buffer.isEncoding?.("base64url") === true ? Buffer : null;
}

/**
 * Converts a Uint8Array to a URL-safe Base64URL string (RFC 4648 §5).
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  const Buffer = nodeBase64UrlBuffer();
  if (Buffer) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64url");
  }
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    const b = bytes[i];
    if (b !== undefined) {
      binary += String.fromCharCode(b);
    }
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A Base64URL string's bytes, or null when it holds a character outside the alphabet. */
export function decodeBase64Url(base64url: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(base64url)) return null;
  const Buffer = nodeBase64UrlBuffer();
  if (Buffer) {
    const buf = Buffer.from(base64url, "base64url");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extracts the ?tape= parameter from a URL string, query string, or direct tape parameter.
 */
export function extractTapeParam(
  source: string | URLSearchParams | URL | null | undefined,
): string | null {
  if (!source) return null;
  if (source instanceof URL) {
    return source.searchParams.get("tape");
  }
  if (source instanceof URLSearchParams) {
    return source.get("tape");
  }
  if (typeof source === "string") {
    if (source.includes("?")) {
      const q = source.replace(/^[^?]*\?/, "");
      return new URLSearchParams(q).get("tape");
    }
    if (source.startsWith("tape=")) {
      return new URLSearchParams(source).get("tape");
    }
    // Direct tape string
    return source.trim() || null;
  }
  return null;
}

/** The UTF-8 JSON bytes a tape is written as, before compression. Validates the tape first. */
export function tapePayloadBytes(tape: TapeV2, options?: EncodeTapeOptions): Uint8Array {
  const validated = validateTapeV2(tape);

  const payload: Record<string, unknown> = {
    tapeVersion: 2,
    experimentId: validated.experimentId,
    mode: validated.mode,
    modelIdentity: validated.modelIdentity,
    constantSetId: validated.constantSetId,
    seed: validated.seed,
    streamVersion: validated.streamVersion,
    allocationId: validated.allocationId,
    ...(validated.replayGrid ? { replayGrid: validated.replayGrid } : {}),
    initialConditions: validated.initialConditions,
    ...(validated.presetId ? { presetId: validated.presetId } : {}),
    events: validated.events,
    ...(validated.teachingTapeRef ? { teachingTapeRef: validated.teachingTapeRef } : {}),
    acceptedCheckpoint: validated.acceptedCheckpoint,
    ...(validated.title ? { title: validated.title } : {}),
    ...(validated.description ? { description: validated.description } : {}),
  };

  if (
    options?.includePredictions !== false &&
    validated.predictions &&
    validated.predictions.length > 0
  ) {
    payload.predictions = validated.predictions;
  }

  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * The first decode steps, which need no decompression: presence, the length bound, and Base64URL.
 * Returns the compressed bytes, or the result a reader is given instead.
 */
export function tapeBytesFrom(
  rawInput: string | URLSearchParams | URL | null | undefined,
): Readonly<{ kind: "bytes"; bytes: Uint8Array }> | TapeDecodeResult {
  const tapeParam = extractTapeParam(rawInput);
  if (!tapeParam) {
    return { kind: "absent" };
  }

  // 1. Length Bound Check (max 2048 characters)
  if (tapeParam.length > MAX_PERMALINK_URL_LENGTH) {
    return {
      kind: "invalid",
      notice:
        "This shared state could not be restored: the encoded tape exceeds the maximum size limit.",
      reason: "tape-oversize",
      details: { length: tapeParam.length, maxLength: MAX_PERMALINK_URL_LENGTH },
    };
  }

  // 2. Base64URL decoding
  const bytes = decodeBase64Url(tapeParam);
  if (!bytes) {
    return {
      kind: "invalid",
      notice: "This shared state could not be restored: invalid tape encoding or truncated link.",
      reason: "tape-malformed-encoding",
      details: { error: "Error: Invalid base64url characters." },
    };
  }
  return { kind: "bytes", bytes };
}

/** The reader's result when the decompressed tape is past MAX_DECOMPRESSED_TAPE_BYTES. */
export function oversizeDecompressed(err: unknown): TapeDecodeResult {
  return {
    kind: "invalid",
    notice:
      "This shared state could not be restored: the decompressed tape exceeds the maximum size limit.",
    reason: "tape-oversize",
    details: {
      maxBytes: MAX_DECOMPRESSED_TAPE_BYTES,
      error: String(err),
    },
  };
}

function isPlausiblyUncompressedJson(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    // Skip ASCII whitespace: space (0x20), tab (0x09), LF (0x0a), CR (0x0d)
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) {
      continue;
    }
    return b === 0x7b || b === 0x5b; // '{' or '['
  }
  return false;
}

/**
 * When inflation fails for a reason other than size: bytes that were never compressed but read as
 * JSON are admitted as text; anything else is a corrupt payload.
 */
export function uncompressedFallback(
  bytes: Uint8Array,
  err: unknown,
): Readonly<{ kind: "text"; text: string }> | TapeDecodeResult {
  // Only fall back to uncompressed raw UTF-8 if the input was plausibly uncompressed JSON
  // (starts with '{' or '[' after leading whitespace).
  if (isPlausiblyUncompressedJson(bytes)) {
    try {
      return { kind: "text", text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    } catch (decodeErr: unknown) {
      return {
        kind: "invalid",
        notice: "This shared state could not be restored: invalid character encoding.",
        reason: "tape-malformed-encoding",
        details: { error: String(decodeErr) },
      };
    }
  }
  // Genuine corrupt/malformed deflate stream
  return {
    kind: "invalid",
    notice: "This shared state could not be restored: corrupt or invalid compressed tape payload.",
    reason: "tape-malformed-encoding",
    details: { error: String(err) },
  };
}

/** The last decode steps: JSON, then the tape schema. */
export function decodeTapeText(text: string): TapeDecodeResult {
  // 4. JSON parsing
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err: unknown) {
    return {
      kind: "invalid",
      notice: "This shared state could not be restored: corrupt or non-JSON tape payload.",
      reason: "tape-malformed-json",
      details: { error: String(err) },
    };
  }

  // 5. Schema validation
  try {
    const tape = validateTapeV2(parsed);
    return {
      kind: "success",
      tape,
    };
  } catch (err: unknown) {
    if (err instanceof TapeValidationError) {
      return {
        kind: "invalid",
        notice: `This shared state could not be restored: ${err.message}`,
        reason: err.code,
        details: { path: err.path, message: err.message },
      };
    }
    return {
      kind: "invalid",
      notice: `This shared state could not be restored: ${String(err)}`,
      reason: "tape-validation-error",
      details: { error: String(err) },
    };
  }
}

/**
 * Whether an address's query carries a ?tape= link. A laboratory that also reads an older settings
 * link of its own skips it then: its decoder would call the tape's query an incomplete settings link,
 * and LQ-05, LQ-06 and LQ-07 said so under state the tape had restored.
 */
export function carriesTapeLink(search: string): boolean {
  return new URLSearchParams(search).has("tape");
}
