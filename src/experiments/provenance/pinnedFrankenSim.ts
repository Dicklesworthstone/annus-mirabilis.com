/**
 * The one compiled FrankenSim artifact this edition admits (am-frankensim-repin-and-bind-jvhg).
 *
 * Plain data, no loading: it lives here, outside src/workers/wasm/, so that a view (TracerLab's
 * model note) can name the artifact without importing a WASM loader, which viewImportGuard and
 * noPhysicsInComponents forbid. src/workers/wasm/pinnedArtifact.ts re-exports it for the loader.
 *
 * These values mirror public/wasm/manifest.json, which
 * scripts/wasm-artifacts/placeCompiledArtifact.ts writes from the real build.
 * pinnedArtifact.test.ts fails if the two ever disagree, or if the files on disk do not hash
 * to these digests. They live in code, not only in a fetched manifest, so that a worker checks
 * the bytes it fetched against a digest shipped in its own bundle, and not against a file
 * served beside the artifact.
 *
 * `buildIdentity` is the exact string the module's `build_identity()` returns. The loader
 * refuses a module that reports anything else.
 */

export const PINNED_ARTIFACT = Object.freeze({
  bundleId: "fs-annus-diffusion",
  hashPrefix: "80a1f8fda6f69003",
  wasmFile: "fs_annus_diffusion_bg.wasm",
  wasmDigest: "80a1f8fda6f69003c9aa40f991726933c265b6c13ce6062faf5faef479a917bd",
  wasmBytes: 92751,
  glueFile: "fs_annus_diffusion.js",
  glueDigest: "13e94ff5800e118081552969b9ab3d57ece15a246c5f2b9c1177e4dc4f4c1c22",
  frankensimRevision: "01824653087a69272d5a9c0c6ea2e2789ad05f54",
  transportVersion: "fs-annus-wasm 0.0.1",
  buildIdentity:
    '{"transport":"fs-annus-wasm 0.0.1","frankensimRevision":"01824653087a69272d5a9c0c6ea2e2789ad05f54","exports":["brownian_frames","philox_normals","diffusion1d_frames"]}',
});

/** Where the site serves the pinned module. */
export const PINNED_WASM_URL = `/wasm/${PINNED_ARTIFACT.bundleId}/${PINNED_ARTIFACT.hashPrefix}/${PINNED_ARTIFACT.wasmFile}`;

/**
 * The model note's sentence for an output the pinned module computed. It names the transport
 * crate, the FrankenSim revision and the artifact digest, the same identity the loader checked
 * before the module was used.
 */
export const FRANKENSIM_BROWNIAN_ENGINE_SENTENCE = `Computed with FrankenSim (brownian_frames), ${PINNED_ARTIFACT.transportVersion} over FrankenSim ${PINNED_ARTIFACT.frankensimRevision.slice(0, 8)}, module sha256 ${PINNED_ARTIFACT.wasmDigest.slice(0, 16)}.`;

/** The same identity for BM-06's grid when the pinned module stepped it (diffusion1d_frames). */
export const FRANKENSIM_DIFFUSION_ENGINE_SENTENCE = `Stepped with FrankenSim (diffusion1d_frames), ${PINNED_ARTIFACT.transportVersion} over FrankenSim ${PINNED_ARTIFACT.frankensimRevision.slice(0, 8)}, module sha256 ${PINNED_ARTIFACT.wasmDigest.slice(0, 16)}.`;
