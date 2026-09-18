/**
 * Admitted WASM and Capability Provenance Registry (am-fs-slim-artifact-0yh / am-rt-worker-protocol-gaq).
 *
 * The manifest is the single source of truth for admitted WASM artifact digests and capability IDs.
 * Responses from any other artifact or unadmitted capability are rejected.
 * Host evaluators are admitted through build-time source hashes (source:sha256:<hash>).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProvenanceRecord } from "./schema.ts";

export interface WasmCapabilityRecord {
  readonly capabilityId: string;
  readonly browserExport: string;
  readonly releaseArtifact: string;
  readonly acceptanceState: string;
  readonly determinismClass: string;
  readonly streamKernelIds?: readonly number[];
  readonly exportSignatures?: readonly string[];
}

export interface WasmArtifactManifest {
  readonly schemaVersion: number;
  readonly bundleId: string;
  readonly bundleDir?: string;
  readonly wasmDigest: string;
  readonly wasmBytes: number;
  readonly hashPrefix: string;
  readonly revisions: {
    readonly frankensim: string;
    readonly asupersync?: string;
  };
  readonly toolchain?: string;
  readonly wasmPackVersion?: string;
  readonly wasmBindgenVersion?: string;
  readonly streamSemanticsVersion: number;
  readonly build?: {
    readonly generator?: string;
    readonly generatorType?: string;
    readonly description?: string;
    readonly command?: string;
    readonly flags?: readonly string[];
    readonly timestamp?: string;
  };
  readonly capabilities: readonly WasmCapabilityRecord[];
  readonly sizeBudget: {
    readonly maxBytes: number;
    readonly fullPackageBytes: number;
    readonly recordedBytes: number;
    readonly jsGlueBytes?: number;
    readonly totalBundleBytes?: number;
  };
  readonly files: Record<string, { readonly sha256: string; readonly bytes: number }>;
}

let activeManifest: WasmArtifactManifest | null = null;
const activeEvaluatorHashes = new Map<string, string>();

export class ProvenanceViolationError extends Error {
  readonly code:
    | "unadmitted-digest"
    | "unadmitted-capability"
    | "unadmitted-evaluator"
    | "unloaded-manifest";
  constructor(
    code:
      | "unadmitted-digest"
      | "unadmitted-capability"
      | "unadmitted-evaluator"
      | "unloaded-manifest",
    message: string,
  ) {
    super(message);
    this.name = "ProvenanceViolationError";
    this.code = code;
  }
}

/**
 * Registers the active artifact manifest as the provenance source.
 */
export function registerAdmittedManifest(manifest: WasmArtifactManifest): void {
  activeManifest = Object.freeze({
    ...manifest,
    capabilities: Object.freeze(manifest.capabilities.map((c) => Object.freeze({ ...c }))),
    files: Object.freeze({ ...manifest.files }),
  });
}

/**
 * Loads and registers manifest from public/wasm/manifest.json if available.
 */
export function loadDefaultManifest(root: string = process.cwd()): WasmArtifactManifest | null {
  const manifestPath = resolve(root, "public/wasm/manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    const raw = readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as WasmArtifactManifest;
    registerAdmittedManifest(parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Resets the active manifest to null (for testing).
 */
export function clearAdmittedManifest(): void {
  activeManifest = null;
}

/**
 * Returns the currently registered artifact manifest, or throws if not loaded.
 */
export function getAdmittedManifest(): WasmArtifactManifest {
  if (!activeManifest) {
    throw new ProvenanceViolationError(
      "unloaded-manifest",
      "No WASM artifact manifest has been registered in the provenance registry.",
    );
  }
  return activeManifest;
}

/**
 * Checks if a WASM digest is admitted by the active manifest.
 */
export function isAdmittedWasmDigest(digest: string): boolean {
  if (!activeManifest) return false;
  const target = digest.toLowerCase();
  if (activeManifest.wasmDigest.toLowerCase() === target) return true;
  for (const file of Object.values(activeManifest.files)) {
    if (file.sha256.toLowerCase() === target) return true;
  }
  return false;
}

/**
 * Checks if a capability ID is admitted by the active manifest.
 */
export function isAdmittedCapability(capabilityId: string): boolean {
  if (!activeManifest) return false;
  return activeManifest.capabilities.some((c) => c.capabilityId === capabilityId);
}

/**
 * Asserts that a WASM digest is admitted, throwing ProvenanceViolationError if not.
 */
export function assertAdmittedWasmDigest(digest: string): void {
  if (!isAdmittedWasmDigest(digest)) {
    throw new ProvenanceViolationError(
      "unadmitted-digest",
      `WASM artifact digest "${digest}" is not admitted by the provenance registry.`,
    );
  }
}

/**
 * Asserts that a capability ID is admitted, throwing ProvenanceViolationError if not.
 */
export function assertAdmittedCapability(capabilityId: string): void {
  if (!isAdmittedCapability(capabilityId)) {
    throw new ProvenanceViolationError(
      "unadmitted-capability",
      `Capability "${capabilityId}" is not admitted by the provenance registry.`,
    );
  }
}

/**
 * Registers host evaluator source hashes (evaluatorId -> source:sha256:<hash>).
 */
export function registerAdmittedEvaluators(
  evaluators: Record<string, string> | Map<string, string>,
): void {
  const entries = evaluators instanceof Map ? evaluators.entries() : Object.entries(evaluators);
  for (const [id, hash] of entries) {
    activeEvaluatorHashes.set(id, hash);
  }
}

/**
 * Clears registered host evaluator source hashes (for testing).
 */
export function clearAdmittedEvaluators(): void {
  activeEvaluatorHashes.clear();
}

/**
 * Checks if a host evaluator source hash is admitted.
 */
export function isAdmittedEvaluator(evaluatorId: string, sourceHash: string): boolean {
  const admitted = activeEvaluatorHashes.get(evaluatorId);
  if (!admitted) return false;
  return admitted === sourceHash;
}

/**
 * Asserts that a host evaluator is admitted, throwing ProvenanceViolationError if not.
 */
export function assertAdmittedEvaluator(evaluatorId: string, sourceHash: string): void {
  if (!isAdmittedEvaluator(evaluatorId, sourceHash)) {
    throw new ProvenanceViolationError(
      "unadmitted-evaluator",
      `Host evaluator "${evaluatorId}" with source hash "${sourceHash}" is not admitted by the provenance registry.`,
    );
  }
}

/**
 * Returns all admitted WASM digests.
 */
export function getAdmittedWasmDigests(): readonly string[] {
  if (!activeManifest) return [];
  const digests = new Set<string>();
  digests.add(activeManifest.wasmDigest.toLowerCase());
  for (const file of Object.values(activeManifest.files)) {
    digests.add(file.sha256.toLowerCase());
  }
  return Array.from(digests);
}

/**
 * Returns all admitted capability IDs.
 */
export function getAdmittedCapabilityIds(): readonly string[] {
  if (!activeManifest) return [];
  return activeManifest.capabilities.map((c) => c.capabilityId);
}

/**
 * Returns all admitted evaluator IDs and hashes.
 */
export function getAdmittedEvaluators(): ReadonlyMap<string, string> {
  return new Map(activeEvaluatorHashes);
}

/**
 * Validates a complete ProvenanceRecord against the active registry.
 */
export function validateProvenanceRecord(provenance: ProvenanceRecord):
  | { ok: true }
  | {
      ok: false;
      code: "unadmitted-digest" | "unadmitted-capability" | "unadmitted-evaluator";
      reason: string;
    } {
  const rawOwnerKind: unknown = provenance.ownerKind;
  if (rawOwnerKind === "frankensim") {
    // 1. Check artifact digest against manifest
    const digest = provenance.artifactDigest.replace(/^sha256:/i, "");
    if (!isAdmittedWasmDigest(digest)) {
      return {
        ok: false,
        code: "unadmitted-digest",
        reason: `WASM artifact digest "${provenance.artifactDigest}" is not admitted by the provenance registry.`,
      };
    }
    // 2. If capabilityId present, check against manifest capabilities
    if (provenance.capabilityId && !isAdmittedCapability(provenance.capabilityId)) {
      return {
        ok: false,
        code: "unadmitted-capability",
        reason: `Capability "${provenance.capabilityId}" is not admitted by the provenance registry.`,
      };
    }
    return { ok: true };
  }

  if (rawOwnerKind === "host-reference") {
    const evaluatorId = provenance.evaluatorId ?? "unknown";
    if (!isAdmittedEvaluator(evaluatorId, provenance.artifactDigest)) {
      return {
        ok: false,
        code: "unadmitted-evaluator",
        reason: `Host evaluator "${evaluatorId}" with source hash "${provenance.artifactDigest}" is not admitted.`,
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    code: "unadmitted-evaluator",
    reason: `Unknown owner kind: "${String(rawOwnerKind)}"`,
  };
}
