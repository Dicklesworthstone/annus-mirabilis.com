/**
 * Load the one pinned FrankenSim module (am-frankensim-repin-and-bind-jvhg).
 *
 * The expectation (URL, sha256, build identity) comes from pinnedArtifact.ts, which is compiled
 * into the caller's bundle, never from a file fetched beside the module. Browser-safe: no
 * node:* imports. Node callers pass `readBytes` and a file path as `wasmUrl`.
 */
import {
  type BundleLoadResult,
  type LoadBundleOptions,
  loadBundle,
  type WasmBindgenGlue,
} from "./loadBundle.ts";
import { PINNED_ARTIFACT, PINNED_WASM_URL } from "./pinnedArtifact.ts";
import { pinnedGlue } from "./pinnedGlue.ts";

export function loadPinnedBundle(
  options: Omit<LoadBundleOptions, "artifact" | "glue" | "manifestData" | "manifestUrl"> = {},
): Promise<BundleLoadResult> {
  return loadBundle({
    ...options,
    artifact: {
      bundleId: PINNED_ARTIFACT.bundleId,
      wasmUrl: PINNED_WASM_URL,
      wasmDigest: PINNED_ARTIFACT.wasmDigest,
      buildIdentity: PINNED_ARTIFACT.buildIdentity,
    },
    glue: pinnedGlue as unknown as WasmBindgenGlue,
  });
}
