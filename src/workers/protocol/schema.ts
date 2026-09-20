/**
 * Versioned worker request, response, refusal, and outcome schemas.
 * Governed by bead am-rt-worker-protocol-gaq.
 *
 * Implements strict type schemas and validators for:
 * - hello handshake and capability announcement
 * - execution requests with deterministic work budgets and canonical U64String seeds
 * - accepted scientific responses with provenance and model domain
 * - request refusals mapped to shared refusal registry
 * - execution outcomes (protocol mismatch, budget exhausted, etc.)
 */

import type { U64String } from "../../experiments/identity/u64.ts";
import type { ExecutionOutcome } from "../../experiments/results/outcomes.ts";
import type { RequestRefusal } from "../../experiments/results/refusals.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import type { VersionedBufferHeader } from "./buffers.ts";

export const PROTOCOL_VERSION = 1;

export type OwnerKind = "frankensim" | "host-reference";

export type OperationKind = "evaluate" | "step" | "sample" | "checkpoint" | "resume";

export interface Revisions {
  readonly input: number;
  readonly observer: number;
  readonly measurement: number;
  readonly estimator: number;
}

export interface SeedPolicy {
  readonly seed: U64String;
  readonly streamVersion: number;
  readonly allocationId: string;
}

export interface ModelSelection {
  readonly modelId: string;
  readonly modelVersion: string;
}

export interface WorkBudget {
  readonly maxSteps?: number;
  readonly maxSamples?: number;
  readonly maxAllocationBytes: number;
}

export interface ProvenanceRecord {
  readonly ownerKind: OwnerKind;
  readonly capabilityId?: string;
  readonly evaluatorId?: string;
  readonly modelVersion: string;
  readonly artifactDigest: string;
  readonly streamVersion: number;
  readonly determinismClass: string;
}

export interface HelloMessage {
  readonly messageKind: "hello";
  readonly protocolVersion: number | readonly number[];
  readonly supportedLayouts: readonly string[];
  readonly ownerKind: OwnerKind;
  readonly provenanceSet: readonly string[];
}

export interface RequestMessage {
  readonly messageKind: "request";
  readonly protocolVersion: number;
  readonly experimentId: string;
  readonly instanceId: string;
  readonly runId: string;
  readonly actionIndex: number;
  readonly revisions: Revisions;
  readonly parameters: Readonly<Record<string, number | string | boolean>>;
  readonly modelSelection: ModelSelection;
  readonly constantSetId: string;
  readonly seedPolicy: SeedPolicy;
  readonly operation: OperationKind;
  readonly workBudget: WorkBudget;
  readonly checkpoint?: Uint8Array | null;
}

export interface AcceptedResponse {
  readonly messageKind: "accepted";
  readonly instanceId: string;
  readonly runId: string;
  readonly actionIndex: number;
  readonly revisions: Revisions;
  readonly acceptedParameters: Readonly<Record<string, number | string | boolean>>;
  readonly stepIndex: number;
  readonly simulatedTime: number | Readonly<{ point: number; unit: string; [k: string]: unknown }>;
  readonly outputs: readonly ScientificResult[];
  readonly modelDomain: Readonly<{ regime: string; [k: string]: unknown }>;
  readonly final: boolean;
  readonly provenance: ProvenanceRecord;
  readonly buffers?: readonly VersionedBufferHeader[];
  readonly dataBuffers?: readonly ArrayBuffer[];
}

export interface RefusalResponse {
  readonly messageKind: "refusal";
  readonly instanceId: string;
  readonly runId: string;
  readonly actionIndex: number;
  readonly revisions: Revisions;
  readonly refusal: RequestRefusal;
}

export interface OutcomeResponse {
  readonly messageKind: "outcome";
  readonly instanceId: string;
  readonly runId: string;
  readonly actionIndex: number;
  readonly revisions: Revisions;
  readonly outcome: ExecutionOutcome;
}

export type WorkerMessage =
  | HelloMessage
  | RequestMessage
  | AcceptedResponse
  | RefusalResponse
  | OutcomeResponse;

export const HELLO_ALLOWED_KEYS = new Set([
  "messageKind",
  "protocolVersion",
  "supportedLayouts",
  "ownerKind",
  "provenanceSet",
]);

export const REQUEST_ALLOWED_KEYS = new Set([
  "messageKind",
  "protocolVersion",
  "experimentId",
  "instanceId",
  "runId",
  "actionIndex",
  "revisions",
  "parameters",
  "modelSelection",
  "constantSetId",
  "seedPolicy",
  "operation",
  "workBudget",
  "checkpoint",
]);

export const ACCEPTED_ALLOWED_KEYS = new Set([
  "messageKind",
  "instanceId",
  "runId",
  "actionIndex",
  "revisions",
  "acceptedParameters",
  "stepIndex",
  "simulatedTime",
  "outputs",
  "modelDomain",
  "final",
  "provenance",
  "buffers",
  "dataBuffers",
]);

export const REFUSAL_ALLOWED_KEYS = new Set([
  "messageKind",
  "instanceId",
  "runId",
  "actionIndex",
  "revisions",
  "refusal",
]);

export const OUTCOME_ALLOWED_KEYS = new Set([
  "messageKind",
  "instanceId",
  "runId",
  "actionIndex",
  "revisions",
  "outcome",
]);

/**
 * Validates whether a value is a finite number (not NaN, Infinity, -Infinity).
 */
export function isFiniteNumber(val: unknown): val is number {
  return typeof val === "number" && Number.isFinite(val);
}

/**
 * Validates whether an object is a plain object with no inherited prototype pollution.
 */
export function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (val === null || typeof val !== "object") return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

/**
 * Asserts that no unknown keys exist on a plain object record.
 */
export function findUnknownKeys(
  record: Record<string, unknown>,
  allowed: Set<string>,
): readonly string[] {
  return Object.keys(record).filter((k) => !allowed.has(k));
}
