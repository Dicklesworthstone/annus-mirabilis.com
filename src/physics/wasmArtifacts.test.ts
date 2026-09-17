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
      assert.ok(result.driftRatio > 0.1);
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
      assert.ok(result.driftRatio <= 0.1);
    });
  });

  describe("anti-RH-2 honesty and capability export invariants (am-a11y-action-contracts-n68n)", () => {
    it("manifest does not assert false build step, toolchain, wasm-pack or wasm-bindgen version", () => {
      const rawManifest = manifest as unknown as Record<string, unknown>;
      assert.equal(
        rawManifest.toolchain,
        undefined,
        "Manifest must not claim a false toolchain",
      );
      assert.equal(
        rawManifest.wasmPackVersion,
        undefined,
        "Manifest must not claim a false wasm-pack version",
      );
      assert.equal(
        rawManifest.wasmBindgenVersion,
        undefined,
        "Manifest must not claim a false wasm-bindgen version",
      );
      assert.equal(
        manifest.build?.generator,
        "scripts/wasm-artifacts/wasmArtifactGenerator.ts",
        "Manifest must truthfully identify the placeholder generator",
      );
      assert.equal(
        manifest.build?.generatorType,
        "synthetic-placeholder",
        "Manifest must truthfully label artifact as synthetic placeholder",
      );
      assert.equal(
        (manifest.build as Record<string, unknown> | undefined)?.command,
        undefined,
        "Manifest must not assert a false build command",
      );
    });

    it("every capability declared in the manifest corresponds to an actual export in the WASM binary", async () => {
      const bytes = await loadWasmBytes(wasmPath);
      const wasmModule = new WebAssembly.Module(bytes);
      const actualExports = new Set(WebAssembly.Module.exports(wasmModule).map((e) => e.name));

      for (const cap of manifest.capabilities) {
        assert.ok(
          actualExports.has(cap.browserExport),
          `Manifest declares capability "${cap.capabilityId}" with browserExport "${cap.browserExport}", but WASM binary only exports: [${Array.from(actualExports).join(", ")}]`,
        );
      }
    });

    it("export validation fails if a declared capability is missing from the WASM binary exports", async () => {
      const bytes = await loadWasmBytes(wasmPath);
      const wasmModule = new WebAssembly.Module(bytes);
      const actualExports = new Set(WebAssembly.Module.exports(wasmModule).map((e) => e.name));

      function validateCapabilitiesAgainstWasm(
        caps: readonly { capabilityId: string; browserExport: string }[],
        exportsSet: Set<string>,
      ): void {
        for (const cap of caps) {
          if (!exportsSet.has(cap.browserExport)) {
            throw new Error(
              `Missing export: capability "${cap.capabilityId}" requires "${cap.browserExport}", which is absent from WASM exports [${Array.from(exportsSet).join(", ")}]`,
            );
          }
        }
      }

      // Must validate cleanly for active manifest
      assert.doesNotThrow(() =>
        validateCapabilitiesAgainstWasm(manifest.capabilities, actualExports),
      );

      // Must throw for unexported capabilities (e.g. brownian_frames or bogus export)
      assert.throws(
        () =>
          validateCapabilitiesAgainstWasm(
            [{ capabilityId: "diffusion.brownian-frames", browserExport: "brownian_frames" }],
            actualExports,
          ),
        /Missing export: capability "diffusion\.brownian-frames" requires "brownian_frames"/,
      );
      assert.throws(
        () =>
          validateCapabilitiesAgainstWasm(
            [{ capabilityId: "bogus.cap", browserExport: "bogus_missing_export" }],
            actualExports,
          ),
        /Missing export: capability "bogus\.cap" requires "bogus_missing_export"/,
      );
    });

    it("acceptanceState: owner-decided is not claimed for unaccepted capabilities", () => {
      for (const cap of manifest.capabilities) {
        assert.notEqual(
          cap.acceptanceState,
          "owner-decided",
          `Capability "${cap.capabilityId}" falsely asserts acceptanceState "owner-decided"`,
        );
      }
    });

    it("no instrument reports WASM provenance or FrankenSim execution from this placeholder stub", async () => {
      const { OWNER_BINDINGS } = await import("../experiments/owners.ts");
      for (const [id, binding] of Object.entries(OWNER_BINDINGS)) {
        assert.notEqual(
          binding?.kind,
          "frankensim",
          `Instrument ${id} falsely claims "frankensim" owner binding`,
        );
      }

      const { createInitialCoverageSummary } = await import(
        "../content/coverage/coverageManifest.ts"
      );
      const coverage = createInitialCoverageSummary();
      assert.equal(coverage.genericWasm, 0);
      assert.equal(coverage.experimentSpecificWasm, 0);
    });
  });
});
