/**
 * WASM Bundle Loader with Pre-Instantiation Digest Verification (am-fs-slim-artifact-0yh requirement 6).
 *
 * Fetches the artifact and computes its SHA-256 with SubtleCrypto.
 * When the server sends application/wasm it compiles with WebAssembly.compileStreaming
 * on a cloned response while hashing the bytes; otherwise it compiles from bytes.
 * It instantiates only after the digest matches the manifest.
 * A mismatch yields the outcome "artifact-mismatch" and a missing file yields "missing-artifact",
 * both strictly BEFORE any WebAssembly instantiation or compilation.
 */

import { computeArtifactDigestAsync, loadWasmBytes } from "../../testing/wasm/artifactHelpers.ts";
import { registerAdmittedManifest, type WasmArtifactManifest } from "../protocol/provenance.ts";

export type CompilePath = "streaming" | "bytes";

export interface BundleLoadSuccess {
  readonly kind: "loaded";
  readonly module: unknown;
  readonly exports: Record<string, unknown>;
  readonly compilePath: CompilePath;
  readonly digest: string;
  readonly bytes: number;
  readonly bundleId: string;
}

export interface BundleLoadRefusal {
  readonly kind: "refused";
  readonly outcome: "artifact-mismatch" | "missing-artifact" | "unsupported-environment";
  readonly digest?: string;
  readonly expectedDigest?: string;
  readonly message: string;
  readonly compilePath?: CompilePath;
}

export type BundleLoadResult = BundleLoadSuccess | BundleLoadRefusal;

export interface LoadBundleOptions {
  readonly manifestUrl?: string;
  readonly wasmUrl?: string;
  readonly jsUrl?: string;
  readonly manifestData?: WasmArtifactManifest;
  readonly fetchFn?: typeof fetch;
  readonly compileStreamingFn?: (
    source: Response | Promise<Response>,
  ) => Promise<WebAssembly.Module>;
  readonly compileFn?: (bytes: BufferSource) => Promise<WebAssembly.Module>;
  readonly instantiateFn?: (
    moduleObject: WebAssembly.Module,
    importObject?: WebAssembly.Imports,
  ) => Promise<WebAssembly.Instance>;
}

/**
 * Loads the WASM bundle, verifying its SHA-256 digest before instantiation.
 */
export async function loadBundle(options: LoadBundleOptions = {}): Promise<BundleLoadResult> {
  const fetcher = options.fetchFn ?? globalThis.fetch;

  // 1. Obtain manifest
  let manifest: WasmArtifactManifest;
  if (options.manifestData) {
    manifest = options.manifestData;
  } else {
    const manifestUrl = options.manifestUrl ?? "/wasm/manifest.json";
    try {
      if (
        typeof fetcher === "function" &&
        (manifestUrl.startsWith("http://") ||
          manifestUrl.startsWith("https://") ||
          manifestUrl.startsWith("/") ||
          manifestUrl.startsWith("./"))
      ) {
        const res = await fetcher(manifestUrl);
        if (!res.ok) {
          return {
            kind: "refused",
            outcome: "missing-artifact",
            message: `Failed to load manifest from ${manifestUrl}: HTTP ${res.status}`,
          };
        }
        manifest = (await res.json()) as WasmArtifactManifest;
      } else {
        // Local file system fallback
        const { readFileSync } = await import("node:fs");
        const { resolve } = await import("node:path");
        const path = manifestUrl.startsWith("/") ? manifestUrl : resolve(manifestUrl);
        const text = readFileSync(path, "utf8");
        manifest = JSON.parse(text) as WasmArtifactManifest;
      }
    } catch (err) {
      return {
        kind: "refused",
        outcome: "missing-artifact",
        message: `Could not load WASM manifest: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // 2. Determine WASM file location
  const wasmUrl =
    options.wasmUrl ??
    `/wasm/${manifest.bundleId}/${manifest.hashPrefix}/fs_annus_diffusion_bg.wasm`;

  let bytes: ArrayBuffer;
  let isStreamingMime = false;
  let responseClone: Response | null = null;

  try {
    const isHttpUrl = wasmUrl.startsWith("http://") || wasmUrl.startsWith("https://");
    const isBrowserEnv =
      typeof window !== "undefined" ||
      typeof (globalThis as unknown as { importScripts?: unknown }).importScripts === "function";

    if (isHttpUrl || (isBrowserEnv && typeof fetcher === "function")) {
      const res = await fetcher(wasmUrl);
      if (!res.ok) {
        return {
          kind: "refused",
          outcome: "missing-artifact",
          message: `Failed to fetch WASM binary from ${wasmUrl}: HTTP ${res.status}`,
        };
      }
      const contentType = res.headers.get("Content-Type");
      if (contentType === "application/wasm") {
        isStreamingMime = true;
        responseClone = res.clone();
      }
      bytes = await res.arrayBuffer();
    } else {
      bytes = await loadWasmBytes(wasmUrl);
    }
  } catch (err) {
    return {
      kind: "refused",
      outcome: "missing-artifact",
      message: `Failed to read WASM binary from ${wasmUrl}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 3. Compute SHA-256 digest BEFORE any instantiation or compilation
  const actualDigest = await computeArtifactDigestAsync(bytes);
  const expectedDigest = manifest.wasmDigest.toLowerCase();

  if (actualDigest.toLowerCase() !== expectedDigest) {
    return {
      kind: "refused",
      outcome: "artifact-mismatch",
      digest: actualDigest,
      expectedDigest,
      message: `Artifact digest mismatch: expected ${expectedDigest}, received ${actualDigest}`,
    };
  }

  // 4. Compile and Instantiate only AFTER digest matches
  let compilePath: CompilePath = "bytes";
  const compileStreaming = options.compileStreamingFn ?? WebAssembly.compileStreaming;
  const compileBytes = options.compileFn ?? WebAssembly.compile;
  const instantiate = options.instantiateFn ?? WebAssembly.instantiate;

  let compiledModule: WebAssembly.Module;

  if (isStreamingMime && responseClone && typeof compileStreaming === "function") {
    try {
      compiledModule = await compileStreaming(responseClone);
      compilePath = "streaming";
    } catch {
      compiledModule = await compileBytes(bytes);
      compilePath = "bytes";
    }
  } else {
    compiledModule = await compileBytes(bytes);
    compilePath = "bytes";
  }

  const imports = {
    wbg: {},
    env: {},
  };

  const instance = await instantiate(compiledModule, imports);

  // Register the admitted manifest in provenance registry
  registerAdmittedManifest(manifest);

  // Load JS glue exports if available
  let jsModuleExports: Record<string, unknown> = {};
  try {
    const hashPrefix = manifest.hashPrefix;
    const jsPath =
      options.jsUrl ??
      `../../../public/wasm/${manifest.bundleId}/${hashPrefix}/fs_annus_diffusion.js`;
    const jsMod = (await import(/* @vite-ignore */ jsPath)) as Record<string, unknown>;
    if (typeof jsMod.default === "function") {
      await (jsMod.default as (input: WebAssembly.Instance) => Promise<unknown>)(instance);
    }
    jsModuleExports = jsMod;
  } catch {
    // If JS glue import path differs, expose raw wasm exports directly
    jsModuleExports = { ...instance.exports };
  }

  return {
    kind: "loaded",
    module: compiledModule,
    exports: jsModuleExports,
    compilePath,
    digest: actualDigest,
    bytes: bytes.byteLength,
    bundleId: manifest.bundleId,
  };
}
