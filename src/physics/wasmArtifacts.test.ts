/**
 * WASM Artifact Verification Test Suite (am-fs-slim-artifact-0yh requirement 7).
 *
 * Adapted from classic-patents.com wasmArtifacts.test.ts.
 * Uses helper utilities strictly imported from src/testing/wasm/artifactHelpers.ts.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { runWasmVerification } from "../../scripts/verify-wasm-artifacts.ts";
import {
  computeArtifactDigest,
  loadWasmBytes,
  validateWasmBytes,
} from "../testing/wasm/artifactHelpers.ts";
import type { WasmArtifactManifest } from "../workers/protocol/provenance.ts";

describe("WASM Artifact Verification Suite", () => {
  const manifestPath = resolve("public/wasm/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as WasmArtifactManifest;
  const wasmPath = resolve(
    "public/wasm",
    manifest.bundleId,
    manifest.hashPrefix,
    "fs_annus_diffusion_bg.wasm",
  );

  it("runs the full verification script gate checks and passes all 9 checks", async () => {
    const result = await runWasmVerification();
    assert.equal(result.passed, true);
    assert.ok(result.checks.length >= 9);
    for (const check of result.checks) {
      assert.equal(check.passed, true, `Check ${check.testId} failed: ${check.message}`);
    }
  });

  it("WASM binary magic header and format validate with WebAssembly.validate", async () => {
    const bytes = await loadWasmBytes(wasmPath);
    assert.equal(validateWasmBytes(bytes), true);
    const digest = computeArtifactDigest(bytes);
    assert.equal(digest.toLowerCase(), manifest.wasmDigest.toLowerCase());
  });

  it("size budget enforces slim artifact limits (< 500 KB vs donor 4.9 MB)", () => {
    assert.equal(manifest.sizeBudget.maxBytes, 500000);
    assert.ok(manifest.sizeBudget.recordedBytes <= 500000);
    const total = manifest.sizeBudget.totalBundleBytes ?? manifest.sizeBudget.recordedBytes;
    assert.ok(total < 500000);
  });
});
