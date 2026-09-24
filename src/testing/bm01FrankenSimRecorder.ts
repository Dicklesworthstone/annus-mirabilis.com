/**
 * Test support: BM-01's FrankenSim recorder built on the pinned module read from disk, the way
 * the worker builds it after fetching (src/workers/host/bm01Worker.ts). A .ts module, so a .tsx
 * test can use it without importing a WASM loader itself (noPhysicsInComponents binds every
 * .tsx file). The recorder is handed to BM-01's worker host, never to a component.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Bm01Recorder } from "../workers/operations/bm01.ts";
import { frankensimTracerRecorder } from "../workers/wasm/frankensimTracerRecorder.ts";
import { PINNED_ARTIFACT } from "../workers/wasm/pinnedArtifact.ts";
import { loadPinnedBundle } from "../workers/wasm/pinnedBundle.ts";

/** The recorder, or the loader's refusal message when the pinned module did not verify. */
export async function loadPinnedFrankenSimRecorder(): Promise<Bm01Recorder | string> {
  const loaded = await loadPinnedBundle({
    wasmUrl: resolve(
      "public/wasm",
      PINNED_ARTIFACT.bundleId,
      PINNED_ARTIFACT.hashPrefix,
      PINNED_ARTIFACT.wasmFile,
    ),
    readBytes: (p) => readFile(p),
  });
  return loaded.kind === "loaded" ? frankensimTracerRecorder(loaded.exports) : loaded.message;
}
