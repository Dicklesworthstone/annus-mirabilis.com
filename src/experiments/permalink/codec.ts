/**
 * Bounded Encoder and Decoder for Tape Schema Version 2 permalinks (?tape=).
 * Specification: am-inst-permalink-tape-s677, am-rt-control-tapes-0gc, am-rt-u64-identities-7ce
 *
 * Synchronous, with node:zlib, for the server and the tests. Pages use browserCodec.ts, which
 * compresses with CompressionStream; everything but the compression is shared in codecCore.ts.
 */

import { deflateRawSync, inflateRawSync } from "node:zlib";
import {
  bytesToBase64Url,
  decodeBase64Url,
  decodeTapeText,
  type EncodeTapeOptions,
  MAX_DECOMPRESSED_TAPE_BYTES,
  oversizeDecompressed,
  tapeBytesFrom,
  tapePayloadBytes,
  uncompressedFallback,
} from "./codecCore.ts";
import type { TapeDecodeResult, TapeV2 } from "./types.ts";

export {
  bytesToBase64Url,
  type EncodeTapeOptions,
  extractTapeParam,
  MAX_DECOMPRESSED_TAPE_BYTES,
  MAX_PERMALINK_URL_LENGTH,
} from "./codecCore.ts";

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

/**
 * Converts a Base64URL string back to a Uint8Array.
 * Throws an Error if the base64url string is malformed or contains invalid characters.
 */
export function base64UrlToBytes(base64url: string): Uint8Array {
  const bytes = decodeBase64Url(base64url);
  if (!bytes) {
    throw new Error("Invalid base64url characters.");
  }
  return bytes;
}

/**
 * Encodes a valid TapeV2 object into a Base64URL string.
 * Strictly preserves 64-bit decimal string seeds, applies deflate compression, and validates bounds.
 */
export function encodeTapePermalink(tape: TapeV2, options?: EncodeTapeOptions): string {
  return bytesToBase64Url(deflateRawSync(tapePayloadBytes(tape, options)));
}

/**
 * Decodes a tape permalink string into a validated TapeV2.
 * Automatically decompresses deflate payloads or parses raw JSON.
 * Never throws or crashes; returns a structured TapeDecodeResult.
 */
export function decodeTapePermalink(
  rawInput: string | URLSearchParams | URL | null | undefined,
): TapeDecodeResult {
  const start = tapeBytesFrom(rawInput);
  if (start.kind !== "bytes") return start;
  const bytes = start.bytes;

  // 3. Decompression (deflate) with fallback for plausibly uncompressed JSON
  let text = "";
  try {
    const decompressed = inflateRawSync(bytes, {
      maxOutputLength: MAX_DECOMPRESSED_TAPE_BYTES,
    });
    text = new TextDecoder("utf-8", { fatal: true }).decode(decompressed);
  } catch (err: unknown) {
    if (isBufferTooLargeError(err)) return oversizeDecompressed(err);
    const fallback = uncompressedFallback(bytes, err);
    if (fallback.kind !== "text") return fallback;
    text = fallback.text;
  }

  return decodeTapeText(text);
}
