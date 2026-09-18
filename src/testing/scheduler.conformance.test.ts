/**
 * Dedicated-Worker Scheduler Protocol Conformance Test Suite.
 * Specification: am-rt-worker-scheduler-7tl requirement 3, AC 9, and Test Plan.
 *
 * Runs runProtocolConformance against:
 * 1. src/workers/host/hostWorker.ts (production host reference worker)
 * 2. src/workers/wasm/wasmWorker.ts (production WASM worker loading pinned slim artifact)
 *
 * Verifies all 12 conformance steps pass and pre-instantiation digest verification is enforced.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runProtocolConformance } from "../workers/protocol/conformance.ts";
import { createHostWorkerChannel } from "../workers/host/hostWorker.ts";
import { createWasmWorkerChannel } from "../workers/wasm/wasmWorker.ts";
import { loadDefaultManifest } from "../workers/protocol/provenance.ts";
import { resolve } from "node:path";

describe("scheduler.conformance", () => {
  it("runs full protocol conformance suite against hostWorker and passes all 12 steps", async () => {
    const report = await runProtocolConformance(() => createHostWorkerChannel(), {
      verbose: false,
    });

    assert.equal(
      report.allPassed,
      true,
      `hostWorker conformance failed on steps: ${report.steps
        .filter((s) => !s.passed)
        .map((s) => `${s.testId}: ${s.message}`)
        .join("; ")}`,
    );

    assert.equal(report.failedSteps, 0);
    assert.ok(report.totalSteps >= 12, `Expected at least 12 steps, got ${report.totalSteps}`);

    for (const step of report.steps) {
      assert.equal(step.passed, true, `Step ${step.testId} failed: ${step.message}`);
    }
  });

  it("runs full protocol conformance suite against wasmWorker with pinned artifact and passes all 12 steps", async () => {
    const report = await runProtocolConformance(async () => createWasmWorkerChannel(), {
      verbose: false,
    });

    assert.equal(
      report.allPassed,
      true,
      `wasmWorker conformance failed on steps: ${report.steps
        .filter((s) => !s.passed)
        .map((s) => `${s.testId}: ${s.message}`)
        .join("; ")}`,
    );

    assert.equal(report.failedSteps, 0);
    assert.ok(report.totalSteps >= 12, `Expected at least 12 steps, got ${report.totalSteps}`);

    for (const step of report.steps) {
      assert.equal(step.passed, true, `Step ${step.testId} failed: ${step.message}`);
    }
  });

  it("verifies wasmWorker pre-instantiation digest verification refuses tampered artifact", async () => {
    const manifest = loadDefaultManifest(process.cwd());
    assert.ok(manifest, "Default manifest must be loaded");

    // Tampered manifest with wrong digest
    const tamperedManifest = {
      ...manifest,
      wasmDigest: "deadbeef00000000000000000000000000000000000000000000000000000000",
    };

    const wasmPath = resolve(
      process.cwd(),
      "public/wasm",
      manifest.bundleId,
      manifest.hashPrefix,
      "fs_annus_diffusion_bg.wasm",
    );

    await assert.rejects(
      async () => {
        await createWasmWorkerChannel({
          manifestData: tamperedManifest,
          wasmUrl: wasmPath,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /artifact-mismatch/);
        return true;
      },
      "Must reject tampered artifact before creating worker channel",
    );
  });
});
