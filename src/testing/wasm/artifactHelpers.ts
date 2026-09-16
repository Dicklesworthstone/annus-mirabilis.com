/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/physics/wasmArtifacts.test.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Extracted WASM byte loading, validation, and SHA-256 digest computation helpers for test suites.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Computes lowercase SHA-256 hex digest of in-memory binary bytes.
 */
export function computeArtifactDigest(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return createHash("sha256").update(buf).digest("hex").toLowerCase();
}

/**
 * Computes lowercase SHA-256 hex digest asynchronously using standard Web Crypto or Node Crypto.
 */
export async function computeArtifactDigestAsync(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== "undefined") {
    const buf = bytes instanceof Uint8Array ? bytes.buffer : bytes;
    const hashBuf = await globalThis.crypto.subtle.digest("SHA-256", buf);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    return hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase();
  }
  return computeArtifactDigest(bytes);
}

/**
 * Validates WebAssembly binary magic bytes and format.
 */
export function validateWasmBytes(bytes: ArrayBuffer | Uint8Array): boolean {
  try {
    const buf = bytes instanceof Uint8Array ? bytes.buffer : bytes;
    return WebAssembly.validate(buf);
  } catch {
    return false;
  }
}

/**
 * Loads WASM binary bytes from a file path or URL.
 */
export async function loadWasmBytes(urlOrPath: string | URL): Promise<ArrayBuffer> {
  if (
    typeof urlOrPath === "string" &&
    !urlOrPath.startsWith("http://") &&
    !urlOrPath.startsWith("https://") &&
    !urlOrPath.startsWith("file://")
  ) {
    const buf = readFileSync(urlOrPath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const bunGlobal = (
    globalThis as unknown as {
      Bun?: { file: (path: string | URL) => { arrayBuffer: () => Promise<ArrayBuffer> } };
    }
  ).Bun;
  if (bunGlobal && typeof bunGlobal.file === "function") {
    return bunGlobal.file(urlOrPath).arrayBuffer();
  }
  if (typeof fetch !== "undefined") {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Failed to load WASM bytes from ${urlOrPath}: ${res.status}`);
    return res.arrayBuffer();
  }
  throw new Error(`Unsupported environment for loading WASM bytes from ${urlOrPath}`);
}
