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

  it("size budget enforces slim artifact limits (< 500 KB policy ceiling vs donor 4.9 MB)", async () => {
    const { evaluateSizeBudget, CHOSEN_POLICY_MAX_BYTES } = await import(
      "../../scripts/wasm-artifacts/sizeBudget.ts"
    );
    // 500 KB (500,000 bytes) is a CHOSEN policy budget constraint, NOT a measured threshold
    assert.equal(manifest.sizeBudget.maxBytes, CHOSEN_POLICY_MAX_BYTES);
    assert.equal(manifest.sizeBudget.maxBytes, 500000);
    assert.ok(manifest.sizeBudget.recordedBytes <= 500000);
    const total = manifest.sizeBudget.totalBundleBytes ?? manifest.sizeBudget.recordedBytes;
    assert.ok(total < 500000);

    const evalResult = evaluateSizeBudget(manifest.sizeBudget, manifest.wasmBytes);
    assert.equal(evalResult.passed, true);
    assert.equal(evalResult.status, "ok");
    assert.equal(evalResult.code, undefined);
  });

  describe("size budget and drift gate failure modes (am-fs-slim-artifact-0yh requirement 8)", () => {
    it("rejects fixture manifest exceeding absolute policy cap with typed code absolute-budget-exceeded", async () => {
      const { evaluateSizeBudget } = await import("../../scripts/wasm-artifacts/sizeBudget.ts");
      const fixturePath = resolve("src/testing/fixtures/wasm/manifest-exceeds-max-bytes.json");
      const fixtureManifest = JSON.parse(readFileSync(fixturePath, "utf8")) as WasmArtifactManifest;

      const result = evaluateSizeBudget(fixtureManifest.sizeBudget, fixtureManifest.wasmBytes);

      // Assert by typed code and properties, not by matching message strings
      assert.equal(result.passed, false);
      assert.equal(result.status, "absolute-budget-exceeded");
      assert.equal(result.code, "absolute-budget-exceeded");
      assert.ok(result.totalBundleBytes > result.maxBytes);
      assert.equal(result.maxBytes, 500000);
    });

    it("rejects fixture manifest exceeding 10% drift bound while under maxBytes with typed code drift-budget-exceeded", async () => {
      const { evaluateSizeBudget } = await import("../../scripts/wasm-artifacts/sizeBudget.ts");
      const fixturePath = resolve("src/testing/fixtures/wasm/manifest-exceeds-drift.json");
      const fixtureManifest = JSON.parse(readFileSync(fixturePath, "utf8")) as WasmArtifactManifest;

      const result = evaluateSizeBudget(fixtureManifest.sizeBudget, fixtureManifest.wasmBytes);

      // Assert by typed code and properties: under maxBytes, but drift exceeded
      assert.equal(result.passed, false);
      assert.equal(result.status, "drift-budget-exceeded");
      assert.equal(result.code, "drift-budget-exceeded");
      assert.ok(result.totalBundleBytes <= result.maxBytes);
      assert.ok(result.driftRatio > 0.10);
      assert.equal(result.driftRatio, 0.25); // (25000 - 20000) / 20000 = 25% drift
    });

    it("accepts valid fixture manifest under both absolute budget and 10% drift", async () => {
      const { evaluateSizeBudget } = await import("../../scripts/wasm-artifacts/sizeBudget.ts");
      const fixturePath = resolve("src/testing/fixtures/wasm/manifest-valid-budget.json");
      const fixtureManifest = JSON.parse(readFileSync(fixturePath, "utf8")) as WasmArtifactManifest;

      const result = evaluateSizeBudget(fixtureManifest.sizeBudget, fixtureManifest.wasmBytes);

      // Assert passed status and no failure code
      assert.equal(result.passed, true);
      assert.equal(result.status, "ok");
      assert.equal(result.code, undefined);
      assert.ok(result.totalBundleBytes <= result.maxBytes);
      assert.ok(result.driftRatio <= 0.10);
    });
  });
});
