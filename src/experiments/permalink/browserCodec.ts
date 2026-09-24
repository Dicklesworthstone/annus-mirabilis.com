/**
 * The ?tape= codec for pages (am-inst-permalink-tape-s677).
 *
 * codec.ts compresses with node:zlib, which no browser has, so until this file a page could neither
 * write nor read a tape: 0 of 33 laboratories restored one. This one compresses with the built-in
 * CompressionStream("deflate-raw") and shares every other step with codec.ts through codecCore.ts,
 * so the same link decodes the same way on the server, in the tests and in a reader's browser.
 */
import {
  bytesToBase64Url,
  decodeTapeText,
  type EncodeTapeOptions,
  MAX_DECOMPRESSED_TAPE_BYTES,
  oversizeDecompressed,
  tapeBytesFrom,
  tapePayloadBytes,
  uncompressedFallback,
} from "./codecCore.ts";
import type { TapeDecodeResult, TapeV2 } from "./types.ts";

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inflates, stopping as soon as the output passes the cap, as node's maxOutputLength does. */
async function inflateRawCapped(
  bytes: Uint8Array,
  cap: number,
): Promise<Readonly<{ kind: "bytes"; bytes: Uint8Array }> | Readonly<{ kind: "too-large" }>> {
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      return { kind: "too-large" };
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { kind: "bytes", bytes: out };
}

/** encodeTapePermalink for a page: the same Base64URL text codec.ts writes for the same tape. */
export async function encodeTapePermalinkInBrowser(
  tape: TapeV2,
  options?: EncodeTapeOptions,
): Promise<string> {
  return bytesToBase64Url(await deflateRaw(tapePayloadBytes(tape, options)));
}

/** decodeTapePermalink for a page. Never throws; every failure is a result with a notice. */
export async function decodeTapePermalinkInBrowser(
  rawInput: string | URLSearchParams | URL | null | undefined,
): Promise<TapeDecodeResult> {
  const start = tapeBytesFrom(rawInput);
  if (start.kind !== "bytes") return start;
  const bytes = start.bytes;

  let text = "";
  try {
    const inflated = await inflateRawCapped(bytes, MAX_DECOMPRESSED_TAPE_BYTES);
    if (inflated.kind === "too-large") {
      return oversizeDecompressed(`Output length exceeded ${MAX_DECOMPRESSED_TAPE_BYTES} bytes.`);
    }
    text = new TextDecoder("utf-8", { fatal: true }).decode(inflated.bytes);
  } catch (err: unknown) {
    const fallback = uncompressedFallback(bytes, err);
    if (fallback.kind !== "text") return fallback;
    text = fallback.text;
  }

  return decodeTapeText(text);
}
