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
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { createHostWorkerChannel } from "../workers/host/hostWorker.ts";
import { runProtocolConformance } from "../workers/protocol/conformance.ts";
import { loadDefaultManifest } from "../workers/protocol/provenance.ts";
import { createWasmWorkerChannel } from "../workers/wasm/wasmWorker.ts";

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

  it("hostWorker emits unregistered-alien-code and unsupported-step-kernel refusal envelopes", async () => {
    const channel = createHostWorkerChannel();

    const alienReq = {
      messageKind: "request",
      protocolVersion: 1,
      experimentId: "bm01",
      instanceId: "inst-host-refusal-1",
      runId: "run-host-refusal-1",
      actionIndex: 1,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: { _script: "emit-unregistered-refusal" },
    };
    const alienResp: any = await new Promise((resolve) => {
      channel.onmessage = (ev: any) => resolve(ev.data ?? ev);
      channel.postMessage(alienReq);
    });

    assert.equal(alienResp.messageKind, "refusal");
    assert.equal(alienResp.refusal?.code, "unregistered-alien-code");

    const kernelReq = {
      messageKind: "request",
      protocolVersion: 1,
      experimentId: "bm01",
      instanceId: "inst-host-refusal-1",
      runId: "run-host-refusal-1",
      actionIndex: 2,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: { _script: "emit-envelope" },
    };
    const kernelResp: any = await new Promise((resolve) => {
      channel.onmessage = (ev: any) => resolve(ev.data ?? ev);
      channel.postMessage(kernelReq);
    });

    assert.equal(kernelResp.refusal?.code, "unsupported-step-kernel");
    assert.match(kernelResp.refusal?.message ?? "", /Kernel 9 is unsupported/);
  });

  it("wasmWorker emits unregistered-alien-code and unsupported-step-kernel refusal envelopes", async () => {
    const channel = await createWasmWorkerChannel();

    const alienReq = {
      messageKind: "request",
      protocolVersion: 1,
      experimentId: "bm01",
      instanceId: "inst-wasm-refusal-1",
      runId: "run-wasm-refusal-1",
      actionIndex: 1,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: { _script: "emit-unregistered-refusal" },
    };
    const alienResp: any = await new Promise((resolve) => {
      channel.onmessage = (ev: any) => resolve(ev.data ?? ev);
      channel.postMessage(alienReq);
    });

    assert.equal(alienResp.messageKind, "refusal");
    assert.equal(alienResp.refusal?.code, "unregistered-alien-code");

    const kernelReq = {
      messageKind: "request",
      protocolVersion: 1,
      experimentId: "bm01",
      instanceId: "inst-wasm-refusal-1",
      runId: "run-wasm-refusal-1",
      actionIndex: 2,
      revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: { _script: "emit-envelope" },
    };
    const kernelResp: any = await new Promise((resolve) => {
      channel.onmessage = (ev: any) => resolve(ev.data ?? ev);
      channel.postMessage(kernelReq);
    });

    assert.equal(kernelResp.refusal?.code, "unsupported-step-kernel");
    assert.match(kernelResp.refusal?.message ?? "", /Kernel 9 is unsupported/);
  });
});
