import { describe, expect, test } from "bun:test";
import { appendExtractionLog, newExtractionLogRunId } from "../extractionLogging.ts";
import {
  computeArtifactDigest,
  computeArtifactDigestAsync,
  validateWasmBytes,
} from "./artifactHelpers.ts";

const logRunId = newExtractionLogRunId();

describe("WASM Artifact Test Helpers", () => {
  test("the digest helper computes lowercase SHA-256 of fixed in-memory bytes and a one-byte change alters the digest", async () => {
    const start = performance.now();
    // 4 fixed bytes [1, 2, 3, 4]
    const bytesA = new Uint8Array([1, 2, 3, 4]);
    const digestA = computeArtifactDigest(bytesA);
    const digestAsyncA = await computeArtifactDigestAsync(bytesA);

    // Known SHA-256 of Uint8Array([1, 2, 3, 4])
    expect(digestA).toBe("9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a");
    expect(digestA).toBe(digestA.toLowerCase());
    expect(digestAsyncA).toBe(digestA);

    // One-byte change [1, 2, 3, 5]
    const bytesB = new Uint8Array([1, 2, 3, 5]);
    const digestB = computeArtifactDigest(bytesB);
    expect(digestB).not.toBe(digestA);
    expect(digestB).toBe(digestB.toLowerCase());

    appendExtractionLog({
      logRunId,
      testId: "artifact-helpers-digest-computation",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "computeArtifactDigest produces exact lowercase SHA-256 digest; single-byte change alters digest",
      expected: "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
      actual: digestA,
      comparisonKind: "bitwise",
    });
  });

  test("validateWasmBytes validates WebAssembly binary headers", () => {
    const start = performance.now();
    // Valid minimal WASM module binary (magic bytes '\0asm\1\0\0\0')
    const minimalWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    expect(validateWasmBytes(minimalWasm)).toBe(true);

    // Invalid non-WASM bytes
    const invalidBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    expect(validateWasmBytes(invalidBytes)).toBe(false);

    appendExtractionLog({
      logRunId,
      testId: "artifact-helpers-validate-wasm-bytes",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "validateWasmBytes correctly validates WASM module header",
    });
  });
});
