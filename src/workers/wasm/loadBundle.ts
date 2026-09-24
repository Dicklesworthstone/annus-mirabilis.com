/**
 * WASM bundle loader: verify, then initialize, or refuse with a typed execution outcome
 * (am-fs-slim-artifact-0yh requirement 6; rewritten for the compiled artifact in
 * am-frankensim-repin-and-bind-jvhg).
 *
 * The order is fixed, and each step either passes or returns a refusal:
 * 1. Check the environment. Without WebAssembly or SubtleCrypto: `environment-unsupported`.
 * 2. Read the bytes, by `fetch` or by an injected reader. A missing file: `missing-artifact`.
 * 3. SHA-256 the bytes and compare with the expected digest. A mismatch: `artifact-mismatch`,
 *    before anything is compiled.
 * 4. Compile exactly those verified bytes, and hand the module to the wasm-bindgen glue's
 *    `initSync({ module })`. A compile or link error: `artifact-mismatch`.
 * 5. Ask the module what it is, with `build_identity()`, and compare with the expected
 *    identity. A difference: `artifact-mismatch`.
 *
 * There is no fallback to raw exports and no second attempt with a different module. The glue
 * is a singleton (its `initSync` returns early once initialized), so this loader records which
 * digest initialized each glue object and refuses to reuse it with another.
 *
 * Nothing here imports node:*. This module runs in the browser worker. Node callers inject
 * `readBytes` (see wasmWorker.ts).
 */

import {
  type ExecutionOutcome,
  type ExecutionOutcomeId,
  executionOutcomeRegistry,
} from "../../experiments/results/outcomes.ts";
import type { WasmArtifactManifest } from "../protocol/provenance.ts";
import type { FrankenSimExports } from "./frankensimCalls.ts";

export type CompilePath = "bytes";

/** The wasm-bindgen `--target web` glue surface this loader needs. */
export interface WasmBindgenGlue extends FrankenSimExports {
  initSync(input: { module: WebAssembly.Module | BufferSource }): unknown;
}

/** What the loader verifies a module against. */
export type ArtifactExpectation = Readonly<{
  bundleId: string;
  wasmUrl: string;
  wasmDigest: string;
  /** The exact `build_identity()` string. Without it, the identity step is skipped and reported. */
  buildIdentity?: string | undefined;
}>;

export interface BundleLoadSuccess {
  readonly kind: "loaded";
  readonly module: WebAssembly.Module;
  readonly exports: FrankenSimExports;
  readonly compilePath: CompilePath;
  readonly digest: string;
  readonly bytes: number;
  readonly bundleId: string;
  /** What `build_identity()` returned, or null if no identity was expected. */
  readonly identity: string | null;
}

export type BundleLoadOutcomeId = Extract<
  ExecutionOutcomeId,
  "artifact-mismatch" | "missing-artifact" | "environment-unsupported"
>;

export interface BundleLoadRefusal {
  readonly kind: "refused";
  readonly outcome: BundleLoadOutcomeId;
  /** The registered execution outcome, with the reason in its details. */
  readonly executionOutcome: ExecutionOutcome;
  readonly digest?: string;
  readonly expectedDigest?: string;
  readonly message: string;
}

export type BundleLoadResult = BundleLoadSuccess | BundleLoadRefusal;

export interface LoadBundleOptions {
  /** Verify against this. Takes precedence over a manifest. */
  readonly artifact?: ArtifactExpectation;
  readonly manifestData?: WasmArtifactManifest;
  readonly manifestUrl?: string;
  /** Overrides the URL derived from the artifact or manifest. */
  readonly wasmUrl?: string;
  /** The glue to initialize. Required: this module does not choose one. */
  readonly glue?: WasmBindgenGlue;
  readonly fetchFn?: typeof fetch;
  /** Reads a non-HTTP location (a file path in Node). When absent, `fetchFn` reads everything. */
  readonly readBytes?: (location: string) => Promise<ArrayBuffer | Uint8Array>;
  readonly compileFn?: (bytes: BufferSource) => Promise<WebAssembly.Module>;
  readonly digestFn?: (bytes: Uint8Array) => Promise<string>;
}

const initializedWith = new WeakMap<object, string>();

function refuse(
  outcome: BundleLoadOutcomeId,
  message: string,
  extra: Partial<Pick<BundleLoadRefusal, "digest" | "expectedDigest">> = {},
): BundleLoadRefusal {
  const d = executionOutcomeRegistry[outcome];
  return {
    kind: "refused",
    outcome,
    executionOutcome: {
      outcome,
      message: d.message,
      retry: d.retry,
      details: {
        reason: message,
        ...(extra.digest ? { digest: extra.digest } : {}),
        ...(extra.expectedDigest ? { expectedDigest: extra.expectedDigest } : {}),
      },
    },
    message,
    ...extra,
  };
}

async function subtleSha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The wasm file a manifest names: the one `files` entry ending in `_bg.wasm`. */
export function wasmFileOf(manifest: WasmArtifactManifest): string | null {
  const names = Object.keys(manifest.files).filter((n) => n.endsWith("_bg.wasm"));
  return names.length === 1 ? (names[0] ?? null) : null;
}

export function expectationFromManifest(
  manifest: WasmArtifactManifest,
  base = "/wasm",
): ArtifactExpectation | null {
  const file = wasmFileOf(manifest);
  if (!file) return null;
  const identity = (manifest.build as { identity?: unknown } | undefined)?.identity;
  return {
    bundleId: manifest.bundleId,
    wasmUrl: `${base}/${manifest.bundleId}/${manifest.hashPrefix}/${file}`,
    wasmDigest: manifest.wasmDigest.toLowerCase(),
    ...(typeof identity === "string" ? { buildIdentity: identity } : {}),
  };
}

export async function loadBundle(options: LoadBundleOptions = {}): Promise<BundleLoadResult> {
  // 1. Environment.
  if (typeof WebAssembly === "undefined" || typeof WebAssembly.compile !== "function")
    return refuse("environment-unsupported", "This environment has no WebAssembly.");
  const digestFn =
    options.digestFn ??
    (typeof globalThis.crypto?.subtle?.digest === "function" ? subtleSha256 : null);
  if (!digestFn)
    return refuse("environment-unsupported", "This environment cannot compute SHA-256.");
  if (!options.glue) return refuse("missing-artifact", "No wasm-bindgen glue was supplied.");
  const fetcher = options.fetchFn ?? globalThis.fetch;

  // The expectation: explicit, from a supplied manifest, or from a fetched one.
  let expected: ArtifactExpectation | null = options.artifact ?? null;
  if (!expected) {
    let manifest = options.manifestData;
    if (!manifest) {
      const manifestUrl = options.manifestUrl ?? "/wasm/manifest.json";
      try {
        const res = await fetcher(manifestUrl);
        if (!res.ok)
          return refuse("missing-artifact", `Manifest ${manifestUrl} answered HTTP ${res.status}.`);
        manifest = (await res.json()) as WasmArtifactManifest;
      } catch (err) {
        return refuse(
          "missing-artifact",
          `Manifest ${manifestUrl} could not be read: ${String(err)}`,
        );
      }
    }
    expected = expectationFromManifest(manifest);
    if (!expected) return refuse("missing-artifact", "The manifest names no single _bg.wasm file.");
  }
  const wasmUrl = options.wasmUrl ?? expected.wasmUrl;
  const expectedDigest = expected.wasmDigest.toLowerCase();

  // 2. Bytes.
  let bytes: Uint8Array;
  try {
    const isHttp = /^https?:\/\//.test(wasmUrl);
    if (options.readBytes && !isHttp) {
      const raw = await options.readBytes(wasmUrl);
      bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    } else {
      const res = await fetcher(wasmUrl);
      if (!res.ok) return refuse("missing-artifact", `${wasmUrl} answered HTTP ${res.status}.`);
      bytes = new Uint8Array(await res.arrayBuffer());
    }
  } catch (err) {
    return refuse("missing-artifact", `${wasmUrl} could not be read: ${String(err)}`);
  }

  // 3. Digest, before any compilation.
  const digest = (await digestFn(bytes)).toLowerCase();
  if (digest !== expectedDigest)
    return refuse("artifact-mismatch", `Expected sha256 ${expectedDigest}, received ${digest}.`, {
      digest,
      expectedDigest,
    });

  // 4. Compile the verified bytes; initialize the glue with that module.
  const previous = initializedWith.get(options.glue);
  if (previous !== undefined && previous !== digest)
    return refuse(
      "artifact-mismatch",
      `This glue is already initialized with module ${previous}; it cannot take ${digest}.`,
      { digest, expectedDigest },
    );
  let compiled: WebAssembly.Module;
  try {
    compiled = await (options.compileFn ?? WebAssembly.compile)(bytes);
    options.glue.initSync({ module: compiled });
  } catch (err) {
    return refuse(
      "artifact-mismatch",
      `The verified module did not compile or link: ${String(err)}`,
      {
        digest,
        expectedDigest,
      },
    );
  }
  initializedWith.set(options.glue, digest);

  // 5. Identity.
  let identity: string | null = null;
  if (expected.buildIdentity !== undefined) {
    try {
      identity = options.glue.build_identity();
    } catch (err) {
      return refuse("artifact-mismatch", `build_identity() failed: ${String(err)}`, {
        digest,
        expectedDigest,
      });
    }
    if (identity !== expected.buildIdentity)
      return refuse(
        "artifact-mismatch",
        `The module reports ${identity}; the edition expects ${expected.buildIdentity}.`,
        { digest, expectedDigest },
      );
  }

  return {
    kind: "loaded",
    module: compiled,
    exports: options.glue,
    compilePath: "bytes",
    digest,
    bytes: bytes.byteLength,
    bundleId: expected.bundleId,
    identity,
  };
}
