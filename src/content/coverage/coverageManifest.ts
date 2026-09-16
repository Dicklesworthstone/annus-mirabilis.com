/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/physics/coverageManifest.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Preserved distinct runtime provenance states ('WASM' | 'TS_FALLBACK' | 'HONEST_PLACEHOLDER') and surface descriptor contracts.
 * - Generalized for multi-dimensional paper and experiment coverage (to be extended by am-cm-coverage-ledger-0ip).
 */

export type WasmSurfaceKind =
  | "none"
  | "generic-wasm"
  | "interpretive-wasm"
  | "experiment-specific-wasm";

export type RuntimeProvenance = "WASM" | "TS_FALLBACK" | "HONEST_PLACEHOLDER";

export interface WasmSurfaceDescriptor {
  readonly kind: Exclude<WasmSurfaceKind, "none">;
  readonly sourceCrate: string;
  readonly loaderFunction: string;
  readonly exportName: string;
  readonly artifactUrl: string;
  readonly artifactSha256: string;
  readonly refusalBoundary: "typed-wasm" | "host-decoder" | "none";
  /** True only when an accepted owner step promotes the shared tape itself. */
  readonly provesSharedBusSource?: boolean;
}

export interface PaperCoverageRow {
  readonly paperSlug: string;
  readonly source: {
    readonly pinnedFacsimile: boolean;
    readonly reviewedLedger: boolean;
    readonly archivalEdition: "published" | "review-pending" | "missing";
    readonly sentenceCount: number;
    readonly equationCount: number;
  };
  readonly presentation: {
    readonly bilingualAligned: boolean;
    readonly defaultTelemetryOwner: "typescript" | "missing";
    readonly liveEquationSet: boolean;
  };
  readonly runtime: {
    readonly wasmSurface: WasmSurfaceKind;
    readonly wasmArtifactUrl?: string;
    readonly wasmArtifactPresent: boolean;
    readonly admittedProvenance: readonly RuntimeProvenance[];
    readonly coldStartProvenance: "HONEST_PLACEHOLDER";
  };
}

export interface PaperCoverageSummary {
  readonly totalPapers: number;
  readonly pinnedFacsimiles: number;
  readonly reviewedLedgers: number;
  readonly publishedEditions: number;
  readonly candidateEditions: number;
  readonly genericWasm: number;
  readonly experimentSpecificWasm: number;
  readonly typedHostOnly: number;
}

export function createInitialCoverageSummary(): PaperCoverageSummary {
  return {
    totalPapers: 5,
    pinnedFacsimiles: 0,
    reviewedLedgers: 0,
    publishedEditions: 0,
    candidateEditions: 0,
    genericWasm: 0,
    experimentSpecificWasm: 0,
    typedHostOnly: 0,
  };
}
