/**
 * Strict, Context-Aware Worker Protocol Decoder.
 * Specification: am-rt-worker-protocol-gaq requirements 7 and 8.
 *
 * Implements:
 * - Strict schema validation with no unknown top-level fields
 * - Context-aware staleness matrix enforcement (runId, actionIndex, stepIndex, issuedActionIndices)
 * - Deep non-finite number detection (NaN, Infinity, -Infinity)
 * - Canonical U64String seed enforcement (rejection of JSON numbers in seeds)
 * - Provenance validation against manifest and host evaluator registries
 * - Typed buffer layout, shape, and byteLength verification
 * - Unit verification against declared quantity contracts
 * - Refusal code registration verification
 */

import { validateU64String } from "../../experiments/identity/u64.ts";
import {
  type ExecutionOutcome,
  executionOutcomeRegistry,
} from "../../experiments/results/outcomes.ts";
import { refusalCodeRegistry } from "../../experiments/results/refusalCodes.ts";
import { validateBufferHeader } from "./buffers.ts";
import { validateProvenanceRecord } from "./provenance.ts";
import {
  ACCEPTED_ALLOWED_KEYS,
  findUnknownKeys,
  HELLO_ALLOWED_KEYS,
  type HelloMessage,
  isFiniteNumber,
  isPlainObject,
  OUTCOME_ALLOWED_KEYS,
  type OutcomeResponse,
  PROTOCOL_VERSION,
  REFUSAL_ALLOWED_KEYS,
  REQUEST_ALLOWED_KEYS,
  type RefusalResponse,
  type RequestMessage,
  type WorkerMessage,
} from "./schema.ts";

export type DecodeRejectionCode =
  | "malformed-response"
  | "missing-identity"
  | "unknown-field"
  | "protocol-mismatch"
  | "stale-run-id"
  | "stale-action-index"
  | "stale-step-index"
  | "unissued-action-index"
  | "nonfinite-value"
  | "buffer-length-mismatch"
  | "buffer-shape-mismatch"
  | "unknown-layout"
  | "unit-mismatch"
  | "invalid-u64-seed"
  | "unregistered-refusal-code"
  | "unadmitted-digest"
  | "unadmitted-capability"
  | "unadmitted-evaluator"
  | "environment-unsupported";

export interface DecodeContext {
  readonly runId: string;
  readonly acceptedActionIndex: number;
  readonly acceptedStepIndex: number;
  readonly issuedActionIndices: ReadonlySet<number>;
  readonly expectedProtocolVersion?: number;
  readonly expectedUnits?: Readonly<Record<string, string>>;
}

export type DecodeResult =
  | { readonly ok: true; readonly message: WorkerMessage }
  | {
      readonly ok: false;
      readonly code: DecodeRejectionCode;
      readonly reason: string;
      readonly outcome?: ExecutionOutcome;
    };

function containsNonFinite(val: unknown): boolean {
  if (typeof val === "number") {
    return !Number.isFinite(val);
  }
  if (val === null || typeof val !== "object") {
    return false;
  }
  if (Array.isArray(val)) {
    return val.some(containsNonFinite);
  }
  if (val instanceof Float64Array || val instanceof Float32Array) {
    for (let i = 0; i < val.length; i++) {
      const v = val[i];
      if (v === undefined || !Number.isFinite(v)) return true;
    }
    return false;
  }
  for (const v of Object.values(val as Record<string, unknown>)) {
    if (containsNonFinite(v)) return true;
  }
  return false;
}

/**
 * Strict context-aware decoder for worker messages.
 */
export function decode(message: unknown, context: DecodeContext): DecodeResult {
  if (!isPlainObject(message)) {
    return {
      ok: false,
      code: "malformed-response",
      reason: "Message must be a plain JavaScript object.",
      outcome: {
        outcome: "malformed-response",
        message: executionOutcomeRegistry["malformed-response"].message,
        retry: "new-run",
      },
    };
  }

  const { messageKind } = message;
  if (typeof messageKind !== "string") {
    return {
      ok: false,
      code: "malformed-response",
      reason: 'Message is missing required "messageKind" field.',
    };
  }

  // 1. HELLO MESSAGE
  if (messageKind === "hello") {
    const unknownKeys = findUnknownKeys(message, HELLO_ALLOWED_KEYS);
    if (unknownKeys.length > 0) {
      return {
        ok: false,
        code: "unknown-field",
        reason: `Unknown field(s) in hello message: ${unknownKeys.join(", ")}`,
      };
    }
    const { protocolVersion, supportedLayouts, ownerKind, provenanceSet } = message;

    const expectedVersion = context.expectedProtocolVersion ?? PROTOCOL_VERSION;
    const isVersionSupported = Array.isArray(protocolVersion)
      ? protocolVersion.includes(expectedVersion)
      : protocolVersion === expectedVersion;

    if (!isVersionSupported) {
      return {
        ok: false,
        code: "protocol-mismatch",
        reason: `Worker protocol version ${JSON.stringify(protocolVersion)} does not match expected version ${expectedVersion}.`,
        outcome: {
          outcome: "protocol-mismatch",
          message: executionOutcomeRegistry["protocol-mismatch"].message,
          retry: "reload",
        },
      };
    }

    if (!Array.isArray(supportedLayouts) || !supportedLayouts.every((l) => typeof l === "string")) {
      return {
        ok: false,
        code: "malformed-response",
        reason: "supportedLayouts must be an array of strings.",
      };
    }

    if (ownerKind !== "frankensim" && ownerKind !== "host-reference") {
      return {
        ok: false,
        code: "malformed-response",
        reason: 'ownerKind must be "frankensim" or "host-reference".',
      };
    }

    if (!Array.isArray(provenanceSet) || !provenanceSet.every((p) => typeof p === "string")) {
      return {
        ok: false,
        code: "malformed-response",
        reason: "provenanceSet must be an array of strings.",
      };
    }

    return { ok: true, message: message as unknown as HelloMessage };
  }

  // 2. REQUEST MESSAGE
  if (messageKind === "request") {
    const unknownKeys = findUnknownKeys(message, REQUEST_ALLOWED_KEYS);
    if (unknownKeys.length > 0) {
      return {
        ok: false,
        code: "unknown-field",
        reason: `Unknown field(s) in request message: ${unknownKeys.join(", ")}`,
      };
    }

    const {
      protocolVersion,
      experimentId,
      instanceId,
      runId,
      actionIndex,
      revisions,
      parameters,
      seedPolicy,
      operation,
      workBudget,
    } = message;

    const expectedVersion = context.expectedProtocolVersion ?? PROTOCOL_VERSION;
    if (protocolVersion !== expectedVersion) {
      return {
        ok: false,
        code: "protocol-mismatch",
        reason: `Request protocolVersion ${protocolVersion} does not match expected ${expectedVersion}.`,
      };
    }

    if (typeof instanceId !== "string" || !instanceId) {
      return { ok: false, code: "missing-identity", reason: 'Missing or empty "instanceId".' };
    }
    if (typeof runId !== "string" || !runId) {
      return { ok: false, code: "missing-identity", reason: 'Missing or empty "runId".' };
    }
    if (typeof actionIndex !== "number") {
      return { ok: false, code: "missing-identity", reason: 'Missing "actionIndex".' };
    }

    // Seed check
    if (seedPolicy && typeof seedPolicy === "object") {
      const rawSeed = (seedPolicy as any).seed;
      if (typeof rawSeed === "number") {
        return {
          ok: false,
          code: "invalid-u64-seed",
          reason: "Seed must be a canonical U64 decimal string, not a JSON number.",
        };
      }
      if (typeof rawSeed !== "string" || !validateU64String(rawSeed)) {
        return {
          ok: false,
          code: "invalid-u64-seed",
          reason: `Invalid canonical U64 seed: "${rawSeed}".`,
        };
      }
    }

    if (containsNonFinite(parameters)) {
      return {
        ok: false,
        code: "nonfinite-value",
        reason: "Parameters contain non-finite numbers.",
      };
    }

    return { ok: true, message: message as unknown as RequestMessage };
  }

  // 3. COMMON IDENTITY & STALENESS CHECKS FOR RESPONSES (accepted, refusal, outcome)
  const allowedKeysMap: Record<string, Set<string>> = {
    accepted: ACCEPTED_ALLOWED_KEYS,
    refusal: REFUSAL_ALLOWED_KEYS,
    outcome: OUTCOME_ALLOWED_KEYS,
  };

  const allowed = allowedKeysMap[messageKind];
  if (!allowed) {
    return {
      ok: false,
      code: "malformed-response",
      reason: `Unknown messageKind: "${messageKind}".`,
    };
  }

  const unknownKeys = findUnknownKeys(message, allowed);
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      code: "unknown-field",
      reason: `Unknown field(s) in ${messageKind} message: ${unknownKeys.join(", ")}`,
    };
  }

  const { instanceId, runId, actionIndex, revisions } = message;

  if (typeof instanceId !== "string" || !instanceId.trim()) {
    return { ok: false, code: "missing-identity", reason: 'Missing or empty "instanceId".' };
  }
  if (typeof runId !== "string" || !runId.trim()) {
    return { ok: false, code: "missing-identity", reason: 'Missing or empty "runId".' };
  }
  if (typeof actionIndex !== "number" || !Number.isInteger(actionIndex)) {
    return { ok: false, code: "missing-identity", reason: 'Missing or non-integer "actionIndex".' };
  }
  if (!isPlainObject(revisions)) {
    return { ok: false, code: "missing-identity", reason: 'Missing "revisions" object.' };
  }

  // Staleness check 1: superseded runId
  if (runId !== context.runId) {
    return {
      ok: false,
      code: "stale-run-id",
      reason: `Message runId "${runId}" is superseded by active runId "${context.runId}".`,
    };
  }

  // Staleness check 2: unissued actionIndex
  if (!context.issuedActionIndices.has(actionIndex)) {
    return {
      ok: false,
      code: "unissued-action-index",
      reason: `actionIndex ${actionIndex} was never issued for this instance.`,
    };
  }

  // Staleness check 3: older actionIndex
  if (actionIndex < context.acceptedActionIndex) {
    return {
      ok: false,
      code: "stale-action-index",
      reason: `actionIndex ${actionIndex} is older than acceptedActionIndex ${context.acceptedActionIndex}.`,
    };
  }

  // 4. ACCEPTED RESPONSE
  if (messageKind === "accepted") {
    const { stepIndex, outputs, provenance, buffers, acceptedParameters, simulatedTime } = message;

    if (typeof stepIndex !== "number" || !Number.isInteger(stepIndex)) {
      return { ok: false, code: "malformed-response", reason: 'Missing or invalid "stepIndex".' };
    }

    // Staleness check 4: equal actionIndex with non-increasing stepIndex
    if (actionIndex === context.acceptedActionIndex && stepIndex <= context.acceptedStepIndex) {
      return {
        ok: false,
        code: "stale-step-index",
        reason: `stepIndex ${stepIndex} is not greater than acceptedStepIndex ${context.acceptedStepIndex} for actionIndex ${actionIndex}.`,
      };
    }

    // Nonfinite check
    if (
      containsNonFinite(acceptedParameters) ||
      containsNonFinite(simulatedTime) ||
      containsNonFinite(outputs)
    ) {
      return {
        ok: false,
        code: "nonfinite-value",
        reason: "Accepted response contains non-finite numbers (NaN or Infinity).",
      };
    }

    // Unit verification against expectedUnits
    if (Array.isArray(outputs)) {
      for (const out of outputs) {
        if (out && typeof out === "object" && typeof out.quantityId === "string") {
          const expectedUnit = context.expectedUnits?.[out.quantityId];
          if (expectedUnit !== undefined && out.unit !== expectedUnit) {
            return {
              ok: false,
              code: "unit-mismatch",
              reason: `Quantity "${out.quantityId}" declared unit "${out.unit}", expected "${expectedUnit}".`,
            };
          }
        }
      }
    }

    // Typed buffer validation
    if (Array.isArray(buffers)) {
      for (const buf of buffers) {
        const bufCheck = validateBufferHeader(buf);
        if (!bufCheck.ok) {
          const mappedCode: DecodeRejectionCode =
            bufCheck.code === "buffer-length-mismatch"
              ? "buffer-length-mismatch"
              : bufCheck.code === "buffer-shape-mismatch"
                ? "buffer-shape-mismatch"
                : bufCheck.code === "unknown-layout"
                  ? "unknown-layout"
                  : bufCheck.code === "endianness-unsupported"
                    ? "environment-unsupported"
                    : "malformed-response";
          return { ok: false, code: mappedCode, reason: bufCheck.reason };
        }
      }
    }

    // Provenance validation
    if (!provenance || typeof provenance !== "object") {
      return { ok: false, code: "malformed-response", reason: 'Missing "provenance" record.' };
    }
    const provCheck = validateProvenanceRecord(provenance as any);
    if (!provCheck.ok) {
      return { ok: false, code: provCheck.code, reason: provCheck.reason };
    }

    return { ok: true, message: message as unknown as WorkerMessage };
  }

  // 5. REFUSAL RESPONSE
  if (messageKind === "refusal") {
    const { refusal } = message;
    if (!refusal || typeof refusal !== "object") {
      return { ok: false, code: "malformed-response", reason: 'Missing "refusal" record.' };
    }

    const code = (refusal as any).code;
    if (typeof code !== "string" || !(code in refusalCodeRegistry)) {
      return {
        ok: false,
        code: "unregistered-refusal-code",
        reason: `Refusal code "${code}" is not registered in the shared refusalCodeRegistry.`,
      };
    }

    return { ok: true, message: message as unknown as RefusalResponse };
  }

  // 6. OUTCOME RESPONSE
  if (messageKind === "outcome") {
    const { outcome } = message;
    if (!outcome || typeof outcome !== "object") {
      return { ok: false, code: "malformed-response", reason: 'Missing "outcome" record.' };
    }

    const outcomeId = (outcome as any).outcome;
    if (typeof outcomeId !== "string" || !(outcomeId in executionOutcomeRegistry)) {
      return {
        ok: false,
        code: "malformed-response",
        reason: `Unknown execution outcome: "${outcomeId}".`,
      };
    }

    return { ok: true, message: message as unknown as OutcomeResponse };
  }

  return {
    ok: false,
    code: "malformed-response",
    reason: `Unhandled messageKind: "${messageKind}".`,
  };
}
