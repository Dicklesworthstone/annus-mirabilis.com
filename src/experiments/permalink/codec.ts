/**
 * Bounded Encoder and Decoder for Tape Schema Version 2 permalinks (?tape=).
 * Specification: am-inst-permalink-tape-s677, am-rt-control-tapes-0gc, am-rt-u64-identities-7ce
 */

import { deflateRawSync, inflateRawSync } from "node:zlib";
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

function isBufferTooLargeError(err: unknown): boolean {
  if (!err) return false;
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ERR_BUFFER_TOO_LARGE"
  ) {
    return true;
  }
  const errObj = err as { name?: string; message?: string } | null;
  if (errObj?.name === "RangeError") {
    return true;
  }
  const msg = String(err);
  return (
    msg.includes("ERR_BUFFER_TOO_LARGE") ||
    msg.includes("maxOutputLength") ||
    msg.includes("Output length exceeded") ||
    msg.includes("buffer too large") ||
    msg.includes("Buffer too large")
  );
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
 * Converts a Uint8Array to a URL-safe Base64URL string (RFC 4648 §5).
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
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

/**
 * Converts a Base64URL string back to a Uint8Array.
 * Throws an Error if the base64url string is malformed or contains invalid characters.
 */
export function base64UrlToBytes(base64url: string): Uint8Array {
  // Reject characters that are not part of Base64URL
  if (!/^[A-Za-z0-9_-]*$/.test(base64url)) {
    throw new Error("Invalid base64url characters.");
  }
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64url, "base64url");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export type EncodeTapeOptions = Readonly<{
  includePredictions?: boolean | undefined;
}>;

/**
 * Encodes a valid TapeV2 object into a Base64URL string.
 * Strictly preserves 64-bit decimal string seeds, applies deflate compression, and validates bounds.
 */
export function encodeTapePermalink(tape: TapeV2, options?: EncodeTapeOptions): string {
  // First ensure tape is valid
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

  const json = JSON.stringify(payload);
  const jsonBytes = new TextEncoder().encode(json);
  const compressedBytes = deflateRawSync(jsonBytes);
  const encoded = bytesToBase64Url(compressedBytes);

  return encoded;
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

/**
 * Decodes a tape permalink string into a validated TapeV2.
 * Automatically decompresses deflate payloads or parses raw JSON.
 * Never throws or crashes; returns a structured TapeDecodeResult.
 */
export function decodeTapePermalink(
  rawInput: string | URLSearchParams | URL | null | undefined,
): TapeDecodeResult {
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
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(tapeParam);
  } catch (err: unknown) {
    return {
      kind: "invalid",
      notice: "This shared state could not be restored: invalid tape encoding or truncated link.",
      reason: "tape-malformed-encoding",
      details: { error: String(err) },
    };
  }

  // 3. Decompression (deflate) with fallback for plausibly uncompressed JSON
  let text = "";
  try {
    const decompressed = inflateRawSync(bytes, {
      maxOutputLength: MAX_DECOMPRESSED_TAPE_BYTES,
    });
    text = new TextDecoder("utf-8", { fatal: true }).decode(decompressed);
  } catch (err: unknown) {
    if (isBufferTooLargeError(err)) {
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

    // Only fall back to uncompressed raw UTF-8 if the input was plausibly uncompressed JSON
    // (starts with '{' or '[' after leading whitespace).
    if (isPlausiblyUncompressedJson(bytes)) {
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch (decodeErr: unknown) {
        return {
          kind: "invalid",
          notice: "This shared state could not be restored: invalid character encoding.",
          reason: "tape-malformed-encoding",
          details: { error: String(decodeErr) },
        };
      }
    } else {
      // Genuine corrupt/malformed deflate stream
      return {
        kind: "invalid",
        notice:
          "This shared state could not be restored: corrupt or invalid compressed tape payload.",
        reason: "tape-malformed-encoding",
        details: { error: String(err) },
      };
    }
  }

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
