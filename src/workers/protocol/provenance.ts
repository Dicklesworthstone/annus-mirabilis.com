/**
 * Admitted WASM and Capability Provenance Registry (am-fs-slim-artifact-0yh requirement 9).
 *
 * The manifest is the single source of truth for admitted WASM artifact digests and capability IDs.
 * Responses from any other artifact or unadmitted capability are rejected.
 */

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

export class ProvenanceViolationError extends Error {
  readonly code: "unadmitted-digest" | "unadmitted-capability" | "unloaded-manifest";
  constructor(
    code: "unadmitted-digest" | "unadmitted-capability" | "unloaded-manifest",
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
