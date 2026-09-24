/**
 * WASM Artifact Verification Test Suite (am-fs-slim-artifact-0yh requirement 7).
 *
 * Adapted from classic-patents.com wasmArtifacts.test.ts.
 * Uses helper utilities strictly imported from src/testing/wasm/artifactHelpers.ts.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { runWasmVerification } from "../../scripts/verify-wasm-artifacts.ts";
import {
  computeArtifactDigest,
  loadWasmBytes,
  validateWasmBytes,
} from "../testing/wasm/artifactHelpers.ts";
import type { WasmArtifactManifest } from "../workers/protocol/provenance.ts";

describe("WASM Artifact Verification Suite", () => {
  const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
  const manifestPath = resolve("public/wasm/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as WasmArtifactManifest;
  const wasmPath = resolve(
    "public/wasm",
    manifest.bundleId,
    manifest.hashPrefix,
    "fs_annus_diffusion_bg.wasm",
  );

  it("runs the full verification script gate checks and passes all 10 checks", async () => {
    const result = await runWasmVerification();
    assert.equal(result.passed, true);
    assert.ok(result.checks.length >= 10);
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
      // Repinned from the synthetic placeholder to the compiled artifact
      // (am-frankensim-repin-and-bind-jvhg). The assertion is unchanged: every build claim the
      // manifest makes is true. What is true changed. Each claimed value is now read back from
      // the file that decides it, and nothing the build did not use is claimed.
      const rawManifest = manifest as unknown as Record<string, unknown>;
      const crate = resolve("scripts/wasm-artifacts/fs-annus-wasm");
      const channel = readFileSync(join(crate, "rust-toolchain.toml"), "utf8").match(
        /^channel = "([^"]+)"/m,
      )?.[1];
      assert.equal(rawManifest.toolchain, channel, "Manifest must not claim a false toolchain");
      assert.equal(
        rawManifest.wasmPackVersion,
        undefined,
        "Manifest must not claim a false wasm-pack version (wasm-pack is not used)",
      );
      const lock = readFileSync(join(crate, "Cargo.lock"), "utf8");
      assert.ok(
        lock.includes(
          `name = "wasm-bindgen"\nversion = "${String(rawManifest.wasmBindgenVersion)}"`,
        ),
        "Manifest must not claim a false wasm-bindgen version",
      );
      assert.equal(
        manifest.build?.generator,
        "scripts/wasm-artifacts/fs-annus-wasm",
        "Manifest must truthfully identify the crate that built the artifact",
      );
      assert.equal(
        manifest.build?.generatorType,
        "rust-wasm-bindgen",
        "Manifest must truthfully label the artifact as a compiled Rust build",
      );
      const command = (manifest.build as Record<string, unknown> | undefined)?.command;
      assert.match(
        String(command),
        /^cargo build --release --locked --target wasm32-unknown-unknown .*wasm-bindgen --target web/,
        "Manifest must not assert a false build command",
      );
      const pins = readFileSync(join(crate, "src/pins.rs"), "utf8");
      assert.ok(
        pins.includes(`FRANKENSIM_REVISION: &str = "${manifest.revisions.frankensim}"`),
        "Manifest must not claim a FrankenSim revision the crate does not pin",
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

      // Must throw for unexported capabilities. Repinned: the placeholder lacked brownian_frames;
      // the compiled artifact exports it but not brownian_frames_window.
      assert.equal(actualExports.has("brownian_frames"), true);
      assert.throws(
        () =>
          validateCapabilitiesAgainstWasm(
            [
              {
                capabilityId: "diffusion.brownian-frames-window",
                browserExport: "brownian_frames_window",
              },
            ],
            actualExports,
          ),
        /Missing export: capability "diffusion\.brownian-frames-window" requires "brownian_frames_window"/,
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

    it("acceptanceState: no capability claims more acceptance than its matrix row records", async () => {
      // Repinned. With the placeholder, capabilities was [] and any "owner-decided" would have
      // been a claim about capabilities that did not exist. The compiled artifact declares the
      // three it exports, copying their rows' state, owner-decided (docs/FRANKENSIM_BINDING.md
      // family 3). The assertion is still that no acceptance is overclaimed. The states that
      // need evidence, verified and adopted, stay unclaimed, and each state equals its row's.
      const { parseCapabilityMatrix } = await import(
        "../../scripts/wasm-artifacts/capabilityMatrix.ts"
      );
      const matrix = parseCapabilityMatrix(
        readFileSync(resolve("docs/FRANKENSIM_BINDING.md"), "utf8"),
      );
      assert.ok(manifest.capabilities.length > 0);
      for (const cap of manifest.capabilities) {
        assert.ok(
          !["verified", "adopted"].includes(cap.acceptanceState),
          `Capability "${cap.capabilityId}" claims "${cap.acceptanceState}" without evidence`,
        );
        const row = matrix.find((r) => r.capabilityId === cap.capabilityId);
        assert.equal(cap.acceptanceState, row?.acceptanceState, cap.capabilityId);
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

  describe("quality gate registration, failure evidence, and protocol buffer validation", () => {
    it("quality gate registry registers verify-wasm-artifacts with owner am-fs-slim-artifact-0yh", async () => {
      const { QUALITY_GATE_STEPS } = await import("../../scripts/quality-gates/registry.ts");
      const step = QUALITY_GATE_STEPS.find((s) => s.id === "verify-wasm-artifacts");
      assert.ok(step, "verify-wasm-artifacts step must be registered in QUALITY_GATE_STEPS");
      assert.equal(step.owner, "am-fs-slim-artifact-0yh");
      assert.equal(step.family, "fast");
      assert.equal(step.requiredInCi, true);
      assert.deepEqual(step.requiredInProfiles, ["preview", "launch"]);
      assert.equal(step.availability.scriptPath, "scripts/verify-wasm-artifacts.ts");
    });

    it("a deliberately failing check writes its failure evidence file and returns passed: false", async () => {
      const tempDir = mkdtempSync(join(tempBase, "verify-fail-"));
      const fakeManifestPath = join(tempDir, "fake-manifest.json");
      // Create a manifest with a deliberately corrupted digest
      const fakeManifest = {
        ...manifest,
        wasmDigest: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        files: {
          ...manifest.files,
          "fs_annus_diffusion_bg.wasm": {
            sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            bytes: manifest.wasmBytes,
          },
        },
      };
      writeFileSync(fakeManifestPath, JSON.stringify(fakeManifest, null, 2), "utf8");

      const result = await runWasmVerification({ manifestPath: fakeManifestPath });
      assert.equal(result.passed, false);
      const failedCheck = result.checks.find((c) => !c.passed);
      assert.ok(failedCheck, "At least one check must fail");

      // Verify failure evidence file was written to artifacts/test-logs/wasm-artifacts/<logRunId>/failures/<testId>.json
      const failureEvidencePath = resolve(
        "artifacts/test-logs/wasm-artifacts",
        result.logRunId,
        "failures",
        `${failedCheck.testId}.json`,
      );
      assert.equal(existsSync(failureEvidencePath), true, "Failure evidence file must exist");
      const evidence = JSON.parse(readFileSync(failureEvidencePath, "utf8"));
      assert.equal(evidence.bundleId, "fs-annus-diffusion");
      assert.equal(evidence.testId, failedCheck.testId);
      assert.ok(evidence.reproductionCommand);
      assert.ok("expectedDigest" in evidence);
      assert.ok("actualDigest" in evidence);
    });

    it("validateProtocolBuffer strictly rejects truncated buffers, nonfinite values, and shape mismatches", async () => {
      const { validateProtocolBuffer } = await import("../../scripts/verify-wasm-artifacts.ts");
      const validBuf = new Float64Array([1.0, 2.0, 3.0, 4.0]);
      const layout = {
        layoutId: "brownian-frames" as const,
        version: 1 as const,
        shape: [2, 2],
      };

      // Valid buffer passes
      assert.equal(validateProtocolBuffer(validBuf, layout).valid, true);

      // Truncated by 8 bytes (1 Float64 element fewer than declared shape)
      const truncated = new Float64Array([1.0, 2.0, 3.0]);
      assert.equal(validateProtocolBuffer(truncated, layout).valid, false);

      // Nonfinite values (NaN, Infinity, -Infinity)
      const nanBuf = new Float64Array([1.0, Number.NaN, 3.0, 4.0]);
      assert.equal(validateProtocolBuffer(nanBuf, layout).valid, false);

      const infBuf = new Float64Array([1.0, Number.POSITIVE_INFINITY, 3.0, 4.0]);
      assert.equal(validateProtocolBuffer(infBuf, layout).valid, false);

      const negInfBuf = new Float64Array([1.0, 2.0, Number.NEGATIVE_INFINITY, 4.0]);
      assert.equal(validateProtocolBuffer(negInfBuf, layout).valid, false);

      // Relabeled with wrong shape
      assert.equal(
        validateProtocolBuffer(validBuf, {
          layoutId: "brownian-frames",
          version: 1,
          shape: [2, 3],
        }).valid,
        false,
      );
    });
  });
});
