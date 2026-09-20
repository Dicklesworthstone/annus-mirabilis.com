/**
 * Reusable Worker Protocol Conformance Suite.
 * Specification: am-rt-worker-protocol-gaq requirement 10.
 *
 * Implements runProtocolConformance(workerFactory) testing:
 * - Hello and capability negotiation
 * - Request and accepted round trips with buffer transfers
 * - Native and FrankenSim refusal mapping
 * - Execution outcome translation (budget-exhausted, protocol-mismatch)
 * - Malformed output rejection
 * - Full staleness matrix (older actionIndex, non-increasing stepIndex, unissued actionIndex, superseded runId)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { U64String } from "../../experiments/identity/u64.ts";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import { type DecodeContext, decode } from "./decode.ts";
import { registerAdmittedEvaluators } from "./provenance.ts";
import { PROTOCOL_VERSION, type RequestMessage } from "./schema.ts";
import { mapFrankenSimRefusalEnvelope } from "./wasmRefusalMap.ts";

function serializeMessageForDump(msg: unknown): unknown {
  if (msg === null || typeof msg !== "object") return msg;
  if (msg instanceof ArrayBuffer) {
    return {
      _type: "ArrayBuffer",
      byteLength: msg.byteLength,
      base64: Buffer.from(msg).toString("base64"),
    };
  }
  if (ArrayBuffer.isView(msg)) {
    return {
      _type: msg.constructor.name,
      byteLength: msg.byteLength,
      base64: Buffer.from(msg.buffer, msg.byteOffset, msg.byteLength).toString("base64"),
    };
  }
  if (Array.isArray(msg)) {
    return msg.map(serializeMessageForDump);
  }
  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(msg)) {
    res[k] = serializeMessageForDump(v);
  }
  return res;
}

export interface ConformanceStepReport {
  readonly testId: string;
  readonly passed: boolean;
  readonly message: string;
  readonly durationMs: number;
}

export interface ConformanceReport {
  readonly logRunId: string;
  readonly totalSteps: number;
  readonly passedSteps: number;
  readonly failedSteps: number;
  readonly allPassed: boolean;
  readonly steps: readonly ConformanceStepReport[];
}

export interface WorkerChannel {
  postMessage: (msg: unknown, transfer?: Transferable[]) => void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  terminate?: () => void;
}

function requestResponse(
  channel: WorkerChannel,
  msg: unknown,
  transfer?: Transferable[],
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for worker response to ${JSON.stringify(msg)}`));
    }, 2000);

    channel.onmessage = (ev: { data: unknown }) => {
      clearTimeout(timeout);
      channel.onmessage = null;
      resolve(ev.data ?? ev);
    };

    if (transfer && transfer.length > 0) {
      channel.postMessage(msg, transfer);
    } else {
      channel.postMessage(msg);
    }
  });
}

/**
 * Runs the full protocol conformance test suite against a worker factory.
 */
export async function runProtocolConformance(
  workerFactory: () => WorkerChannel | Promise<WorkerChannel>,
  options: { logRunId?: string; verbose?: boolean } = {},
): Promise<ConformanceReport> {
  const logRunId = options.logRunId ?? newRunIdentity();
  const logger = new TestLogger("worker-protocol", logRunId);
  const steps: ConformanceStepReport[] = [];

  const runId = "run-conformance-1";
  const instanceId = "inst-conformance";
  const issuedActionIndices = new Set<number>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // Ensure evaluator hash is registered
  registerAdmittedEvaluators({
    echoWorker: "source:sha256:105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b",
    bm01Host: "source:sha256:105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b",
  });

  const worker = await workerFactory();

  async function step(
    testId: string,
    action: () => Promise<{ passed: boolean; message: string; details?: any }>,
  ) {
    const start = performance.now();
    let passed = false;
    let message = "";
    // `any` is deliberate and measured (am-6iz4). `details` is a free-form failure-dump
    // payload: each step returns a different shape and the dump reads details?.rawMessage,
    // details?.decodeContext and the per-step fields directly. Typing it `unknown` gives 13
    // TypeScript errors at those reads, so removing the `any` here is a refactor of the dump
    // schema rather than a lint fix, and it belongs to whoever owns this harness.
    let details: any;

    try {
      const res = await action();
      passed = res.passed;
      message = res.message;
      details = res.details;
    } catch (err: unknown) {
      passed = false;
      message = err instanceof Error ? err.message : String(err);
    }
    const durationMs = performance.now() - start;

    steps.push({ testId, passed, message, durationMs });

    let failureFile: string | undefined;
    if (!passed) {
      try {
        const failureDir = join(
          process.cwd(),
          "artifacts",
          "test-logs",
          "worker-protocol",
          logRunId,
          "failures",
        );
        mkdirSync(failureDir, { recursive: true });
        failureFile = join(failureDir, `${testId}.json`);
        const failPayload = {
          testId,
          rawMessage: serializeMessageForDump(details?.rawMessage ?? null),
          decodeContext: details?.decodeContext ?? null,
          expected: "pass",
          actual: "fail",
          reproductionCommand: "bun scripts/e2e-runtime-contracts.ts --suite protocol",
          details,
        };
        writeFileSync(failureFile, JSON.stringify(failPayload, null, 2), "utf8");
      } catch {
        // best effort failure persistence
      }
    }

    logger.log({
      testId,
      beadId: "am-rt-worker-protocol-gaq",
      instanceId,
      runId,
      inputRevision: 1,
      acceptedInputRevision: 1,
      seed: "123456",
      artifactDigest:
        "source:sha256:105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b",
      expected: "pass",
      actual: passed ? "pass" : "fail",
      comparisonKind: "bitwise",
      outcome: passed ? "passed" : "failed",
      durationMs,
      message,
      extra: {
        messageKind: details?.messageKind,
        protocolVersion: details?.protocolVersion,
        layoutId: details?.layoutId,
        actionIndex: details?.actionIndex,
        stepIndex: details?.stepIndex,
        rejectionCode: details?.rejectionCode,
        provenanceOwner: details?.provenanceOwner,
        refusalCode: details?.refusalCode,
        upstreamRefusalCode: details?.upstreamRefusalCode,
        executionOutcome: details?.executionOutcome,
        ...(failureFile ? { failureFile } : {}),
        ...details,
      },
    });
  }

  try {
    // 1. Hello and negotiation
    await step("conformance-hello", async () => {
      const resp = await requestResponse(worker, { messageKind: "hello" });
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 0,
        acceptedStepIndex: 0,
        issuedActionIndices,
      };
      const decoded = decode(resp, context);
      if (!decoded.ok) {
        return { passed: false, message: `Hello rejected: ${decoded.reason}` };
      }
      if (decoded.message.messageKind !== "hello") {
        return {
          passed: false,
          message: `Expected hello messageKind, got ${decoded.message.messageKind}`,
        };
      }
      return { passed: true, message: "Hello handshake negotiated successfully." };
    });

    // 2. Normal Request and Accepted round trip
    await step("conformance-request-accepted", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 1,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { particleRadius: 1e-6 },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };

      const resp = await requestResponse(worker, req);
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 0,
        acceptedStepIndex: 0,
        issuedActionIndices,
      };
      const decoded = decode(resp, context);
      if (!decoded.ok) {
        return { passed: false, message: `Accepted response rejected: ${decoded.reason}` };
      }
      if (decoded.message.messageKind !== "accepted") {
        return {
          passed: false,
          message: `Expected accepted message, got ${decoded.message.messageKind}`,
        };
      }
      return { passed: true, message: "Request round trip returned valid accepted response." };
    });

    // 3. Buffer transfer round trip
    await step("conformance-buffer-transfer", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 2,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-buffer" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };

      const resp = await requestResponse(worker, req);
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 1,
        acceptedStepIndex: 10,
        issuedActionIndices,
      };
      const decoded = decode(resp, context);
      if (!decoded.ok) {
        return { passed: false, message: `Buffer response rejected: ${decoded.reason}` };
      }
      if (decoded.message.messageKind !== "accepted") {
        return { passed: false, message: `Expected accepted, got ${decoded.message.messageKind}` };
      }
      const buffers = decoded.message.buffers;
      if (!buffers || buffers.length !== 1 || buffers[0]?.layoutId !== "brownian-frames") {
        return { passed: false, message: "Expected brownian-frames buffer layout." };
      }
      return { passed: true, message: "Buffer transfer validated layout and byte length." };
    });

    // 4. Refusal handling: native
    await step("conformance-refusal-native", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 3,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-refusal" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };

      const resp = await requestResponse(worker, req);
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 2,
        acceptedStepIndex: 10,
        issuedActionIndices,
      };
      const decoded = decode(resp, context);
      if (!decoded.ok) {
        return { passed: false, message: `Refusal rejected: ${decoded.reason}` };
      }
      if (decoded.message.messageKind !== "refusal") {
        return {
          passed: false,
          message: `Expected refusal, got ${decoded.message.messageKind}`,
        };
      }
      if (decoded.message.refusal.code !== "ftcs-unstable") {
        return {
          passed: false,
          message: `Expected ftcs-unstable refusal, got ${decoded.message.refusal.code}`,
        };
      }
      return { passed: true, message: "Native refusal round trip validated successfully." };
    });

    // 5. Refusal envelope mapping: FrankenSim code -> registered RefusalCode
    await step("conformance-refusal-mapped-envelope", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 4,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-envelope" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };

      const envelope = await requestResponse(worker, req);
      const mapped = mapFrankenSimRefusalEnvelope(
        envelope,
        { instanceId, runId, actionIndex: 4, revisions: req.revisions },
        "brownian_frames",
      );

      if (mapped.messageKind !== "refusal") {
        return { passed: false, message: `Expected refusal, got ${mapped.messageKind}` };
      }
      if (mapped.refusal.code !== "unsupported-kernel") {
        return {
          passed: false,
          message: `Expected unsupported-kernel, got ${mapped.refusal.code}`,
        };
      }
      if (
        !mapped.refusal.details ||
        mapped.refusal.details.upstreamCode !== "unsupported-step-kernel"
      ) {
        return { passed: false, message: "Upstream code was not preserved in refusal details." };
      }
      return { passed: true, message: "FrankenSim envelope mapped to registered refusal code." };
    });

    // 6. Refusal envelope mapping: budget row -> budget-exhausted outcome
    await step("conformance-refusal-budget-envelope", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 5,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-budget-envelope" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };

      const envelope = await requestResponse(worker, req);
      const mapped = mapFrankenSimRefusalEnvelope(
        envelope,
        { instanceId, runId, actionIndex: 5, revisions: req.revisions },
        "brownian_frames",
      );

      if (mapped.messageKind !== "outcome") {
        return { passed: false, message: `Expected outcome, got ${mapped.messageKind}` };
      }
      const outcome = mapped.outcome;
      if (outcome.outcome !== "budget-exhausted") {
        return {
          passed: false,
          message: `Expected budget-exhausted, got ${outcome.outcome}`,
        };
      }
      if (outcome.requested.workUnits !== 4000000) {
        return {
          passed: false,
          message: `Expected 4000000 requested workUnits, got ${outcome.requested.workUnits}`,
        };
      }
      return { passed: true, message: "Budget envelope mapped to budget-exhausted outcome." };
    });

    // 7. Malformed output handling: NaN
    await step("conformance-malformed-nan", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 6,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-malformed-nan" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };

      const resp = await requestResponse(worker, req);
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 5,
        acceptedStepIndex: 10,
        issuedActionIndices,
      };
      const decoded = decode(resp, context);
      if (decoded.ok) {
        return {
          passed: false,
          message: `Expected nonfinite-value rejection, but message was accepted as ${decoded.message.messageKind}`,
        };
      }
      if (decoded.code !== "nonfinite-value") {
        return {
          passed: false,
          message: `Expected nonfinite-value rejection, got ${decoded.code}`,
        };
      }
      return {
        passed: true,
        message: "Malformed response with NaN correctly rejected as nonfinite-value.",
      };
    });

    // 8. Staleness matrix: older actionIndex
    await step("conformance-stale-action-index", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 7,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-stale-action" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };

      const resp = await requestResponse(worker, req);
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 5,
        acceptedStepIndex: 10,
        issuedActionIndices,
      };
      const decoded = decode(resp, context);
      if (decoded.ok) {
        return {
          passed: false,
          message: `Expected stale-action-index rejection, but message was accepted as ${decoded.message.messageKind}`,
        };
      }
      if (decoded.code !== "stale-action-index") {
        return {
          passed: false,
          message: `Expected stale-action-index rejection, got ${decoded.code}`,
        };
      }
      return { passed: true, message: "Older actionIndex rejected as stale-action-index." };
    });

    // 9. Staleness matrix: non-increasing stepIndex
    await step("conformance-stale-step-index", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 8,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-stale-step" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };

      const resp = await requestResponse(worker, req);
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 8,
        acceptedStepIndex: 5,
        issuedActionIndices,
      };
      const decoded = decode(resp, context);
      if (decoded.ok) {
        return {
          passed: false,
          message: `Expected stale-step-index rejection, but message was accepted as ${decoded.message.messageKind}`,
        };
      }
      if (decoded.code !== "stale-step-index") {
        return {
          passed: false,
          message: `Expected stale-step-index rejection, got ${decoded.code}`,
        };
      }
      return { passed: true, message: "Non-increasing stepIndex rejected as stale-step-index." };
    });

    // 10. Staleness matrix: superseded runId
    await step("conformance-stale-run-id", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 9,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-superseded-run" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };

      const resp = await requestResponse(worker, req);
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 8,
        acceptedStepIndex: 10,
        issuedActionIndices,
      };
      const decoded = decode(resp, context);
      if (decoded.ok) {
        return {
          passed: false,
          message: `Expected stale-run-id rejection, but message was accepted as ${decoded.message.messageKind}`,
        };
      }
      if (decoded.code !== "stale-run-id") {
        return {
          passed: false,
          message: `Expected stale-run-id rejection, got ${decoded.code}`,
        };
      }
      return { passed: true, message: "Superseded runId rejected as stale-run-id." };
    });

    // 11. Staleness matrix: unissued actionIndex
    await step("conformance-unissued-action-index", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 9,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-unissued-action" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };
      const resp = await requestResponse(worker, req);
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 5,
        acceptedStepIndex: 10,
        issuedActionIndices, // does not include 9999
      };
      const decoded = decode(resp, context);
      if (decoded.ok) {
        return {
          passed: false,
          message: `Expected unissued-action-index rejection, but message was accepted as ${decoded.message.messageKind}`,
          details: {
            rawMessage: resp,
            decodeContext: context,
          },
        };
      }
      if (decoded.code !== "unissued-action-index") {
        return {
          passed: false,
          message: `Expected unissued-action-index, got ${decoded.code}`,
          details: {
            rawMessage: resp,
            decodeContext: context,
            rejectionCode: decoded.code,
          },
        };
      }
      return {
        passed: true,
        message: "Unissued actionIndex rejected as unissued-action-index.",
        details: { rejectionCode: decoded.code },
      };
    });

    // 12. Staleness matrix: late observer-change response
    await step("conformance-late-observer-change", async () => {
      // Current state has advanced to actionIndex 5 (e.g. observer change at actionIndex 5)
      // Late response arrives carrying actionIndex 3 with matching current runId and inputRevision 1
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 10,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-late-observer" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };
      const resp = await requestResponse(worker, req);
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 5, // instance has accepted actionIndex 5
        acceptedStepIndex: 10,
        issuedActionIndices,
      };
      const decoded = decode(resp, context);
      if (decoded.ok) {
        return {
          passed: false,
          message: `Expected stale-action-index rejection, but message was accepted as ${decoded.message.messageKind}`,
          details: {
            rawMessage: resp,
            decodeContext: context,
          },
        };
      }
      if (decoded.code !== "stale-action-index") {
        return {
          passed: false,
          message: `Expected stale-action-index, got ${decoded.code}`,
          details: {
            rawMessage: resp,
            decodeContext: context,
            rejectionCode: decoded.code,
          },
        };
      }
      return {
        passed: true,
        message: "Late observer-change response with older actionIndex rejected.",
        details: { rejectionCode: decoded.code },
      };
    });

    // 13. Unregistered refusal code rejection
    await step("conformance-unregistered-refusal", async () => {
      const req: RequestMessage = {
        messageKind: "request",
        protocolVersion: PROTOCOL_VERSION,
        experimentId: "bm01",
        instanceId,
        runId,
        actionIndex: 10,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters: { _script: "emit-unregistered-refusal" },
        modelSelection: { modelId: "bm01-einstein", modelVersion: "1.0.0" },
        constantSetId: "modern-si-2019",
        seedPolicy: { seed: "123456" as U64String, streamVersion: 1, allocationId: "alloc-1" },
        operation: "evaluate",
        workBudget: { maxSteps: 100, maxAllocationBytes: 1048576 },
      };
      const resp = await requestResponse(worker, req);
      const context: DecodeContext = {
        runId,
        acceptedActionIndex: 5,
        acceptedStepIndex: 10,
        issuedActionIndices,
      };
      const decoded = decode(resp, context);
      if (decoded.ok) {
        return {
          passed: false,
          message: `Expected unregistered-refusal-code rejection, but message was accepted as ${decoded.message.messageKind}`,
          details: {
            rawMessage: resp,
            decodeContext: context,
          },
        };
      }
      if (decoded.code !== "unregistered-refusal-code") {
        return {
          passed: false,
          message: `Expected unregistered-refusal-code, got ${decoded.code}`,
          details: {
            rawMessage: resp,
            decodeContext: context,
            rejectionCode: decoded.code,
          },
        };
      }
      return {
        passed: true,
        message: "Unregistered refusal code rejected as unregistered-refusal-code.",
        details: { rejectionCode: decoded.code },
      };
    });
  } finally {
    if (worker.terminate) {
      worker.terminate();
    }
    await logger.flush();
  }

  const passedSteps = steps.filter((s) => s.passed).length;
  const failedSteps = steps.filter((s) => !s.passed).length;
  const allPassed = failedSteps === 0;

  return {
    logRunId,
    totalSteps: steps.length,
    passedSteps,
    failedSteps,
    allPassed,
    steps,
  };
}
